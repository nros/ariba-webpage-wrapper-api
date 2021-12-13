import type { IMiddlewareNeedsTimer } from "./IMiddlewareNeedsTimer";

export interface HttpError extends Error { status: number }

export interface IApiServer {
    readonly port: number;

    /**
     * Start the API server
     */
    start(): Promise<IApiServer>;
    stop(): Promise<IApiServer>;

    registerTimerEvent(middleware: IMiddlewareNeedsTimer, interval: number) : void;
    registerCloseCleanup(callback: () => void) : void;
}
