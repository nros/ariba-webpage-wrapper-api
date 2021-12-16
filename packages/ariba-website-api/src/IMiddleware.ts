import type express from "express";
import type { IApiServer } from "./IApiServer";

export interface IMiddleware {
    registerMiddleware(app: express.Express, apiServer: IApiServer): PromiseLike<express.Express>;
    close(): void;
}
