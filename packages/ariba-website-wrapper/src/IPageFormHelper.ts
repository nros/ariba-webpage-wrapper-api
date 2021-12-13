import type { Page } from "puppeteer";

export interface IPageFormHelper {
    setFilterMaximumListSize(page: Page): Promise<Page>;

    /**
     * Performs the search as set by the filter settings.
     *
     * @param page the page to operate on.
     */
    pressFilterSearchButton(page: Page): Promise<Page>;

    /**
     * Sets the date range filter to the maximum days (32) or to "none".
     *
     * @param page the page to operate on.
     * @param isUseNone (optional) if {@code true}, then the date range is set to "none" of the page supports that.
     * @private
     */
    setFilterDateRange(page: Page, isUseNone?: boolean): Promise<Page>;


    setFilterOpen(page: Page): Promise<Page>;
}
