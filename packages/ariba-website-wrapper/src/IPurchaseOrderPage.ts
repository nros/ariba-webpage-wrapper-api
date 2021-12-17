import type { Page } from "puppeteer";
import type { IAribaPage } from "./IAribaPage.js";
import type { IPurchaseOrder } from "./IPurchaseOrder.js";

import { TPurchaseOrderState } from "./IPurchaseOrder.js";

export interface IPurchaseOrderPage extends IAribaPage {
    /**
     * Read the order status from the web site.
     *
     * <p>
     *     This is a very expensive operation for just a singe statue
     * </p>
     *
     * @param purchaseOrderId the purchase order ID
     */
    getOrderStatus(purchaseOrderId: string): Promise<TPurchaseOrderState>;

    /**
     * Opens the page order status dialog and confirms the specified order.
     *
     * @param purchaseOrderId The ID of the purchase order to confirm.
     * @param estimatedDeliveryDate The estimated date of delivery
     * @param estimatedShippingDate (optional) the estimated shipping date
     * @param supplierOrderId (optional) the order ID of the supplier (LOGSTA) for reference
     */
    confirmPurchaseOrder(
        purchaseOrderId: string,
        estimatedDeliveryDate: Date,
        estimatedShippingDate?: Date,
        supplierOrderId?: string,
    ): Promise<IPurchaseOrder | undefined>;

    /**
     * Sends a shipping notice
     *
     * @param purchaseOrderId The ID of the purchase order to confirm.
     * @param packingSlipId The ID on the label of the package
     * @param carrierName The name of the carrier
     * @param trackingNumber
     * @param trackingUrl The tracking URL
     * @param estimatedDeliveryDate The estimated date of delivery
     * @param shippingDate (optional)
     */
    createShippingNotice(
        purchaseOrderId: string,
        packingSlipId: string,
        carrierName: string,
        trackingNumber: string,
        trackingUrl: string,
        estimatedDeliveryDate: Date,
        shippingDate?: Date,
    ): Promise<IPurchaseOrder | undefined>;


    createInvoice(
        purchaseOrderId: string,
        logisticsOrderId: string,
        invoiceNumber: string,
    ): Promise<IPurchaseOrder | undefined>;


    /**
     * Navigates to the status page of the purchase order.
     * @param purchaseOrderId
     */
    navigateToPurchaseOrder(purchaseOrderId: string): Promise<IPurchaseOrderPage>;

    /**
     * Opens the purchase order search page.
     *
     * @param page the page to use to open the purchase order search.
     * @private
     */
    openPurchaseOrderSearchPage(page: Page): Promise<Page>;

    /**
     * Sets the purchase order filter of the Purchase Order (PO) state.
     *
     * @param page the page to set the filters to.
     * @param filterForState the state of the purchase order to search for.
     * @private
     */
    setPurchaseOrdersFilterPoState(page: Page, filterForState: TPurchaseOrderState): Promise<Page>;

    /**
     * Sets the order number in the purchase order page to the given value.
     *
     * @param orderId The order ID to set.
     * @private
     */
    setPurchaseOrdersFilterOrderNumber(page: Page, orderId: string): Promise<Page>;
}
