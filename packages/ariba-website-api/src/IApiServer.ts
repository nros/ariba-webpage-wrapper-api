import type { IMiddlewareNeedsTimer } from "./IMiddlewareNeedsTimer";

export interface HttpError extends Error { status: number }

export interface HttpResponseErrorMessage {
    error: number;
    message: string;
}

export interface IApiServer {
    readonly port: number;

    /**
     * Start the API server
     */
    start(): PromiseLike<IApiServer>;
    stop(): PromiseLike<IApiServer>;

    registerTimerEvent(middleware: IMiddlewareNeedsTimer, interval: number) : void;
    registerCloseCleanup(callback: () => void) : void;
}
