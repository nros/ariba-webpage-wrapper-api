import type { Page } from "puppeteer";

export interface IPageHelpers {
    /**
     * Ariba tries to avoid scrapers from creating fake clicks by recording mouse down/up events.
     * This function will set attributes on the element to click to out-smart this test.
     *
     * @param selector the CSS selector to find the element.
     * @return a function to be executed in the evaluation context of the browser page
     */
    deactivateAribaClickCheck(page: Page): Promise<Page>;

    /**
     * Loads JQuery into the Ariba page if it is not available.
     */
    loadJQuery(page: Page): Promise<Page>;
}
