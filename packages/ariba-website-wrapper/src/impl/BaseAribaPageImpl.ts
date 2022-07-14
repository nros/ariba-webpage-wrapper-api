import type { Page } from "puppeteer";
import type { Logger } from "winston";
import type { IAribaConfiguration } from "../IAribaConfiguration.js";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { IAribaPage, PageWithClient } from "../IAribaPage.js";
import type { IPageFormHelper } from "../IPageFormHelper.js";
import type { IPageHelpers } from "../IPageHelpers.js";


import * as os from "os";


/**
 * The base interface for all wrappers of Ariba website pages.
 */
export abstract class BaseAribaPageImpl implements IAribaPage {
    private readonly _currentPage: PageWithClient;
    private readonly _myLogger: Logger;
    private readonly _myFactory: IAribaFactory;

    public constructor(factory: IAribaFactory, page: PageWithClient) {
        this._myFactory = factory;
        this._currentPage = page;
        this._myLogger = factory.createLogger(this.loggerName);

        if (!factory) {
            throw new Error("No factory has been provided!");
        }
        if (!page) {
            throw new Error("No page has been provided!");
        }
    }

    public get page(): PageWithClient {
        return this._currentPage;
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
        const logger = this._factory.createLogger("BaseAribaPageImpl");

        logger.info("Navigating to dashboard");
        const page = await this.page;

        // reset to blank page to force a reload of the home page
        if (page.url() !== "about:blank") {
            logger.debug("Opening blank page about:blank to clean current URL!");
            try {
                await page.goto("about:blank");
                await page.waitForNetworkIdle({ timeout: 500 });
            } catch (error) {
                /* ignore this error, it's just the blank page */
            }
        }

        try {
            logger.debug("Opening overview page URL.");
            await page.goto(this.config.overviewPageUrl);
            await this.loginIfRequired(page, () => page.goto(this.config.overviewPageUrl));
            await page.waitForSelector("app-dashboard .search-container", { timeout: 10000 });
        } catch (error) {
            console.error("Failed to navigate to home screen:", error);
        }

        return this;
    }

    public get loggerName(): string {
        throw new Error("Property 'loggerName' MUST be implemented by base classes");
    }

    public async setDownloadDirectory(downloadTargetDirectory?: string): Promise<IAribaPage> {
        if (!downloadTargetDirectory) {
            downloadTargetDirectory = this.config?.downloadDirectory || os.tmpdir();
        }

        // see: https://medium.com/stackfame/get-list-of-all-files-in-a-directory-in-node-js-befd31677ec5
        // see: https://www.scrapingbee.com/blog/download-file-puppeteer/
        // see: https://github.com/puppeteer/puppeteer/issues/7173
        await this.page._client().send("Page.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: downloadTargetDirectory,
        } as any); // TypeScript does not recognise the proper type yet.

        return this;
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
        }, text, tag).catch();

        await this.pageHelper.wait(1);

        this.createLogger("BaseAribaPageImpl").debug(`Click on first button (tag: ${tag}) with text ${text}`);
        await page.evaluate((text, tag) => {
            const $button = jQuery(tag + ":contains('" + text + "'):first");
            if ($button.length === 0) {
                throw new Error("Button can not be found. selector: \"" + tag + ":contains('" + text + "'):first\"");
            }
            window.ariba.Handlers.fakeClick($button[0]);
        }, text, tag);

        await this.pageHelper.wait(1);

        return this;
    }

    protected wait(milliseconds: number): Promise<void> {
        this.createLogger(`Waiting ${milliseconds} milliseconds ...`);
        return new Promise((resolve: () => void) => {
            setTimeout(resolve, milliseconds);
        });
    }

    protected async loginIfRequired(page: PageWithClient, openExpectedPage: () => Promise<unknown>): Promise<void> {
        const loginPage = await this._factory.createLoginPage(page);
        if (await loginPage.isLoginPage(page)) {
            await loginPage.login();

            if (typeof openExpectedPage === "function") {
                await (openExpectedPage().catch((error) => {
                    console.error(error);
                    Promise.reject(error);
                }));
            }
        }
    }
}
