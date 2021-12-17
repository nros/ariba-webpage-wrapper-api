import type { Logger } from "winston";

import type { IAribaConfiguration } from "../IAribaConfiguration.js";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { IAribaWebsite } from "../IAribaWebsite.js";
import type { IAribaWebsiteApi } from "../IAribaWebsiteApi.js";
import type { IAribaWebsiteApiWithLogin } from "../IAribaWebsiteApiWithLogin.js";

import { AribaFactoryImpl } from "./AribaFactoryImpl.js";

/**
 * A wrapper around a browser instance to drive the Ariba webshop.
 *
 * <p>
 * Since the authenticated session is strongly bound to a single browser instance, a new such instance must be
 * created with every login credentials supplied. Never mix the same instance with different credentials!
 * </p>
 */
export class AribaWebsiteImpl implements IAribaWebsite {
    private _myFactory?: IAribaFactory;
    private _myLogger?: Logger;
    private _api?: IAribaWebsiteApiWithLogin;

    public init(config: IAribaConfiguration): IAribaWebsite {
        this._myFactory = new AribaFactoryImpl(config);
        return this;
    }

    get config(): IAribaConfiguration {
        return this._factory.config;
    }

    public async startSession(): Promise<IAribaWebsite> {
        this._logger.info("Starting operations session.");

        if (!this._api) {
            this._logger.debug("Creating session page.");
            this._api = await this._factory.createAribaWebsiteApi(await this._factory.createNewPage());
        } else {
            this._logger.debug("An operation page already exists.");
        }

        // login
        await this._api.login();
        return this;
    }

    public async stopSession(): Promise<IAribaWebsite> {
        this._logger.info("Stopping login session if some exists.");
        if (this._api) {
            await this._api.page.close();
            this._api = undefined;
        }

        return this;
    }

    public async close(): Promise<void> {
        this._logger.error("CLOSING Ariba", new Error("Closing Ariba session!"));

        await this.stopSession();
        if (this._myFactory) {
            await this._myFactory.close();
        }
    }

    public async getAribaWebsiteApi(): Promise<IAribaWebsiteApi> {
        if (this._api) {
            return Promise.resolve(this._api);
        }

        throw new Error("No session has been started, so no API is available");
    }

    protected get _logger(): Logger {
        if (!this._myLogger) {
            this._myLogger = this._factory.createLogger("AribaWebsiteImpl");
        }

        return this._myLogger;
    }

    protected get _factory(): IAribaFactory {
        if (!this._myFactory) {
            throw new Error("The Ariba Website has not been properly initialised! Please call 'init' at first!");
        }

        return this._myFactory;
    }
}
