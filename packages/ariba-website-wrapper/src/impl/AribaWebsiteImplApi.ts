import type { Logger } from "winston";

import type { IAribaFactory } from "../IAribaFactory";
import type { IAribaWebsiteApi } from "../IAribaWebsiteApi";
import type { IPurchaseOrder } from "../IPurchaseOrder";

import { TPurchaseOrderState, status2String } from "../IPurchaseOrder";


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
                const check = new Date(estimatedDeliveryDate);
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
            return purchaseOrderPage.confirmPurchaseOrder(
                purchaseOrderId,
                new Date(estimatedDeliveryDate),
                estimatedShippingDate ? new Date(estimatedShippingDate) : undefined,
                supplierOrderId,
            );
        } finally {
            await purchaseOrderPage.close();
        }
    }

    public async createInvoice(
        purchaseOrderId: string,
        logisticsOrderId: string,
        invoiceNumber: string,
    ): Promise<IPurchaseOrder | undefined> {
        if (!invoiceNumber) {
            throw new Error("Invalid invoice number!");
        }
        if (!purchaseOrderId) {
            throw new Error("Invalid purchase order ID!");
        }

        this._logger.info(`Create invoice for purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        try {
            return purchaseOrderPage.createInvoice(
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
}
