import type { IAribaPage } from "./IAribaPage.js";

export interface IInvoicePage extends IAribaPage {
    /**
     * Reads from the list of invoices and extracts the highest/latest number.
     *
     * <p>Invoice numbrers are expected to look like "2021-000001", meaning "YEAR-NUMBER". The year is the year this
     * particular invoce has been created. "NUMBER" is a consecutive number.</p>
     */
    getLatestInvoiceNumber(): Promise<string>;

    /**
     * Creates a new invoice number to be used with the next invoice.
     */
    getNextInvoiceNumber(): Promise<string>;
}
