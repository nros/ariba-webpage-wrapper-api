import type { Page } from "puppeteer";
import type { IPurchaseOrder } from "../IPurchaseOrder.js";
import { TPurchaseOrderState } from "../IPurchaseOrder.js";
import type { IPurchaseOrderPage } from "../IPurchaseOrderPage.js";
import { BaseAribaDialogPageImpl } from "./BaseAribaDialogPageImpl.js";


export class PurchaseOrderPageImpl extends BaseAribaDialogPageImpl implements IPurchaseOrderPage {
    //

    public get loggerName(): string {
        return "PurchaseOrderPageImpl";
    }

    public async getOrderStatus(purchaseOrderId: string): Promise<TPurchaseOrderState> {
        //
        this._logger.info(`Get status of purchase order with ID ${purchaseOrderId}.`);
        await this.navigateToPurchaseOrder(purchaseOrderId);

        const page = this.page;

        this._logger.debug(`Read order status with jQuery`);
        const status = await page.evaluate(() =>
            window.jQuery(".poHeaderStatusStyle").text().replace(/[)(]/g, "").toLowerCase().trim(),
        ).catch(() => "");

        switch (status) {
        case "new":
        case "failed":
            return TPurchaseOrderState.NEW;
        case "confirmed":
            return TPurchaseOrderState.CONFIRMED;
        case "shipped":
            return TPurchaseOrderState.DELIVERY_INITIATED;
        default:
            throw new Error("Failed to read status of order. Status is unknown: " + status);
        }
    }

    public async createShippingNotice(
        purchaseOrderId: string,
        packingSlipId: string,
        carrierName: string,
        trackingNumber: string,
        trackingUrl: string,
        estimatedDeliveryDate: Date,
        shippingDate?: Date,
    ): Promise<IPurchaseOrder | undefined> {
        this._logger.info(`sending shipping notice for purchase order with ID ${purchaseOrderId}.`);

        if (!carrierName) {
            throw new Error(`Carrier is invalid '${carrierName}'`);
        }

        if (!packingSlipId) {
            throw new Error(`Packing slip ID is invalid '${packingSlipId}'`);
        }


        // first, check order status. In case of error, assume already confirmed
        const state = await this.getOrderStatus(purchaseOrderId).catch(() => TPurchaseOrderState.CONFIRMED);
        if (state === TPurchaseOrderState.DELIVERY_INITIATED) {
            this._logger.info(
                `A shipping notice for purchase order with ID ${purchaseOrderId} has already been created`,
            );
            const error = new Error(`A shipping notice for purchase order with ID ${purchaseOrderId} already exists`);
            (error as unknown as Record<string, number>).status = 409; // set HTTP error code 409
            throw error;

        } else if (state !== TPurchaseOrderState.CONFIRMED) {
            throw Error("Purchase order must be confirmed first to create a shipping notice.");
        }

        const page = this.page;

        this._logger.info("Wait for the create ship notice button.");
        (await page.waitForXPath("//button/span[contains(text(), 'Create Ship Notice')]"));

        // open a notice dialog
        this._logger.debug(`Opening the shipping notice dialog for purchase order with ID ${purchaseOrderId}.`);
        await Promise.all([
            page.evaluate(() =>
                window.ariba.Handlers.fakeClick(jQuery("button:contains('Create Ship Notice')").first()[0]),
            ),
            page.waitForNavigation(),
        ]).catch(this._logger.error);

        // Select "Other" carrier
        this._logger.debug(`Selecting 'other' carrier!`);
        await Promise.all([
            page.evaluate(() =>
                window.ariba.Handlers.fakeClick(
                    jQuery("td:contains('Carrier Name:'):not(:has(td))")
                        .parents("td").first().next().find("a:contains('Other')")[0],
                ),
            ),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]);

        // fill carrier name
        await page.evaluate((carrierName) => {
            jQuery("td:contains('Carrier Name:'):not(:has(td))")
                .parents("td")
                .first()
                .parents("tr")
                .first()
                .next()
                .find("input")
                .val(carrierName);
        }, carrierName);

        // fill tracking number
        await page.evaluate((trackingNumber) => {
            jQuery("td:contains('Tracking No.'):not(:has(td))")
                .parents("td")
                .first()
                .next()
                .find("input")
                .first()
                .val(trackingNumber);
        }, trackingNumber);


        // fill in packing slip ID
        await page.evaluate((packingSlipId) => {
            jQuery("td:contains('Packing Slip ID'):not(:has(td))")
                .parents("td")
                .first()
                .next()
                .find("input")
                .first()
                .val(packingSlipId);
        }, packingSlipId);

        // fill the delivery date
        this._logger.debug(`Setting estimated delivery date: ${estimatedDeliveryDate}`);
        await page.evaluate((dateString) => {
            const dateTime = new Date("" + dateString);
            const dateFormatter = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" });
            const value = dateFormatter.format(dateTime);

            jQuery("td:contains('Delivery Date'):not(:has(td))")
                .parents("td")
                .first()
                .next()
                .find("input")
                .first()
                .val(value);
        }, "" + estimatedDeliveryDate);


        if (shippingDate) {
            this._logger.debug(`Setting shipping date: ${estimatedDeliveryDate}`);
            await page.evaluate((dateString) => {
                const dateTime = new Date("" + dateString);
                const dateFormatter = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" });
                const value = dateFormatter.format(dateTime);

                jQuery("td:contains('Shipping Date'):not(:has(td))")
                    .parents("td")
                    .first()
                    .next()
                    .find("input")
                    .first()
                    .val(value);
            }, "" + shippingDate);
        }

        this._logger.debug("Confirm order and got to next page of form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Next"),
            page.waitForNavigation(),
        ]);

        this._logger.debug("End shipping notice order form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Submit"),
            await page.waitForNavigation(),
        ]);

        return undefined;
    }


    public async createInvoice(
        purchaseOrderId: string,
        logisticsOrderId: string,
        invoiceNumber: string,
    ): Promise<IPurchaseOrder | undefined> {
        this._logger.info(`Creating invoice for purchase order with ID ${purchaseOrderId}.`);

        // first, check order status. In case of error, assume already confirmed
        const state = await this.getOrderStatus(purchaseOrderId).catch(() => TPurchaseOrderState.NEW);
        if (state !== TPurchaseOrderState.DELIVERY_INITIATED) {
            throw Error("Purchase order must be delivered first to create an invoice.");
        }

        const page = this.page;

        this._logger.info("Wait for the create invoice button.");
        (await page.waitForSelector("button[title*='Create'][title*='invoice']"));

        this._logger.info(`Activate the submenu of the create invoice button.`);
        await page.evaluate(() => window.ariba.Menu.PML.click(
            jQuery("button:contains('Create Invoice')")
                // for some reason, more than a single button is available in the page. Only the last one
                // is visible, but ":visible" does not filter the others.
                .first()
                .parents(".w-pulldown-button")
                .first()[0],
        ));

        this._logger.info(`Activate "Standard Invoice" button.`);
        await page.evaluate(() =>
            window.ariba.Handlers.fakeClick(jQuery("a:contains('Standard Invoice')")[0]),
        );
        await page.waitForXPath("//a[contains(text(), 'Invoice Header')]", { visible: true });

        // fill supplier reference
        await page.evaluate((invoiceNumber) => {
            jQuery("td:contains('Invoice #'):not(:has(td))")
                .parents("td")
                .first()
                .next()
                .find("input")
                .first()
                .val(invoiceNumber);
        }, invoiceNumber);

        // fill supplier reference
        await page.evaluate((logisticsOrderId) => {
            jQuery("td:contains('Supplier Reference:'):not(:has(td))")
                .parents("td")
                .first()
                .next()
                .find("input")
                .val(logisticsOrderId);
        }, logisticsOrderId);

        // disable "skonto"/discount but set to penalty
        /* At the moment, the default discount is the accepted version. This code is just kept for reference!
        await page.evaluate((logisticsOrderId) =>
            jQuery("td:contains('Discount or Penalty Term'):not(:has(td))")
                .parents("td")
                .first()
                .next()
                .next()
                .next()
                .find("input")
                .val("-3"),
        );
        */

        this._logger.debug("Select URBAN TOOL Deutschland as sender of invoice.");
        await page.evaluate(() => {
            const dropDown = jQuery(".w-dropdown-selected:contains('URBAN TOOL')")
                .parents("div.w-dropdown[bh='DDM']").first()
            ;

            window.ariba?.AWWidgets.DropDown.openDropdown(dropDown);
            setTimeout(() => window.ariba?.AWWidgets.DropDown.dropDownMenuAction(
                dropDown.find("div.w-dropdown-item:contains('URBAN TOOL Deutschland')"),
                null,
            ), 20);
        });

        /*
        this._logger.debug("Confirm invoice and got to next page of form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Next"),
            page.waitForNavigation(),
        ]);

        this._logger.debug("End invoice order form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Submit"),
            await page.waitForNavigation(),
        ]);
*/
        return {
            id: purchaseOrderId,
            state: TPurchaseOrderState.INVOICED,
        };
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


        const page = this.page;

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
        const page = this.page;
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
        const page = this.page;

        await this.openPurchaseOrderSearchPage(page);
        await this.pageFormHelper.setFilterOpen(page);
        await this.setPurchaseOrdersFilterOrderNumber(page, purchaseOrderId);
        await this.pageFormHelper.pressFilterSearchButton(page);

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
