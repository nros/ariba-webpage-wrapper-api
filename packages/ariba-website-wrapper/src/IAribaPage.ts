import type { Page } from "puppeteer";
import type { IAribaConfiguration } from "./IAribaConfiguration.js";

/**
 * The base interface for all wrappers of Ariba website pages.
 */
export interface IAribaPage {
    /**
     * The browser page this page wrapper operates on.
     */
    readonly page: Page;

    /**
     * The configuration of the ariba wrapper
     */
    readonly config: IAribaConfiguration;

    /**
     * Go to the main start page of the website, using the current browser page.
     */
    navigateToHome(): Promise<IAribaPage>

    /**
     * Returns the class name of the sub class, which is used for logging purposes.
     * @protected
     */
    readonly loggerName: string;

    /**
     * Sets the directory for automatic downloads
     * @param downloadTargetDirectory (optional) the full path directory to download files to. If omitted, then
     *     {@link IAribaConfiguration.downloadDirectory} is used instead.
     */
    setDownloadDirectory(downloadTargetDirectory?: string): Promise<IAribaPage>;
}
