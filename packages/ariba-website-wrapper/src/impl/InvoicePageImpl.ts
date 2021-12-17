import type { Page } from "puppeteer";
import type { IInvoicePage } from "../IInvoicePage.js";
import { BaseAribaDialogPageImpl } from "./BaseAribaDialogPageImpl.js";


export class InvoicePageImpl extends BaseAribaDialogPageImpl implements IInvoicePage {
    //
    private _cachedLastInvoiceNumber: Promise<string | undefined> = Promise.resolve(undefined);

    public get loggerName(): string {
        return "InvoicePageImpl";
    }

    public async getLatestInvoiceNumber(): Promise<string> {
        // try to read cached value first
        return this._cachedLastInvoiceNumber
            .catch(() => undefined) // ignore and try again
            .then((number) => {
                if (!number) {
                    this._cachedLastInvoiceNumber = this.currentPage
                        .then((page) => this.readLatestInvoiceNumberFromPage(page))
                    ;
                    return this._cachedLastInvoiceNumber;
                }
                return number;
            })
            .then((number) => {
                if (!number) {
                    throw new Error("Failed to read last invoice number from web page");
                }
                return number;
            })
        ;
    }

    /**
     * Creates a new invoice number to be used with the next invoice.
     */
    public getNextInvoiceNumber(): Promise<string> {
        return this.getLatestInvoiceNumber()
            .then((currentInvoiceNumber) => {
                const newNumber = +currentInvoiceNumber.replace(/20[0-9][0-9]-/, "") + 1;
                const newNumberStr = this.formatNewInvoiceNumber(newNumber);
                this._cachedLastInvoiceNumber = Promise.resolve(newNumberStr);

                return newNumberStr;
            })
        ;
    }

    public async openInvoiceSearchPage(page: Page): Promise<Page> {
        this._logger.info("Navigating to invoices search page");

        if (!page) {
            return Promise.reject(new Error("Provided page is undefined!"));
        }

        // ensure login has been performed
        await this.navigateToHome();

        // wait for the submenu to be available and click it
        this._logger.debug("Wait for invoice menu to be available and open its submenu");
        await this.pageHelper.deactivateAribaClickCheck(page);
        await page.evaluate(() =>
            jQuery("#SUPInvoices").find("fd-popover-control:contains('Invoices')")
                .trigger("click"),
        );

        // click on link to the list of orders
        this._logger.debug("Activating the menu entry 'Invoice Search Page'");
        await Promise.all([
            page.waitForSelector("#IOSInvoiceList", { visible: false })
                .then((elem) => {
                    elem?.click();
                    return Promise.resolve();
                }),
            await page.waitForNavigation(),
        ]);

        this._logger.debug("Waiting for the 'Purchase Order Search Page' to become available");
        await page.waitForXPath("//td.pageHeadingText[contains(text(), 'Invoices')]");
        return page;
    }

    private async readLatestInvoiceNumberFromPage(page: Page): Promise<string> {
        await this.openInvoiceSearchPage(page);

        await this.pageHelper.deactivateAribaClickCheck(page);
        await this.pageFormHelper.setFilterOpen(page);
        await this.pageFormHelper.setFilterDateRange(page, false);
        await this.pageFormHelper.pressFilterSearchButton(page);

        // if there is no invoice, then return the initial value
        const isEmpty = await page.evaluate(() =>
            jQuery("h2:contains('Invoices (0)')").length > 0,
        );

        if (isEmpty) {
            return this.formatNewInvoiceNumber(1);
        }

        // get maximum number in the list
        // TODO!

        throw new Error("NOT YET IMPLEMENTED");
    }

    private formatNewInvoiceNumber(num: number): string {
        if (isNaN(num) || num < 0) {
            throw new Error(`Invalid invoice number: ${num}!`);
        }

        let newNumber = "00000" + num;
        while (newNumber.charAt(0) === "0" && newNumber.length > 6) {
            newNumber = newNumber.substring(1);
        }

        return new Date().getFullYear() + "-" + newNumber;
    }
}
