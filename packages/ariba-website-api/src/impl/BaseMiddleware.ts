import type express from "express";
import type { IMiddleware } from "../IMiddleware";
import type { IApiServer } from "../IApiServer";
import type { IMiddlewareNeedsTimer } from "../IMiddlewareNeedsTimer";

export type TAsyncMiddleware = (request: express.Request, response: express.Response) => Promise<void>;

export abstract class BaseMiddleware implements IMiddleware {
    public async registerMiddleware(app: express.Express, apiServer: IApiServer): Promise<express.Express> {
        // enhance the request object with ariba website
        const allMiddlewareToAdd = await (this.getMiddleware()) || [];
        for (const middleware of allMiddlewareToAdd) {
            app = await this.registerAsyncMiddleware(app, middleware);
        }

        if (typeof (this as unknown as IMiddlewareNeedsTimer).timerEvent === "function") {
            const needsTimer = this as unknown as IMiddlewareNeedsTimer;
            apiServer.registerTimerEvent(needsTimer, needsTimer.timerInterval);
        }

        apiServer.registerCloseCleanup(() => this.close());

        return app;
    }

    public close(): void { }

    protected abstract getMiddleware(): Promise<TAsyncMiddleware[]>;

    protected async registerAsyncMiddleware(
        app: express.Express,
        middleware: TAsyncMiddleware,
    ) : Promise<express.Express> {
        app.use((request, response, next) => {
            middleware(request, response).then(() => next(), (error) => response.status(500).json(error))
        });

        return app;
    }
}