import type { Browser, Page } from "puppeteer";
import type { Logger } from "winston";

import type { IAribaConfiguration } from "./IAribaConfiguration";
import type { IAribaWebsiteApi } from "./IAribaWebsiteApi";
import type { ILoginPage } from "./ILoginPage";
import type { IPageFormHelper } from "./IPageFormHelper";
import type { IPageHelpers } from "./IPageHelpers";
import type { IPurchaseOrderPage } from "./IPurchaseOrderPage";

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
    createAribaWebsiteApi(): Promise<IAribaWebsiteApi>;

    /**
     * Create a new browser page
     */
    createNewPage(): Promise<Page>;

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

    createPurchaseOrderPage(): Promise<IPurchaseOrderPage>;
    createLoginPage(): Promise<ILoginPage>;
}
