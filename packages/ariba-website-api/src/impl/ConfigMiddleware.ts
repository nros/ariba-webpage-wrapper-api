import type express from "express";
import type { IMiddleware } from "../IMiddleware.js";
import type { IApiConfiguration } from "../ApiConfiguration.js";

import { readConfiguaration } from "../ApiConfiguration.js";
import { IApiServer } from "../IApiServer.js";

export type RequestWithConfig = express.Request & {
    apiConfig: IApiConfiguration;
};

export class ConfigMiddleware implements IMiddleware {
    private _configFileName?: string;
    private _configuration?: IApiConfiguration;

    public constructor(configFileName?: string) {
        this._configFileName = configFileName;
    }

    public get configuration(): IApiConfiguration | undefined {
        return this._configuration;
    }

    public async registerMiddleware(app: express.Express, apiServer: IApiServer): Promise<express.Express> {

        if (!this._configuration) {
            this._configuration = (await readConfiguaration(this._configFileName)) || {};
        }

        // add the configuration to the request
        app.use((request, response, next) => {
            (request as RequestWithConfig).apiConfig = {
                ...this._configuration,
            } as IApiConfiguration;

            next();
        });

        return app;
    }

    public close(): void {
        // nothing to do in the base class.
    }
}
