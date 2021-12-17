import type { Page } from "puppeteer";
import type { IAribaPage } from "./IAribaPage.js";

/**
 * The base interface for all wrappers of Ariba website pages.
 */
export interface IAribaDialogPage extends IAribaPage {
    /**
     * Press "Done" on Ariba dialog
     */
    closeDialog(page: Page): Promise<IAribaDialogPage>;
}
