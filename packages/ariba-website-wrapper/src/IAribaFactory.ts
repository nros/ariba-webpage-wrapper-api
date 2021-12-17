import type { Browser, Page } from "puppeteer";
import type { Logger } from "winston";

import type { IAribaConfiguration } from "./IAribaConfiguration.js";
import type { IAribaWebsiteApiWithLogin } from "./IAribaWebsiteApiWithLogin.js";
import type { IInvoicePage } from "./IInvoicePage.js";
import type { ILoginPage } from "./ILoginPage.js";
import type { IPageFormHelper } from "./IPageFormHelper.js";
import type { IPageHelpers } from "./IPageHelpers.js";
import type { IPurchaseOrderPage } from "./IPurchaseOrderPage.js";

/**
 * The factory used with the Ariba website wrapper.
 */
export interface IAribaFactory {
    /**
     * Get the configuration data to use.
     */
    readonly config: IAribaConfiguration;

    /**
     * Get the singleton browser instance to use.
     *
     * <p>
     *     A new browser instance is created if none has been used yet.
     * </p>
     */
    getBrowser(): Promise<Browser>;

    /**
     * Create a new Ariba website wrapper that builds an API.
     */
    createAribaWebsiteApi(page: Page): Promise<IAribaWebsiteApiWithLogin>;

    /**
     * Create a new browser page
     */
    createNewPage(): PromiseLike<Page>;

    /**
     * Close the browser instance and free all system resources.
     */
    close(): Promise<void>;

    /**
     * Get the singleton page helper class that provides additional helper functions.
     */
    getPageHelper(): IPageHelpers;

    getFormHelper(): IPageFormHelper;

    /**
     * create a new logger for the provided class name
     */
    createLogger(className: string): Logger;

    createPurchaseOrderPage(page: Page): Promise<IPurchaseOrderPage>;
    createLoginPage(page: Page): Promise<ILoginPage>;
    createInvoicePage(page: Page): Promise<IInvoicePage>;
}
