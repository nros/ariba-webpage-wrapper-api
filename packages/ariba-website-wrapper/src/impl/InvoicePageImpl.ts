import type { Page } from "puppeteer";
import type { IInvoicePage } from "../IInvoicePage.js";
import { BaseAribaDialogPageImpl } from "./BaseAribaDialogPageImpl.js";


export class InvoicePageImpl extends BaseAribaDialogPageImpl implements IInvoicePage {
    //
    public get loggerName(): string {
        return "InvoicePageImpl";
    }

    public async getLatestInvoiceNumber(): Promise<string> {
        // try to read cached value first
        return this.readLatestInvoiceNumberFromPage(this.page);
    }

    /**
     * Creates a new invoice number to be used with the next invoice.
     */
    public getNextInvoiceNumber(): Promise<string> {
        return this.getLatestInvoiceNumber()
            .then((currentInvoiceNumber) => {
                const newNumber = +currentInvoiceNumber.replace(/20[0-9][0-9]-/, "") + 1;
                return this.formatNewInvoiceNumber(newNumber);
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

        const navigateToInvoiceSearchPage: () => Promise<void> = async () => {
            // wait for the submenu to be available and click it
            this._logger.debug("Wait for invoice menu to be available and open its submenu");
            await this.pageHelper.deactivateAribaClickCheck(page);
            await this.pageHelper.loadJQuery(page);

            await page.evaluate(() =>
                window.jQuery("#SUPInvoices").find("fd-popover-control:contains('Invoices')")
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
        };

        // quite often, ARIBA server enforces re-login for unknown reasons
        await navigateToInvoiceSearchPage();
        await this.loginIfRequired(page, navigateToInvoiceSearchPage);

        this._logger.debug("Waiting for the 'Purchase Order Search Page' to become available");
        await page.waitForXPath("//td[@class='pageHeadingText'][contains(text(), 'Invoices')]");

        return page;
    }

    private async readLatestInvoiceNumberFromPage(page: Page): Promise<string> {
        await this.openInvoiceSearchPage(page);

        await this.pageHelper.deactivateAribaClickCheck(page);
        await this.pageFormHelper.setFilterOpen(page);
        await this.pageFormHelper.setFilterDateRange(page, false);
        await this.pageFormHelper.pressFilterSearchButton(page);

        // ensure jQuery has been loaded
        await this.pageHelper.loadJQuery(page);

        // if there is no invoice, then return the initial value
        const isEmpty = await page.evaluate(() =>
            window.jQuery("h2:contains('Invoices')").first().text().trim().replace(/Invoices\s*/, "").replace(/[()]/g, "") === "0",
        );

        let lastNumber: string | undefined;
        if (!isEmpty) {
            // get maximum number in the list
            this._logger.debug("Reading last invoice number.");
            lastNumber = await page.evaluate(() => {
                const $rowHeader = window.jQuery("th a:contains('Invoice #')").first().parents("th").first();

                let child = 1;
                let $currentSibling = $rowHeader;
                while ($currentSibling.prev()[0]) {
                    child++;
                    $currentSibling = $currentSibling.prev();
                }

                const $table = $rowHeader.parents("tbody").first();
                const $invoiceNumberRows = $table.children("tr").children("td:nth-child(" + child + ")");

                const numbers: string[] = [];
                window.jQuery.each($invoiceNumberRows, (index: number, value: JQuery.PlainObject<any>) => {
                    numbers.push(jQuery(value).text().trim());
                });

                numbers.sort();
                return numbers.pop();
            });
        }

        if (isEmpty || !lastNumber) {
            const startInvoiceNumber = this.formatNewInvoiceNumber(0);
            this._logger.warn(`NO invoice number can be found! Using '0' to start with:  ${startInvoiceNumber}`);
            return startInvoiceNumber;

        } else {
            return lastNumber;
        }
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
