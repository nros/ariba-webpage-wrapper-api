import type express from "express";
import type { ParsedQs } from "qs";
import type { ParamsDictionary, Request, Response } from "express-serve-static-core";
import type { HttpError, HttpResponseErrorMessage } from "./IApiServer";

export type TLongRunningTaskResultGenerator =
    <Locals extends Record<string, unknown> = Record<string, unknown>>(
        response: Promise<Response<unknown | HttpResponseErrorMessage, Locals>>,
    ) => Promise<void>;

/**
 * Is provided to tasks to make them check for cancellation requests.
 */
export interface ITaskManagerTaskControl {
    /**
     * can be set to indicate the progress of the task.
     *
     * Range is integer number from {0} to {1000}, whereas {1000} indicating "100 %".
     */
    progress: number;

    /**
     * can be set to give a more verbose status message about the progress.
     */
    progressMessage?: string;

    /**
     * {true} in case the task has been cancelled. The task should immediately fail with an error.
     */
    isCancelled: boolean;

    /**
     * Creates an error with proper HTTP status to indicate the task has been cancelled.
     */
    createCancelError(message?: string): HttpError;

    /**
     * Checks for cancellation and passes the provided data if not cancelled.
     *
     * If the task has been cancelled, the returned promise is rejected with an error.
     * It can be used with an Promise-chain to easily check for cancellation.
     * <pre>
     *     startTask()
     *         .then(taskControl.checkAndPass)
     *         .then(() => performSomeProgress)
     *          .then(taskControl.checkAndPass)
     *          ...
     * </pre>
     */
    checkAndPass<T>(data: T): Promise<T>;
}

export type Task = (taskControl: ITaskManagerTaskControl) => PromiseLike<TLongRunningTaskResultGenerator>;

export interface ILongRunningTaskManager {
    executeLongRunningTask<
        P = ParamsDictionary,
        ResBody = unknown,
        ReqBody = unknown,
        ReqQuery = ParsedQs,
        Locals extends Record<string, unknown> = Record<string, unknown>
    >(
        newTask: Task,
        request: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
        response: Response<ResBody, Locals>,
        next: express.NextFunction,
    ): void;
}


export type TRequestWithTaskManager = express.Request & {
    taskManager?: ILongRunningTaskManager;
};
