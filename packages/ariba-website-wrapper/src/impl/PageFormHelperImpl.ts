import type { Page } from "puppeteer";
import type { Logger } from "winston";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { IPageHelpers } from "../IPageHelpers.js";

export class PageFormHelperImpl implements PageFormHelperImpl {
    private _factory: IAribaFactory;
    private _logger: Logger;

    public constructor(factory: IAribaFactory) {
        this._factory = factory;
        this._logger = factory.createLogger("PageFormHelperImpl");
    }

    public async setFilterMaximumListSize(page: Page): Promise<Page> {
        this._logger.info("Set search result list to maximum!");

        // select maximum of 500 per list
        try {
            this._logger.debug("Wait filter form footer to become available.");
            await page.waitForSelector("td.SearchFooter .w-dropdown:first-child");

            this._logger.debug("Setting maxium number of search items to 500.");
            await this.selectDropdownValue(
                page,
                "td.SearchFooter .w-dropdown",
                ".w-dropdown-item:last",
            );

        } catch (err) {
            this._logger.error("Failed to set the size of the list: " + (err as Error).message);
        }

        return page;
    }

    public async pressFilterSearchButton(page: Page): Promise<Page> {
        this._logger.info("Submit filter search form.");

        await this.pageHelper.deactivateAribaClickCheck(page);
        await page.evaluate(() => {
            jQuery("button:contains('Search')").trigger("click");
        });

        // some XHR takes place
        this._logger.debug("Wait for XHR after submitting purchase order search.");
        await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => true);

        return page;
    }

    /**
     * Sets the date range filter to the maximum days (32) or to "none".
     *
     * @param page the page to operate on.
     * @param isUseNone (optional) if {@code true}, then the date range is set to "none" of the page supports that.
     * @private
     */
    public async setFilterDateRange(page: Page, isUseNone?: boolean): Promise<Page> {
        this._logger.info(`Setting purchase order filter date range to ${isUseNone ? "None" : "maximum"}.`);

        if (!page) {
            return Promise.reject(new Error("Provided page is undefined!"));
        }

        // --- set the search time frame
        // open the advanced pane
        this._logger.debug("Set purchase order filter date range.");
        (await page.evaluate((isUseNone) => {
            let timeRangeNode: HTMLElement | undefined;
            let days = 0;

            const nodes = document.querySelectorAll(".w-dropdown-item");
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i] as HTMLElement;

                if (isUseNone && /None/i.test("" + node.innerText)) {
                    timeRangeNode = node;

                } else if (!isUseNone && /(?:Last|Next)\s*([0-9]+)\s*days?/i.test("" + node.innerText)) {
                    const newDays = +RegExp.$1;
                    if (newDays > days) {
                        timeRangeNode = node;
                        days = newDays;
                    }
                }
            }

            if (timeRangeNode?.parentNode?.parentNode) {
                window.ariba?.AWWidgets?.DropDown?.openDropdown(
                    jQuery(timeRangeNode.parentNode.parentNode),
                );

                setTimeout(() => window.ariba?.AWWidgets?.DropDown?.dropDownMenuAction(
                    timeRangeNode,
                    null,
                ), 20);
            } else {
                throw new Error("No time range can be found!");
            }
        }, !!isUseNone));

        // the drop down triggers an XHR load from the server
        this._logger.debug("Waiting XHR to happen after setting purchase order filter date range.");
        await page.waitForNavigation({ waitUntil: "networkidle0" });

        return page;
    }


    public async setFilterOpen(page: Page): Promise<Page> {
        this._logger.info("Opening purchase order filter form.");

        if (!page) {
            return Promise.reject(new Error("Provided page is undefined!"));
        }

        this._logger.debug("Wait for the purchase order filter form header to become available.");
        await page.waitForSelector("table.SearchHeader a .search-label");

        // open search filters to receive more list items
        this._logger.debug("Open the purchase order filter form.");
        await this.pageHelper.deactivateAribaClickCheck(page);
        (await page.waitForSelector("table.SearchHeader a .search-label"))?.click();

        this._logger.debug("Wait for XHR after activating purchase order filter form.");
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        return page;
    }

    public async selectDropdownValue(
        page: Page,
        dropdownGroupSelector: string,
        dropdownItemSelector: string,
    ): Promise<Page> {

        // select maximum of 500 per list
        this._logger.debug(`Wait for drop down group ${dropdownGroupSelector} become available.`);
        await page.waitForSelector(dropdownGroupSelector);

        this._logger.debug("Selecting dropdown item.");
        await page.evaluate((dropdownGroupSelector, dropdownItemSelector) => {
            const dropDownItem = jQuery(dropdownGroupSelector);
            window.ariba.AWWidgets.DropDown.openDropdown(dropDownItem);

            setTimeout(() => window.ariba.AWWidgets.DropDown.dropDownMenuAction(
                dropDownItem.find(dropdownItemSelector),
                null,
            ), 20);
        }, dropdownGroupSelector, dropdownItemSelector);

        return page;
    }

    private get pageHelper(): IPageHelpers {
        return this._factory.getPageHelper();
    }
}
