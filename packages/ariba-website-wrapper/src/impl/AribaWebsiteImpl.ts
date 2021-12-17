import type { Logger } from "winston";

import type { IAribaConfiguration } from "../IAribaConfiguration.js";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { IAribaWebsite } from "../IAribaWebsite.js";
import type { IAribaWebsiteApi } from "../IAribaWebsiteApi.js";
import type { ILoginPage } from "../ILoginPage.js";

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
    private _loginPage?: ILoginPage;

    public init(config: IAribaConfiguration): IAribaWebsite {
        this._myFactory = new AribaFactoryImpl(config);
        return this;
    }

    get config(): IAribaConfiguration {
        return this._factory.config;
    }

    public async startSession(): Promise<IAribaWebsite> {
        this._logger.info("Starting login session.");

        if (!this._loginPage) {
            this._logger.debug("Creating new login session.");
            this._loginPage = await this._factory.createLoginPage();
        } else {
            this._logger.debug("A session already exists.");
        }

        await this._loginPage.startSession();
        return this;
    }

    public async stopSession(): Promise<IAribaWebsite> {
        this._logger.info("Stopping login session if some exists.");

        if (this._loginPage) {
            await this._loginPage.stopSession();

            this._logger.debug("Closing login page session.");
            await this._loginPage.close();
            this._loginPage = undefined;
        }

        return this;
    }

    public async close(): Promise<void> {
        await this.stopSession();
        if (this._myFactory) {
            await this._myFactory.close();
        }
    }

    public getAribaWebsiteApi(): Promise<IAribaWebsiteApi> {
        return this._factory.createAribaWebsiteApi();
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
