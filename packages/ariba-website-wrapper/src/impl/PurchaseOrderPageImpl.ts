import type { Page } from "puppeteer";
import type { IPurchaseOrder } from "../IPurchaseOrder";
import { TPurchaseOrderState } from "../IPurchaseOrder";
import type { IPurchaseOrderPage } from "../IPurchaseOrderPage";
import { BaseAribaDialogPageImpl } from "./BaseAribaDialogPageImpl";


export class PurchaseOrderPageImpl extends BaseAribaDialogPageImpl implements IPurchaseOrderPage {
    //

    public get loggerName(): string {
        return "PurchaseOrderPageImpl";
    }

    public async getOrderStatus(purchaseOrderId: string): Promise<TPurchaseOrderState> {
        //
        this._logger.info(`Get status of purchase order with ID ${purchaseOrderId}.`);
        await this.navigateToPurchaseOrder(purchaseOrderId);

        const page = await this.currentPage;

        this._logger.debug(`Read order status with jQuery`);
        const status = await page.evaluate(() =>
            window.jQuery(".poHeaderStatusStyle").text().replace(/[)(]/g, "").toLowerCase().trim(),
        );

        switch (status) {
        case "new":
            return TPurchaseOrderState.NEW;
        case "confirmed":
            return TPurchaseOrderState.CONFIRMED;
        default:
            throw new Error("Failed to read status of order. Status is unknown: " + status);
        }
    }

    public async confirmPurchaseOrder(
        purchaseOrderId: string,
        estimatedDeliveryDate: Date,
        estimatedShippingDate?: Date,
        supplierOrderId?: string,
    ): Promise<IPurchaseOrder | undefined> {
        //
        this._logger.info(`Confirming purchase order with ID ${purchaseOrderId}.`);

        // first, check order status. In case of error, assume already confirmed
        const state = await this.getOrderStatus(purchaseOrderId).catch(() => TPurchaseOrderState.CONFIRMED);
        if (state !== TPurchaseOrderState.NEW) {
            return {
                id: purchaseOrderId,
                state,
            };
        }


        const page = await this.currentPage;

        // find the button to open the confirm sub menu
        this._logger.info("Wait for the purchase order confirmation button.");
        (await page.waitForSelector("button[title*='Create'][title*='order confirmation']"));

        this._logger.info(`Activate the submenu of the purchase order confirmation button.`);
        await page.evaluate(() => window.ariba.Menu.PML.click(
            jQuery("button[title*='Create'][title*='order confirmation']")
                // for some reason, more than a single button is available in the page. Only the last one
                // is visible, but ":visible" does not filter the others.
                .last()
                .parents(".w-pulldown-button")
                .first()[0],
        ));

        this._logger.info(`Activate "Confirm entire order".`);
        await this.pressConfirmOrderButtonOnPurchaseOrderDetailPage(page, "Confirm");

        // fill in the required values
        if (supplierOrderId) {
            this._logger.debug(`Setting supplier order ID: ${supplierOrderId}`);
            await page.focus("input[help-id='EnableNowHelpID-SupplierReference']");
            await page.keyboard.type("" + supplierOrderId);
        }

        this._logger.debug(`Setting confirmation order ID: ${purchaseOrderId}-confirm`);
        await page.focus("input[help-id='EnableNowHelpID-ConfirmationNum']");
        await page.keyboard.type(`${purchaseOrderId}-confirm`);

        if (estimatedShippingDate) {
            this._logger.debug(`Setting estimated shipping date: ${estimatedShippingDate}`);

            await page.evaluate((dateString) => {
                const dateTime = new Date("" + dateString);
                const dateFormatter = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" });
                const value = dateFormatter.format(dateTime);
                jQuery("td:contains('Est. Shipping Date')").next().find("input").val(value);
            }, "" + estimatedShippingDate);
        }

        this._logger.debug(`Setting estimated delivery date: ${estimatedDeliveryDate}`);
        await page.evaluate((dateString) => {
            const dateTime = new Date("" + dateString);
            const dateFormatter = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" });
            const value = dateFormatter.format(dateTime);
            jQuery("td:contains('Est. Delivery Date')").next().find("input").val(value);
        }, "" + estimatedDeliveryDate);


        // confirm and go to next page
        this._logger.debug("Confirm order and got to next page of form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Next"),
            page.waitForNavigation(),
        ]);

        this._logger.debug("End confirming order form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Submit"),
            await page.waitForNavigation(),
        ]);

        await this.closeDialog(page);

        /*
        const page = await this.currentPage;
        await this.openPurchaseOrderSearchPage(page);

        // open the tab to confirm purchase orders
        await this.pageHelper.deactivateAribaClickCheck(page);
        await page.evaluate(() => {
            const nodes = document.querySelectorAll("a");
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i] as HTMLAnchorElement;

                if (/Items\s*to\s*Confirm/i.test("" + node.innerText)) {
                    setTimeout(() => node.click(), 20);
                    return;
                }
            }
        });

        await page.waitForNavigation();
        await this.setPurchaseOrdersFilterOpen(page);
        await this.setPurchaseOrdersFilterDateRange(page, true);
        await this.setPurchaseOrdersFilterOrderNumber(page, purchaseOrderId);
        await this.pressPurchaseOrdersFilterSearchButton(page);
        */
        return {
            id: purchaseOrderId,
            state: TPurchaseOrderState.CONFIRMED,
        };
    }

    public async navigateToPurchaseOrder(purchaseOrderId: string): Promise<IPurchaseOrderPage> {
        this._logger.info(`Navigate to purchase order (ID: ${purchaseOrderId}) page.`);
        const page = await this.currentPage;

        await this.openPurchaseOrderSearchPage(page);
        await this.setPurchaseOrdersFilterOpen(page);
        await this.setPurchaseOrdersFilterOrderNumber(page, purchaseOrderId);
        await this.pressPurchaseOrdersFilterSearchButton(page);

        // check to see, whether the purchase order has been found
        this._logger.debug(`Finding the link for purchase order (ID: ${purchaseOrderId}) info page.`);
        const purchaseOrderPageLink = await page.evaluate(
            (purchaseOrderId) => jQuery("table.awtWrapperTable a:contains('" + purchaseOrderId + "')")[0],
            purchaseOrderId,
        );

        if (!purchaseOrderPageLink) {
            throw new Error("Did not find link to page of Purchase Order " + purchaseOrderId);
        }

        this._logger.debug(`Activating the link for purchase order (ID: ${purchaseOrderId}) info page.`);
        await this.pageHelper.deactivateAribaClickCheck(page);

        // The returned value is just a local version of a remote HTML anchor element. Thus "click()" does not exist.
        // Hence, the click must happen on the browser side.
        await page.evaluate(
            (purchaseOrderId) => jQuery("table.awtWrapperTable a:contains('" + purchaseOrderId + "')")[0].click(),
            purchaseOrderId,
        );

        // page is loaded via XHR
        this._logger.debug(`Waiting for XHR after opening purchase order infor page (ID: ${purchaseOrderId}).`);
        await page.waitForSelector(".pageHead");
        return this;
    }


    public async openPurchaseOrderSearchPage(page: Page): Promise<Page> {
        this._logger.info("Navigating to purchase order search page");

        if (!page) {
            return Promise.reject(new Error("Provided page is undefined!"));
        }

        // ensure login has been performed
        await this.navigateToHome();

        // wait for the submenu to be available and click it
        this._logger.debug("Wait for Purchase Order menu to be available and open its submenu");
        await this.pageHelper.deactivateAribaClickCheck(page);
        (await page.waitForSelector("#SUPOrder"))?.click();

        // click on link to the list of orders
        this._logger.debug("Activating the menu entry 'Purchase Order Search Page'");
        await Promise.all([
            page.waitForSelector("#INSPOList", { visible: false })
                .then((elem) => {
                    elem?.click();
                    return Promise.resolve();
                }),
            await page.waitForNavigation(),
        ]);

        this._logger.debug("Waiting for the 'Purchase Order Search Page' to become available");
        await page.waitForSelector("td.pageHeadingText");
        return page;
    }

    public async setPurchaseOrdersFilterOpen(page: Page): Promise<Page> {
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

    public async setPurchaseOrdersFilterPoState(page: Page, filterForState: TPurchaseOrderState): Promise<Page> {
        this._logger.info(
            `Setting Purchase Order filter state in filter form to ${TPurchaseOrderState[filterForState]}.`,
        );

        if (!page) {
            return Promise.reject(new Error("Provided page is undefined!"));
        }

        // set the requested state of the orders to read
        try {
            this._logger.debug("Waiting the filter drop down for Purchase Order state to become available.");
            await page.waitForSelector("div[index='20'][bh='DDI']");

            this._logger.debug("Selecting Purchase Order state drop down item.");
            await page.evaluate((filterForState) => {
                const dropDown = jQuery("div[index='20'][bh='DDI']").parents(".w-dropdown[bh='DDM']").first();
                window.ariba?.AWWidgets.DropDown.openDropdown(dropDown);
                setTimeout(() => window.ariba?.AWWidgets.DropDown.dropDownMenuAction(
                    dropDown.find("div[index='" + filterForState + "']").last(),
                    null,
                ), 20);
            }, filterForState);

            this._logger.debug("Waiting for XHR to be performed after setting Purchase Order state drop down value.");
            await page.waitForNavigation({ waitUntil: "networkidle0" });

        } catch (err) {
            this._logger.error("Failed to set status to filter for: " + (err as Error).message);
        }

        /*

        await page.waitForSelector("input[class*='calendar'][bh='DFM']");
        (await page.evaluate(() => {
            const calendarNodes = document.querySelectorAll("input[class*='calendar'][bh='DFM']");
            (calendarNodes[0] as HTMLInputElement).value = "1 Jan 2000";
            window.ariba?.Calendar.dateTextChanged(calendarNodes[0]);
        }));
        */

        /*
        (await page.evaluate(() => {
            const allNodes = document.querySelectorAll("a div");
            for (let i = 0; i < allNodes.length; i++) {
                const node = allNodes[i] as HTMLElement;
                if (/Show\s+Advanced\s+Filters/i.test("" + node.innerText)) {
                    return node.parentNode as HTMLAnchorElement;
                }
            }

            return undefined;
        }))?.click();
        */
        return page;
    }

    /**
     * Sets the date range filter to the maximum days (32) or to "none".
     *
     * @param page the page to operate on.
     * @param isUseNone (optional) if {@code true}, then the date range is set to "none" of the page supports that.
     * @private
     */
    public async setPurchaseOrdersFilterDateRange(page: Page, isUseNone?: boolean): Promise<Page> {
        this._logger.info(`Setting purchase order filter date range to ${isUseNone ? "None" : "maximum"}.`);

        if (!page) {
            return Promise.reject(new Error("Provided page is undefined!"));
        }

        // --- set the search time frame
        // open the advanced pane
        this._logger.debug("Set purchase order filter date range.");
        (await page.evaluate(() => {
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
        }));

        // the drop down triggers an XHR load from the server
        this._logger.debug("Waiting XHR to happen after setting purchase order filter date range.");
        await page.waitForNavigation({ waitUntil: "networkidle0" });

        return page;
    }

    /**
     * Sets the order number in the purchase order page to the given value.
     *
     * @param page the page to operate on.
     * @param orderId The order ID to set.
     * @private
     */
    public async setPurchaseOrdersFilterOrderNumber(page: Page, orderId: string): Promise<Page> {
        this._logger.info(`Set purchase order filter order number to ${orderId}.`);

        this._logger.debug("Check wheteher purchase order filter form has exact 'order ID' field.");
        const isMultiCriteriaSearch =
            await page.waitForSelector("div.docv-INSPOSC-radio-multicriteria")
                .then(() => true)
                .catch(() => false)
        ;

        if (isMultiCriteriaSearch) {
            this._logger.debug("Purchase order filter form uses exact 'order ID' field.");

            // a radio button is available to select for "full ID" or "partial ID".
            // use "full ID" here!
            await this.pageHelper.deactivateAribaClickCheck(page);

            this._logger.debug("Selecting 'exact' 'order ID' search criteria.");
            await page.evaluate(() => {
                // select "exact number", which is in second place
                const exactNumberLabel = jQuery("div.docv-INSPOSC-radio-multicriteria div[bh='RDO'] label")
                    .last()
                ;
                exactNumberLabel.prev()
                    .trigger("click")
                ;
                exactNumberLabel.trigger("click");
            });

            // some XHR takes place
            this._logger.debug("Waiting for XHR to happen after selecting 'exact' 'order ID' search criteria.");
            await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => true);

            // now store the exact number into the input field
            this._logger.debug("Set purchase order ID into 'order ID' field of 'exact' field.");
            await page.evaluate((purchaseOrderId) => {
                jQuery("td:contains('Order Number:')")
                    .parents("td")
                    .first()
                    .parent()
                    .next()
                    .find("input")
                    .val(purchaseOrderId)
                ;
            }, orderId);

            //
        } else {
            this._logger.debug("Set purchase order ID into 'order ID' field.");
            await page.evaluate((purchaseOrderId) => {
                jQuery("td:contains('Order Number:')")
                    .parents("td")
                    .first()
                    .next()
                    .find("input")
                    .val(purchaseOrderId)
                ;
            }, orderId);
        }

        return page;
    }

    public async setPurchaseOrderFilterMaximumListSize(page: Page): Promise<Page> {
        this._logger.info("Set search result list to maximum!");

        // select maximum of 500 per list
        try {
            this._logger.debug("Wait purchase order filter form footer to become available.");
            await page.waitForSelector("td.SearchFooter .w-dropdown:first-child");

            this._logger.debug("Setting maxium number of search items to 500.");
            await page.evaluate(() => {
                const dropDownItem = jQuery("td.SearchFooter .w-dropdown");
                window.ariba.AWWidgets.DropDown.openDropdown(dropDownItem);
                setTimeout(() => window.ariba.AWWidgets.DropDown.dropDownMenuAction(
                    dropDownItem.find(".w-dropdown-item").last(),
                    null,
                ), 20);
            });

        } catch (err) {
            this._logger.error("Failed to set the size of the list: " + (err as Error).message);
        }

        return page;
    }

    /**
     * Sets the order number in the purchase order page to the given value.
     *
     * @param page the page to operate on.
     * @param orderId The order ID to set.
     * @private
     */
    public async pressPurchaseOrdersFilterSearchButton(page: Page): Promise<Page> {
        this._logger.info("Submit purchase order search.");

        await this.pageHelper.deactivateAribaClickCheck(page);
        await page.evaluate(() => {
            jQuery("button:contains('Search')").trigger("click");
        });

        // some XHR takes place
        this._logger.debug("Wait for XHR after submitting purchase order search.");
        await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => true);

        return page;
    }

    public async openConfirmationSubmenuOnPurchaseOrderDetailPage(page: Page) {
        // find the button to open the confirm sub menu
        this._logger.debug("Wait for the purchase order confirmation button.");
        (await page.waitForSelector("button[title*='Create'][title*='order confirmation']"));

        this._logger.debug(`Activate the submenu of the purchase order confirmation button.`);
        await page.evaluate(() => window.ariba.Menu.PML.click(
            jQuery("button[title*='Create'][title*='order confirmation']")
                // for some reason, more than a single button is available in the page. Only the last one
                // is visible, but ":visible" does not filter the others.
                .last()
                .parents(".w-pulldown-button")
                .first()[0],
        ));

        return page;
    }

    public async pressConfirmOrderButtonOnPurchaseOrderDetailPage(
        page: Page, action: string & ("Confirm" | "Reject"),
    ): Promise<Page> {
        this._logger.debug("Activate 'Confirm/Reject entire order' button");
        await page.evaluate((action) => {
            // submenu button
            const $submenuButton = jQuery("button[title*='Create'][title*='order confirmation']")
                // for some reason, more than a single button is available in the page. Only the last one
                // is visible, but ":visible" does not filter the others.
                .last()
                .parents(".w-pulldown-button")
                .first();

            const submenuId = $submenuButton.attr("_mid");
            const $confirmEntireOrderButton = jQuery("#" + submenuId + " a:contains('" + action + " Entire')");
            window.ariba.Handlers.fakeClick($confirmEntireOrderButton[0]);
        }, action);

        await page.waitForXPath("//a[contains(text(), 'Order Confirmation Header')]", { visible: true });

        return page;
    }
}
