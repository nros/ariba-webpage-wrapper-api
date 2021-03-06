import type express from "express";
import type { ParamsDictionary, Request, Response } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { IMiddleware } from "../IMiddleware.js";
import type { IApiServer } from "../IApiServer.js";
import type { HttpError } from "../IApiServer.js";
import type {
    ILongRunningTaskManager,
    ITaskManagerTaskControl,
    Task,
    TLongRunningTaskResultGenerator,
} from "../ILongRunningTaskManager.js";

import PQueue from "p-queue";
import { v4 as uuidv4 } from "uuid";
import { constants } from "http2";
import { setTaskManagerToRequest } from "../ILongRunningTaskManager.js";
import { TaskControlImpl } from "./TaskControlImpl.js";
import { sendResponseError } from "./http-utils.js";

const KEEP_TIME_OF_RESULT_AFTER_FINISH = 1000 * 60 * 10;

export interface HttpResponseTaskQueueMessage {
    status: string & ("QUEUED" | "WAITING" | "RUNNING" | "CANCELLED" | "FINISHED" | "FAILED");
    message: string;
    taskId: string;
}

interface IOperationResult {
    creationTime: Date;
    httpResultGenerator: TLongRunningTaskResultGenerator;
    isFailed: boolean;
}

interface IRunningTask {
    task?: Task;
    isStarted: boolean;
    isFailed: boolean;
    waitingForTask: PromiseLike<void>;
    control: ITaskManagerTaskControl;
}

/**
 * A task maanger to handle long running tasks and execute them within the very same node process.
 *
 * Because the main work of driving the Ariba website is waiting for the headless browser to perform the commands,
 * there seems not much to do for the node process but waiting. Hence, no separate process is spawn or the task
 * otherwise processed by a separate service.
 *
 * see:
 * - http://restalk-patterns.org/long-running-operation-polling.html
 * - https://medium.com/geekculture/rest-api-best-practices-decouple-long-running-tasks-from-http-request-processing-9fab2921ace8
 */
export class LongRunningTaskMiddleware implements IMiddleware, ILongRunningTaskManager {
    private _queue = new PQueue({ concurrency: 4 });
    private _operationResults: { [id: string]: IOperationResult } = {};
    private _longRunningTasks: { [id: string]: IRunningTask } = {};

    public close(): void {
        this._longRunningTasks = {};
        this._operationResults = {};
        this._queue.clear();
    }

    public async registerMiddleware(app: express.Express, apiServer: IApiServer): Promise<express.Express> {
        // add this to the request
        app.use((request, response, next) => {
            setTaskManagerToRequest(request, this);
            next();
        });

        app.get("/tasks", (request, response) => {
            apiServer.logRequest(request);
            response
                .status(constants.HTTP_STATUS_OK)
                .json({
                    queuesTasks: Object.getOwnPropertyNames(this._longRunningTasks),
                    finishedTasks: Object.getOwnPropertyNames(this._operationResults),
                });
        });

        app.get("/tasks/:id/status", (request, response) => {
            apiServer.logRequest(request);
            const id = request.params.id;

            if (this._longRunningTasks[id]) {
                response
                    .status(constants.HTTP_STATUS_OK)
                    .json({
                        status: this._longRunningTasks[id].isStarted ? "RUNNING" : "WAITING",
                        message: `Task is ${this._longRunningTasks[id].isStarted ? "running" : "waiting"}`,
                        taskId: id,
                    } as HttpResponseTaskQueueMessage)
                ;

            } else if (this._operationResults[id]) {
                response
                    .status(constants.HTTP_STATUS_OK)
                    .json({
                        status: this._operationResults[id].isFailed ? "FAILED" : "FINISHED",
                        message: "Task has finished",
                        taskId: id,
                    } as HttpResponseTaskQueueMessage)
                ;

            } else {
                response.sendStatus(constants.HTTP_STATUS_NOT_FOUND);
            }
        });

        app.get("/tasks/:id", (request, response) => {
            apiServer.logRequest(request);
            const id = request.params.id;

            if (this._longRunningTasks[id]) {
                response
                    .status(constants.HTTP_STATUS_SERVICE_UNAVAILABLE)
                    .json({
                        status: this._longRunningTasks[id].isStarted ? "RUNNING" : "WAITING",
                        message: `Task is ${this._longRunningTasks[id].isStarted ? "running" : "waiting"}`,
                        taskId: id,
                    } as HttpResponseTaskQueueMessage)
                ;

            } else if (this._operationResults[id]) {
                this._operationResults[id].httpResultGenerator(Promise.resolve(response));

            } else {
                response.sendStatus(constants.HTTP_STATUS_NOT_FOUND);
            }
        });

        app.delete("/tasks/:id", (request, response) => {
            const id = request.params.id;

            if (this._longRunningTasks[id]) {
                this._longRunningTasks[id].control.isCancelled = true;

                response
                    .status(constants.HTTP_STATUS_OK)
                    .json({
                        status: "CANCELLED",
                        message: `Task is being cancelled`,
                        taskId: id,
                    } as HttpResponseTaskQueueMessage)
                ;
            } else if (this._operationResults[id]) {
                response
                    .status(constants.HTTP_STATUS_CONFLICT)
                    .json({
                        status: "FINISHED",
                        message: `Task has finished`,
                        taskId: id,
                    } as HttpResponseTaskQueueMessage)
                ;

            } else {
                response.status(constants.HTTP_STATUS_NOT_FOUND);
            }
        });

        apiServer.registerCloseCleanup(() => this.close());
        return app;
    }

    public executeLongRunningTask<P = ParamsDictionary,
        ResBody = unknown,
        ReqBody = unknown,
        ReqQuery = ParsedQs,
        Locals extends Record<string, unknown> = Record<string, unknown>>(
        newTask: Task,
        request: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
        response: Response<ResBody | HttpResponseTaskQueueMessage, Locals>,
    ): void {

        if ((request.params as unknown as ParamsDictionary).forceImmediateExection === "true") {
            Promise.resolve(newTask(new TaskControlImpl()))
                .then((responseGenerator) => responseGenerator(Promise.resolve(response as express.Response)))
                .catch(sendResponseError(response as express.Response))
            ;

        } else {
            const task = this.createWaiterForPreviousTask(newTask, request);
            const newTaskID = this.addLongRunningTask(task);

            response.status(constants.HTTP_STATUS_ACCEPTED).json({
                status: "QUEUED",
                message: "Task accepted for execution ...",
                taskId: newTaskID,
            } as HttpResponseTaskQueueMessage);
        }
    }


    private createWaiterForPreviousTask<P = ParamsDictionary,
        ResBody = unknown,
        ReqBody = unknown,
        ReqQuery = ParsedQs,
        Locals extends Record<string, unknown> = Record<string, unknown>>(
        newTask: Task,
        request: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
    ): Task {
        //
        const waitForTaskId = this.extractIdForTaskToDependOn(request);
        if (waitForTaskId) {
            const taskId: string = waitForTaskId;
            return (taskControl) =>
                (this._longRunningTasks[taskId]?.waitingForTask || Promise.resolve())
                    .then(() =>
                        newTask(taskControl),
                    )
            ;
        } else {
            return newTask;
        }
    }


    private extractIdForTaskToDependOn<P = ParamsDictionary,
        ResBody = unknown,
        ReqBody = unknown,
        ReqQuery = ParsedQs,
        Locals extends Record<string, unknown> = Record<string, unknown>>(
        request: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
    ): (string | undefined) {
        let waitForTaskId: string | undefined;

        const allParams = {
            ...request.query,
            ...request.body,
            ...(request.params as unknown as ParamsDictionary),
        };

        if (allParams.afterRunningTask) {
            waitForTaskId = allParams.afterRunningTask;
        }

        if (waitForTaskId && this._longRunningTasks[waitForTaskId] !== undefined) {
            return waitForTaskId;
        }

        return undefined;
    }


    private addLongRunningTask(task: Task): string {
        // create new UUID
        let maxRetries = 10;
        let id = "i" + uuidv4(); // prefix with "i" to make it usable as property name by guarantee

        while (maxRetries > 0 && this._longRunningTasks[id] !== undefined) {
            id = "i" + uuidv4();
            maxRetries--;
        }

        if (this._longRunningTasks[id] !== undefined) {
            throw new Error(`Failed to create a unique ID for long running tasks: ${id}`);
        }

        const taskControl = this.createTaskControl();

        // remember a marker when the task as ended
        const waitingForTask =
            new Promise((resolve: (data: TLongRunningTaskResultGenerator) => void) => {
                //
                const taskAsEnded = resolve;

                // use a factory function to give the queue the oportunity to start the Promise as needed
                const longRunningTaskFunc = () => new Promise((resolve) => process.nextTick(resolve))
                    .then(() => { this._longRunningTasks[id].isStarted = true; })
                    .then(() => taskControl)
                    .then(task)
                    .catch((error: HttpError) => {
                        this._longRunningTasks[id].isFailed = true;

                        return (async (response) => {
                            sendResponseError(await response)(error);
                        }) as TLongRunningTaskResultGenerator;
                    })
                    .then((responseGenerator) => {
                        taskAsEnded(responseGenerator);
                    })
                ;

                this._queue.add(longRunningTaskFunc).then();

            }).then((responseGenerator) => {
                this._operationResults[id] = {
                    creationTime: new Date(),
                    httpResultGenerator: responseGenerator,
                    isFailed: this._longRunningTasks[id].isFailed,
                };

                delete this._longRunningTasks[id];

                this.cleanQueues();
            })
        ;

        this._longRunningTasks[id] = {
            task,
            isStarted: false,
            isFailed: false,
            waitingForTask,
            control: taskControl,
        };

        this.cleanQueues();

        return id;
    }

    private createTaskControl(): ITaskManagerTaskControl {
        return new TaskControlImpl();
    }


    private cleanQueues(): void {
        for (const id of Object.getOwnPropertyNames(this._operationResults)) {
            if (this._operationResults[id].creationTime &&
                (Date.now() - this._operationResults[id].creationTime.getTime()) > KEEP_TIME_OF_RESULT_AFTER_FINISH
            ) {
                delete this._operationResults[id];
            }
        }
    }
}
