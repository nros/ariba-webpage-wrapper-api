import type express from "express";
import type { IApiServer } from "./IApiServer";

export interface IMiddleware {
    registerMiddleware(app: express.Express, apiServer: IApiServer): Promise<express.Express>;
    close(): void;
}
