import type { Page } from "puppeteer";
import type { Logger } from "winston";
import type { IAribaConfiguration } from "../IAribaConfiguration.js";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { IAribaPage } from "../IAribaPage.js";
import type { IPageFormHelper } from "../IPageFormHelper.js";
import type { IPageHelpers } from "../IPageHelpers.js";

/**
 * The base interface for all wrappers of Ariba website pages.
 */
export abstract class BaseAribaPageImpl implements IAribaPage {
    private _currentPage?: Page;
    private _myLogger: Logger;
    private _myFactory: IAribaFactory;

    public constructor(factory: IAribaFactory, page?: Page) {
        this._myFactory = factory;
        this._currentPage = page;
        this._myLogger = factory.createLogger(this.loggerName);
    }

    public get currentPage(): Promise<Page> {
        if (!this._currentPage) {
            return this._factory.createNewPage()
                .then((newPage) => {
                    this._currentPage = newPage;
                    return newPage;
                });
        } else {
            return Promise.resolve(this._currentPage);
        }
    }

    public get config(): IAribaConfiguration {
        return this._factory.config;
    }

    public get pageHelper(): IPageHelpers {
        return this._factory.getPageHelper();
    }

    public get pageFormHelper(): IPageFormHelper {
        return this._factory.getFormHelper();
    }

    public async navigateToHome(): Promise<IAribaPage> {
        this._logger.info("Navigating to dashboard");
        const page = await this.currentPage;

        // reset to blank page to force a reload of the home page
        this._logger.debug("Opening blank page about:blank to clean current URL!");
        await page.goto("about:blank");
        await page.waitForNetworkIdle();

        this._logger.debug("Opening overview page URL.");
        await page.goto(this.config.overviewPageUrl);

        // the home page has multiple redirect and sometimes blocks loading some unimportant assets.
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // check to see if the session was still active or a login is needed
        await page.waitForSelector("div.dashboard-container")
            .catch((error) => Promise.reject(new Error("Session has expired! Please login again! " + error)))
        ;

        return this;
    }

    public async close(): Promise<IAribaPage> {
        if (this._currentPage) {
            await this._currentPage.close();
            this._currentPage = undefined;
        }

        return this;
    }

    public get loggerName(): string {
        throw new Error("Property 'loggerName' MUST be implemented by base classes");
    }

    protected get _factory(): IAribaFactory {
        return this._myFactory;
    }

    protected get _logger(): Logger {
        return this._myLogger;
    }

    protected createLogger(name: string): Logger {
        return this._factory.createLogger(name);
    }

    protected async deleteAllCookies(): Promise<IAribaPage> {
        this._logger.debug("Cleaning the cookies!");

        const page = await this.currentPage;
        const cookies = await page.cookies();
        for (const cookie of cookies) {
            this._logger.debug("Deleting cookie " + cookie.name);
            await page.deleteCookie(cookie);
        }

        return this;
    }

    protected async clickButtonWithText(page: Page, text: string, tag?: string): Promise<IAribaPage> {
        tag = tag || "button";

        const logger = this.createLogger("BaseAribaPageImpl");

        logger.debug(`Wait for button (tag: ${tag}) with text ${text}`);
        await page.evaluate((text, tag) => {
            async function waitForButton(remainingTries: number): Promise<void> {
                const $button = jQuery(tag + ":contains('" + text + "'):first");
                if ($button.length === 0 && remainingTries > 0) {
                    return new Promise((resolve) => setTimeout(resolve, 200))
                        .then(() => waitForButton(remainingTries--));

                } else if ($button.length === 0) {
                    return Promise.reject(new Error("Button (tag: " + tag + ") with text '" + text + "' not found"));
                }
                return Promise.resolve();
            }

            return waitForButton(30);
        }, text, tag);


        this.createLogger("BaseAribaPageImpl").debug(`Click on first button (tag: ${tag}) with text ${text}`);
        await page.evaluate((text, tag) => {
            const $button = jQuery(tag + ":contains('" + text + "'):first");
            if ($button.length === 0) {
                throw new Error("Button can not be found. selector: \"" + tag + ":contains('" + text + "'):first\"");
            }
            window.ariba.Handlers.fakeClick($button[0]);
        }, text, tag);

        return this;
    }

    protected wait(milliseconds: number): Promise<void> {
        this.createLogger(`Waiting ${milliseconds} milliseconds ...`);
        return new Promise((resolve: () => void) => {
            setTimeout(resolve, milliseconds);
        });
    }
}
