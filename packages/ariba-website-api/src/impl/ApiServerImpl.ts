/// <reference types="node" />
import type * as http from "http";
import type { ParsedQs } from "qs";
import type { IAribaWebsite, IAribaWebsiteApi } from "ariba-website-wrapper";
import type { RequestWithAribaWebsite } from "./AribaApiMiddleware";
import type { HttpError, IApiServer } from "../IApiServer";
import type { IMiddlewareNeedsTimer } from "../IMiddlewareNeedsTimer";
import type { RequestWithAuthentication } from "./AuthenticatorJsonImpl";

import express from "express";
import bodyParser from "body-parser";
import nocache from "nocache";

import { AuthenticatorJsonImpl } from "./AuthenticatorJsonImpl";
import { ConfigMiddleware } from "./ConfigMiddleware";
import { AribaApiMiddleware } from "./AribaApiMiddleware";

const DAY = 1000 * 60 * 60 * 24;

export class ApiServerImpl implements IApiServer {
    private _server?: http.Server;
    private _app?: express.Express;
    private _configMiddleware: ConfigMiddleware;
    private _timers: ReturnType<typeof setInterval>[] = [];
    private _timersAtStart: Array<() => void> = [];
    private _cleanUpOnClose: Array<() => void> = [];

    public constructor(configFile?: string) {
        this._configMiddleware = new ConfigMiddleware(configFile);
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

        app = await new AuthenticatorJsonImpl().registerMiddleware(app, this);
        app = await this._configMiddleware.registerMiddleware(app, this);
        app = await new AribaApiMiddleware().registerMiddleware(app, this);
        app = await this.registerApiHandlers(app);

        expressAppServer.use("/api", app);
        expressAppServer.use("/", function (request, response) {
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

    protected async registerApiHandlers(app: express.Express): Promise<express.Express> {
        app.get("/whoami", (request, response) => {
            response.status(200).json({
                user: (request as RequestWithAuthentication).auth.user,
                hasAribaUser: !!(request as RequestWithAuthentication).auth.aribaUsername,
                hasAribaPasswort: !!(request as RequestWithAuthentication).auth.aribaPassword,
            }).end();
        });

        app.get("/orders/:id/status", this.callAriba((params, ariba) =>
            ariba.getPurchaseOrderStatus("" + params.id)
        ));

        app.post("/orders/:id/confirm", this.callAriba((params, ariba) =>
            ariba.confirmPurchaseOrder(
                "" + params.id,

                // if omitted, estimate the delivery and shipping dates
                params.estimatedDeliveryDate
                    ? "" + params.estimatedDeliveryDate
                    : new Date(Date.now() + 7 * DAY).toUTCString(),
                params.estimatedShippingDate
                    ? "" + params.estimatedShippingDate
                    : new Date(Date.now() + 2 * DAY).toUTCString(),

                "" + params.supplierOrderId,
            )
        ));

        app.post("/orders/:id/shipping-notice", this.callAriba((params, ariba) =>
            ariba.createShippingNotice(
                (params.id && params.id + "") || "",
                (params.packingSlipId && params.packingSlipId + "") || "",
                (params.carrierName && params.carrierName + "") || "",
                (params.trackingNumber && params.trackingNumber + "") || "",
                (params.trackingUrl && params.trackingUrl + "") || "",
                // if omitted, estimate the delivery and shipping dates
                (params.estimatedDeliveryDate && new Date("" + params.estimatedDeliveryDate)) ||
                new Date(Date.now() + 5 * DAY),
                (params.shippingDate && new Date("" + params.shippingDate)) ||
                new Date(Date.now()),
            )
        ));

        return app;
    }

    private extractAribeWebsiteFromRequest(request: express.Request): IAribaWebsite | undefined {
        return (request as RequestWithAribaWebsite).aribaWebsite;
    }

    private callAriba<T>(
        aribaCaller: (params: ParsedQs, ariba: IAribaWebsiteApi) => PromiseLike<T>,
    ): express.RequestHandler {
        return (request, response, next) => {
            const ariba = this.extractAribeWebsiteFromRequest(request);

            if (!ariba) {
                response.status(500).json({
                    message: "No Ariba website wrapper has been initialised!",
                });

            } else {
                ariba.startSession()
                    .then((webSite) => webSite.getAribaWebsiteApi())
                    .then((api) =>
                        aribaCaller({ ...request.query, ...request.params}, api).then(
                            (responseBody) => response.status(200).json(responseBody),
                            (error: HttpError) => response.json({ message: "" + error }).sendStatus(error.status || 500),
                        ).then(() => response.end(), console.error),

                        console.error
                    )
                ;
            }
        };
    }
}
