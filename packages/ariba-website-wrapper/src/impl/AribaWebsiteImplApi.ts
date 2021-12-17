import type { Logger } from "winston";

import type { IAribaFactory } from "../IAribaFactory.js";
import type { IAribaWebsiteApi } from "../IAribaWebsiteApi.js";
import type { IPurchaseOrder } from "../IPurchaseOrder.js";

import { TPurchaseOrderState, status2String } from "../IPurchaseOrder.js";


export class AribaWebsiteImplApi implements IAribaWebsiteApi {
    private readonly _factory: IAribaFactory;
    private readonly _logger: Logger;

    public constructor(factory: IAribaFactory) {
        this._factory = factory;
        this._logger = factory.createLogger("AribaWebsiteImplApi");
    }

    public async confirmPurchaseOrder(
        purchaseOrderId: string,
        estimatedDeliveryDate: string,
        estimatedShippingDate?: string,
        supplierOrderId?: string,
    ): Promise<IPurchaseOrder | undefined> {
        //
        if (!purchaseOrderId) {
            throw new Error("Invalid purchase order ID");
        }

        let deliveryDateTimestamp: number;
        let shippingDateTimestamp: number;

        try {
            const check = new Date(estimatedDeliveryDate);
            deliveryDateTimestamp = check.getTime();

            this._logger.debug("Estimated delivery date is: ", check);
        } catch (error) {
            throw new Error("Parameter 'estimatedDeliveryDate' is an invalid date");
        }

        if (estimatedShippingDate) {
            try {
                const check = new Date(estimatedShippingDate);
                shippingDateTimestamp = check.getTime();

                this._logger.debug("Estimated shipping date is: ", check);
            } catch (error) {
                throw new Error("Parameter 'estimatedShippingDate' is an invalid date");
            }

            if (deliveryDateTimestamp < shippingDateTimestamp) {
                throw new Error("Delivery date can not be earlier than the shipping date.");
            }
        }

        this._logger.info(`Confirming purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        try {
            return await purchaseOrderPage.confirmPurchaseOrder(
                purchaseOrderId,
                new Date(estimatedDeliveryDate),
                estimatedShippingDate ? new Date(estimatedShippingDate) : undefined,
                supplierOrderId,
            );
        } finally {
            await purchaseOrderPage.close();
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
        //
        if (!purchaseOrderId) {
            throw new Error("Invalid purchase order ID");
        }

        let deliveryDateTimestamp: number;
        let shippingDateTimestamp: number;

        try {
            const check = new Date(estimatedDeliveryDate);
            deliveryDateTimestamp = check.getTime();

            this._logger.debug("Estimated delivery date is: ", check);
        } catch (error) {
            throw new Error("Parameter 'estimatedDeliveryDate' is an invalid date");
        }

        if (shippingDate) {
            try {
                const check = new Date(shippingDate);
                shippingDateTimestamp = check.getTime();

                this._logger.debug("Shipping date is: ", check);
            } catch (error) {
                throw new Error("Parameter 'shippingDate' is an invalid date");
            }

            if (deliveryDateTimestamp < shippingDateTimestamp) {
                throw new Error("Delivery date can not be earlier than the shipping date.");
            }
        }

        this._logger.info(`Confirming purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        try {
            return await purchaseOrderPage.createShippingNotice(
                purchaseOrderId,
                packingSlipId,
                carrierName,
                trackingNumber || "unknown",
                trackingUrl,
                new Date(estimatedDeliveryDate),
                shippingDate ? new Date(shippingDate) : undefined,
            );
        } finally {
            await purchaseOrderPage.close();
        }
    }

    public async createInvoice(
        purchaseOrderId: string,
        logisticsOrderId: string,
        invoiceNumber?: string,
    ): Promise<IPurchaseOrder | undefined> {
        if (!invoiceNumber) {
            invoiceNumber = await this.getNextInvoiceNumber();
        }

        if (!invoiceNumber) {
            throw new Error("Invalid invoice number!");
        }
        if (!purchaseOrderId) {
            throw new Error("Invalid purchase order ID!");
        }

        this._logger.info(`Create invoice for purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        try {
            return await purchaseOrderPage.createInvoice(
                purchaseOrderId,
                logisticsOrderId,
                invoiceNumber,
            );
        } finally {
            await purchaseOrderPage.close();
        }
    }

    public async getPurchaseOrders(filterForState?: TPurchaseOrderState): Promise<IPurchaseOrder[]> {
        /*
        const page = await this.currentPage;
        await this.openPurchaseOrderSearchPage(page);
        await this.setPurchaseOrdersFilterOpen(page);
        await this.setPurchaseOrdersFilterFields(page, filterForState);
        */
        return [];
    }

    public async getPurchaseOrderStatus(purchaseOrderId: string): Promise<{id: string, state: string}> {
        this._logger.info(`Get status of purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        try {
            return {
                id: purchaseOrderId,
                state: await purchaseOrderPage.getOrderStatus(purchaseOrderId)
                    .then(status2String),
            };
        } finally {
            await purchaseOrderPage.close();
        }
    }

    public async getLastInvoiceNumber(): Promise<string> {
        this._logger.info(`Getting last invoice number.`);
        const page = await this._factory.createInvoicePage();
        try {
            return await page.getLatestInvoiceNumber();
        } finally {
            await page.close();
        }
    }

    public async getNextInvoiceNumber(): Promise<string> {
        this._logger.info(`Getting last invoice number.`);
        const page = await this._factory.createInvoicePage();
        try {
            return await page.getNextInvoiceNumber();
        } finally {
            await page.close();
        }
    }
}
