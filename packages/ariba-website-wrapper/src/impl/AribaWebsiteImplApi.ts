import type { Logger } from "winston";

import type { IAribaFactory } from "../IAribaFactory";
import type { IAribaWebsiteApi } from "../IAribaWebsiteApi";
import type { IPurchaseOrder } from "../IPurchaseOrder";

import { TPurchaseOrderState } from "../IPurchaseOrder";


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
        this._logger.info(`Confirming purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        return purchaseOrderPage.confirmPurchaseOrder(
            purchaseOrderId,
            new Date(estimatedDeliveryDate),
            estimatedShippingDate ? new Date(estimatedShippingDate) : undefined,
            supplierOrderId,
        ).then((order) =>
            purchaseOrderPage.close().then(() => order)
        );
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

    public async getPurchaseOrderStatus(purchaseOrderId: string): Promise<TPurchaseOrderState> {
        this._logger.info(`Get status of purchase order with ID ${purchaseOrderId}.`);
        const purchaseOrderPage = await this._factory.createPurchaseOrderPage();
        return await purchaseOrderPage.getOrderStatus(purchaseOrderId);
    }
}
