import type { Page } from "puppeteer";
import type { IPurchaseOrder } from "../IPurchaseOrder.js";
import type { IPurchaseOrderPage } from "../IPurchaseOrderPage.js";

import { TPurchaseOrderState } from "../IPurchaseOrder.js";
import { BaseAribaDialogPageImpl } from "./BaseAribaDialogPageImpl.js";

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export class PurchaseOrderPageImpl extends BaseAribaDialogPageImpl implements IPurchaseOrderPage {
    //

    public get loggerName(): string {
        return "PurchaseOrderPageImpl";
    }

    public getOrderStatus(purchaseOrderId: string): Promise<TPurchaseOrderState> {
        //
        this._logger.info(`Get status of purchase order with ID ${purchaseOrderId}.`);
        return this.getOrderData(purchaseOrderId)
            .then((order) => {
                if (!order?.state) {
                    throw new Error("Failed to read order status from order page.");
                }
                return order.state;
            });
    }

    public async getOrderData(purchaseOrderId: string): Promise<IPurchaseOrder | undefined> {
        const page = this.page;
        await this.navigateToPurchaseOrder(purchaseOrderId);
        await this.loginIfRequired(page, () => this.navigateToPurchaseOrder(purchaseOrderId));
        return await this.readOrderDataFromPage(page);
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
        await this.loginIfRequired(page, () => this.navigateToPurchaseOrder(purchaseOrderId));

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

        if (trackingUrl) {
            this._logger.debug(`Opening additional fields to display comment field`);
            await page.evaluate(() =>
                window.ariba.Handlers.fakeClick(jQuery("a:contains('Additional Fields')")[0]),
            );

            this._logger.debug(`Setting tracking URL: ${trackingUrl}`);
            await page.evaluate((value) => {
                jQuery("td:contains('Comments:'):not(:has(td))")
                    .parents("td")
                    .first()
                    .next()
                    .find("textarea")
                    .first()
                    .val(value);
            }, "" + trackingUrl);
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
        const orderData = await this.getOrderData(purchaseOrderId).catch(() => undefined);
        if (orderData?.state === TPurchaseOrderState.INVOICED) {
            this._logger.info(`Purchase order ${purchaseOrderId} has already been invoiced.`);
            return orderData;

        } else if (
            orderData?.state !== TPurchaseOrderState.DELIVERY_INITIATED &&
            orderData?.state !== TPurchaseOrderState.PARTIAL_DELIVERY
        ) {
            throw Error("Purchase order must be delivered first to create an invoice.");
        }

        const page = this.page;
        await this.loginIfRequired(page, () => this.navigateToPurchaseOrder(purchaseOrderId));

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
        await this.pageHelper.loadJQuery(page);
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

        this._logger.debug("Confirm invoice and got to next page of form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Next"),
            page.waitForNavigation(),
        ]);

        await this.pageHelper.wait(1);

        this._logger.debug("End invoice order form");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Submit"),
            page.waitForNavigation().catch(),
        ]);

        await this.pageHelper.wait(1);

        // exit the invoice form
        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            this.clickButtonWithText(page, "Exit", "a"),
            page.waitForNavigation().catch(),
        ]);

        await this.pageHelper.wait(1);

        return orderData;
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
        const orderData = await this.getOrderData(purchaseOrderId).catch(() => undefined);
        if (orderData?.state !== TPurchaseOrderState.NEW) {
            return orderData;
        }


        const page = this.page;
        await this.loginIfRequired(page, () => this.navigateToPurchaseOrder(purchaseOrderId));

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
        return orderData;
    }

    public async downloadInvoice(
        purchaseOrderId: string,
    ): Promise<undefined | { invoiceFile: string, orderData: IPurchaseOrder }> {
        this._logger.info(`Download invoice for purchase order with ID ${purchaseOrderId}.`);
        const page = this.page;

        const downloadTargetPath = path.join(this.config.downloadDirectory || os.tmpdir(), "ARIBA", purchaseOrderId);
        await this.setDownloadDirectory(downloadTargetPath);

        await fs.mkdir(downloadTargetPath, { recursive: true }).catch(() => false);
        async function getDownloadedFileAsFirstFile(directory: string) {
            return await fs.readdir(directory).then((allFiles) => {
                if (!allFiles || allFiles.length === 0) {
                    return undefined;
                } else {
                    return allFiles.filter((name) => name && name.charAt(0) !== ".").shift();
                }
            });
        }

        // first, check order status. In case of error, assume already confirmed
        const orderData = await this.getOrderData(purchaseOrderId).catch(() => undefined);
        if (
            orderData?.state !== TPurchaseOrderState.INVOICED &&
            orderData?.state !== TPurchaseOrderState.INVOICED_PARTIALLY
        ) {
            throw Error("Purchase order has not yet been invoiced.");
        }

        await this.loginIfRequired(page, () => this.navigateToPurchaseOrder(purchaseOrderId));

        // check to see, whether the purchase order has been found
        this._logger.debug(`Open invoice for purchase order (ID: ${purchaseOrderId}).`);
        await this.pageHelper.deactivateAribaClickCheck(page);
        await page.evaluate(
            () => jQuery("td.docv-IOSRD-label-related-docs")
                .next()
                .children("a")
                .first()[0]
                .click(),
        );

        this._logger.debug("Wait for PDF download submenu button.");
        await page.waitForSelector("div[_mid='downloadPDFMenuIdTop'] button");

        // read invoice date
        const dateStringFromPage = await page.evaluate(() =>
            jQuery("div.docv-IOSIDC-inv-details td.ANXFormLabel:contains('Invoice Date')")
                .parents("td")
                .first()
                .next()
                .text()
                .trim(),
        );
        orderData.invoiceDate = new Date(dateStringFromPage) || new Date();

        let downloadedFile = await getDownloadedFileAsFirstFile(downloadTargetPath);
        if (downloadedFile) {
            this._logger.debug(
                `Invoice has already been downloaded for purchase order (ID: ${purchaseOrderId}): ${downloadedFile}.`,
            );
            return {
                invoiceFile: path.join(downloadTargetPath, downloadedFile),
                orderData,
            };
        }

        // download the PDF
        this._logger.debug("Open for PDF download submenu.");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await page.evaluate(
            () => window.ariba.Handlers.fakeClick(
                jQuery("div[_mid='downloadPDFMenuIdTop'] button")[0],
            ),
        );
        await page.waitForSelector("#downloadPDFMenuIdTop");

        this._logger.debug(`Start PDF download to directory ${downloadTargetPath}`);
        await Promise.all([
            page.evaluate(
                () => window.ariba.Handlers.fakeClick(
                    jQuery("#downloadPDFMenuIdTop a:contains('PDF')")[0],
                ),
            ).catch(() => false),
            await page.waitForNetworkIdle().catch(() => false),
        ]);

        // find first file in directory
        this._logger.debug(`Find downloaded PDF in directory ${downloadTargetPath}`);
        let max = 5;
        downloadedFile = await getDownloadedFileAsFirstFile(downloadTargetPath);
        while (!downloadedFile && max-- > 0) {
            await page.waitForTimeout(6000);
            downloadedFile = await getDownloadedFileAsFirstFile(downloadTargetPath);
        }

        await this.closeDialog(page);

        if (!downloadedFile) {
            throw new Error(`Failed to download invoice for purchase order ${purchaseOrderId}.`);
        }

        this._logger.info(`Found downloaded invoide PDF directory ${downloadedFile}`);

        return {
            invoiceFile: path.join(downloadTargetPath, downloadedFile),
            orderData,
        };
    }

    public async navigateToPurchaseOrder(purchaseOrderId: string): Promise<IPurchaseOrderPage> {
        this._logger.info(`Navigate to purchase order (ID: ${purchaseOrderId}) page.`);
        const page = this.page;

        const activatePurchaseOrderSearchPage: () => Promise<void> = async () => {
            await this.navigateToHome();

            // wait for the form to appear
            await page.waitForSelector("#search-input-container input[type='text']");
            await page.focus("#search-input-container input[type='text']");
            await page.keyboard.type(purchaseOrderId);

            await Promise.all([
                page.keyboard.press("Enter"),
                page.waitForNavigation(),
            ]);
        };

        // try again in case of login page
        await activatePurchaseOrderSearchPage();
        await this.loginIfRequired(page, activatePurchaseOrderSearchPage);

        const openPurchaseOrderPage: () => Promise<void> = async () => {
            // check to see, whether the purchase order has been found
            this._logger.debug(`Finding the link for purchase order (ID: ${purchaseOrderId}) info page.`);
            try {
                await page.waitForSelector(`table.awtWrapperTable a[documentid='${purchaseOrderId}']`);
            } catch (ignore) {
                await this.loginIfRequired(page, activatePurchaseOrderSearchPage);
                await page.waitForSelector(`table.awtWrapperTable a[documentid='${purchaseOrderId}']`);
            }

            this._logger.debug(`Activating the link for purchase order (ID: ${purchaseOrderId}) info page.`);
            await this.pageHelper.deactivateAribaClickCheck(page);
            await page.click(`table.awtWrapperTable a[documentid='${purchaseOrderId}']`);

        };

        await openPurchaseOrderPage();
        await this.loginIfRequired(page, async () => {
            await activatePurchaseOrderSearchPage();
            await openPurchaseOrderPage();
        });

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


    protected async readOrderDataFromPage(page: Page): Promise<IPurchaseOrder | undefined> {
        if (!page) {
            return undefined;
        }

        this._logger.debug(`Read order status with jQuery`);
        return {
            id: await page.evaluate(() => window.jQuery(".poHeaderStatusStyle").next().text().trim()),
            state: await this.readOrderStateFromPage(page),
            orderDate: new Date(await page.evaluate(() =>
                window.jQuery("tr.po-INSPOD-rel-po-date td:contains('Order submitted on')")
                    .text().split("\n")[1].replace("Order submitted on:", "").trim(),
            )),
        } as IPurchaseOrder;
    }

    private async readOrderStateFromPage(page: Page): Promise<TPurchaseOrderState> {
        if (!page) {
            throw new Error("Failed to read order status of unknown page.");
        }

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
        case "partially shipped":
            return TPurchaseOrderState.PARTIAL_DELIVERY;
        case "invoiced":
            return TPurchaseOrderState.INVOICED;
        case "partially invoiced":
            return TPurchaseOrderState.INVOICED_PARTIALLY;
        default:
            throw new Error("Failed to read status of order. Status is unknown: " + status);
        }
    }
}
