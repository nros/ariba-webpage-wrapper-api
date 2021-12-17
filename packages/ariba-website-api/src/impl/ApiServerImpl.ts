/// <reference types="node" />
import type * as http from "http";
import type { ParsedQs } from "qs";
import type { Logger } from "winston";
import type * as Transport from "winston-transport";

import type { IAribaWebsite, IAribaWebsiteApi } from "ariba-website-wrapper";
import type { RequestWithAuthentication } from "./AuthenticatorJsonImpl.js";
import type { RequestWithAribaWebsite } from "./AribaApiMiddleware.js";
import type { HttpError, IApiServer } from "../IApiServer.js";
import type {
    ITaskManagerTaskControl,
    Task,
    TLongRunningTaskResultGenerator,
} from "../ILongRunningTaskManager.js";
import type { IMiddlewareNeedsTimer } from "../IMiddlewareNeedsTimer.js";

import express from "express";
import bodyParser from "body-parser";
import nocache from "nocache";
import winston from "winston";

import { AuthenticatorJsonImpl } from "./AuthenticatorJsonImpl.js";
import { ConfigMiddleware } from "./ConfigMiddleware.js";
import { AribaApiMiddleware } from "./AribaApiMiddleware.js";
import { getTaskManagerFromRequest } from "../ILongRunningTaskManager.js";
import { LongRunningTaskMiddleware } from "./LongRunningTaskMiddleware.js";
import { sendResponseJson, sendResponseError } from "./http-utils.js";

const DAY = 1000 * 60 * 60 * 24;

export class ApiServerImpl implements IApiServer {
    private _server?: http.Server;
    private _app?: express.Express;
    private _configMiddleware: ConfigMiddleware;
    private _logger: Logger;
    private _timers: ReturnType<typeof setInterval>[] = [];
    private _timersAtStart: Array<() => void> = [];
    private _cleanUpOnClose: Array<() => void> = [];

    public constructor(configFile?: string) {
        this._configMiddleware = new ConfigMiddleware(configFile);

        const myFormat = winston.format.printf(({ level, message, timestamp, loggerName, ...metadata }) => {
            let msg = `${timestamp} [${level}] ${loggerName}: ${message} `;

            if (metadata) {
                const metadataMessage = JSON.stringify(metadata, undefined, 4);
                if (metadataMessage.trim() !== "{}") {
                    msg += " " + metadataMessage;
                }
            }
            return msg;
        });

        this._logger = winston.createLogger({
            level: "debug",
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.splat(),
                winston.format.timestamp(),
                myFormat,
            ),
            transports: [
                new winston.transports.Console({ level: "debug" }) as Transport,
            ],
        });
    }

    public get isStarted(): boolean {
        return !!this._app;
    }

    public async start(): Promise<IApiServer> {
        if (this.isStarted) {
            throw new Error("Server is already running!");
        }

        const expressAppServer = express();
        // https://stackoverflow.com/questions/22632593/how-to-disable-webpage-caching-in-expressjs-nodejs
        expressAppServer.set("etag", false);

        let app = express.Router() as express.Express;

        app.use(nocache());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());

        app = await new AuthenticatorJsonImpl().registerMiddleware(app, this);
        app = await this._configMiddleware.registerMiddleware(app, this);
        app = await new LongRunningTaskMiddleware().registerMiddleware(app, this);
        app = await new AribaApiMiddleware().registerMiddleware(app, this);
        app = await this.registerApiHandlers(app);

        expressAppServer.use("/api", app);
        expressAppServer.use("/", (request, response) => {
            this.logRequest(request);
            response.sendStatus(404);
        });

        this._app = expressAppServer;
        await new Promise((resolve) => {
            this._server = expressAppServer.listen(this.port, "127.0.0.1", () => resolve(undefined));
        });

        // start all timers
        this._timersAtStart.forEach((startTimer) => startTimer);
        this._timersAtStart = [];
        return this;
    }

    public async stop(): Promise<IApiServer> {

        this._timers
            .filter((timer) => !!timer)
            .forEach((timer) => clearInterval(timer));
        this._timers = [];

        if (this._server) {
            await new Promise((resolve) => this._server?.close(resolve));
        }

        this._cleanUpOnClose
            .filter((clean) => !!clean && typeof clean === "function")
            .forEach((clean) => clean());
        this._cleanUpOnClose = [];

        this._server = undefined;
        this._app = undefined;

        return this;
    }

    public get port(): number {
        return this._configMiddleware?.configuration?.server?.port || 9080;
    }

    public registerTimerEvent(middleware: IMiddlewareNeedsTimer, interval: number): void {
        const startTimer = () => this._timers.push(setInterval(middleware.timerEvent.bind(middleware), interval));
        if (this.isStarted) {
            startTimer();
        } else {
            this._timersAtStart.push(startTimer);
        }
    }

    public registerCloseCleanup(callback: () => void): void {
        if (callback && typeof callback === "function") {
            this._cleanUpOnClose.push(callback);
        }
    }


    public logRequest(request: express.Request): void {
        this._logger.debug(JSON.stringify({
            request: {
                method: request.method,
                hostname: request.hostname,
                path: request.path,
                headers: request.headers,
                params: JSON.parse(JSON.stringify(request.params)),
                body: request.body,
                user: (request as RequestWithAuthentication).auth?.user,
                aribaUser: (request as RequestWithAuthentication).auth?.aribaUsername,
            },
        }, undefined, 4));
    }


    protected async registerApiHandlers(app: express.Express): Promise<express.Express> {
        app.get("/whoami", (request, response) => {
            this.logRequest(request);
            response.status(200).json({
                user: (request as RequestWithAuthentication).auth.user,
                hasAribaUser: !!(request as RequestWithAuthentication).auth.aribaUsername,
                hasAribaPasswort: !!(request as RequestWithAuthentication).auth.aribaPassword,
            }).end();
        });

        app.get("/orders/:id/status", this.callAriba(
            (params, ariba) => ariba.getPurchaseOrderStatus("" + params.id),
            false,
        ));

        app.post("/orders/:id/confirm", this.callAriba((params, ariba) => {
            return ariba.confirmPurchaseOrder(
                "" + params.id,

                // if omitted, estimate the delivery and shipping dates
                params.estimatedDeliveryDate
                    ? "" + params.estimatedDeliveryDate
                    : new Date(Date.now() + 7 * DAY).toUTCString(),
                params.estimatedShippingDate
                    ? "" + params.estimatedShippingDate
                    : new Date(Date.now() + 2 * DAY).toUTCString(),

                "" + params.supplierOrderId,
            );
        }, true));

        app.post("/orders/:id/shipping-notice", this.callAriba((params, ariba) => {
            return ariba.createShippingNotice(
                (params.id ? params.id + "" : ""),
                (params.packingSlipId ? params.packingSlipId + "" : ""),
                (params.carrierName ? params.carrierName + "" : ""),
                (params.trackingNumber ? params.trackingNumber + "" : ""),
                (params.trackingUrl ? params.trackingUrl + "" : ""),
                // if omitted, estimate the delivery and shipping dates
                (params.estimatedDeliveryDate
                    ? new Date("" + params.estimatedDeliveryDate)
                    : new Date(Date.now() + 5 * DAY)),
                (params.shippingDate
                    ? new Date("" + params.shippingDate)
                    : new Date(Date.now())),
            );
        }, true));

        return app;
    }

    private extractAribeWebsiteFromRequest(request: express.Request): IAribaWebsite | undefined {
        return (request as RequestWithAribaWebsite).aribaWebsite;
    }

    private callAriba<T>(
        aribaCaller: (params: Record<string, unknown>, ariba: IAribaWebsiteApi, taskControl?: ITaskManagerTaskControl) => PromiseLike<T>,
        isLongRunning?: boolean,
    ): express.RequestHandler {

        return (request, response, next) => {
            this.logRequest(request);

            let bodyParams: Record<string, unknown> = {};
            if (request.body && typeof request.body === "object") {
                bodyParams = { ...request.body };
            }

            const ariba = this.extractAribeWebsiteFromRequest(request);

            if (!ariba) {
                sendResponseError(response)("No Ariba website wrapper has been initialised!");

            } else {
                const taskManager = getTaskManagerFromRequest(request);

                if (isLongRunning && taskManager) {
                    const command: Task = (taskControl) => {
                        return ariba
                            .startSession()
                            .then(taskControl.checkAndPass)
                            .then((webSite) => webSite.getAribaWebsiteApi())
                            .then(taskControl.checkAndPass)
                            .then((api) => aribaCaller({ ...bodyParams, ...request.query, ...request.params }, api, taskControl))
                            .then(
                                (data) =>
                                    ((response) => sendResponseJson(response)(data)) as TLongRunningTaskResultGenerator,
                                (error: HttpError) =>
                                    ((response) => sendResponseError(response)(error)) as TLongRunningTaskResultGenerator,
                            )
                        ;
                    };

                    taskManager.executeLongRunningTask(command, request, response, next);

                } else {
                    ariba
                        .startSession()
                        .then((webSite) => webSite.getAribaWebsiteApi())
                        .then((api) => aribaCaller({ ...bodyParams, ...request.query, ...request.params }, api))
                        .then(sendResponseJson(response))
                        .catch(sendResponseError(response));
                }
            }
        };
    }
}
