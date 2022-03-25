import type { IPurchaseOrder, TPurchaseOrderState } from "./IPurchaseOrder.js";

/**
 * A wrapper of the Ariba webshop website to perform some actions utilising an internal headless browser.
 */
export interface IAribaWebsiteApi {
    /**
     * Retrieves a list of purchase orders.
     *
     * <p>
     * Retrieving the list can be very expensive. So, consider using a state to retrieve only the purchase orders that
     * match this state.
     * </p>
     *
     * @param filterForState (optional) only retrieve purchase orders of this state.
     */
    getPurchaseOrders(filterForState?: TPurchaseOrderState): Promise<IPurchaseOrder[]>;

    /**
     * Confirms the purchase order, settings its state to "Confirmed".
     *
     * @param purchaseOrderId The ID of the purchase order to confirm.
     * @param estimatedDeliveryDate The ID of the purchase order to confirm.
     * @param estimatedShippingDate (optional) the estimated shipping date
     * @param supplierOrderId (optional) the order ID of the supplier (LOGSTA) for reference
     * @return the data of the confirmed purchase order or {@code undefined} in case the purches order with the
     *     provided ID does not exist or already is confirmed. The Ariba web page has only limited possibilities
     *     to search for an order.
     */
    confirmPurchaseOrder(
        purchaseOrderId: string,
        estimatedDeliveryDate: string,
        estimatedShippingDate?: string,
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
        invoiceNumber?: string,
    ): Promise<IPurchaseOrder | undefined>;

    /**
     * Retrieves the status of the purchase order.
     *
     * @param purchaseOrderId The ID of the purchase order.
     */
    getPurchaseOrderStatus(purchaseOrderId: string): Promise<{id: string, state: string}>;

    getLastInvoiceNumber(): Promise<string>;

    deleteAllCookies(): Promise<IAribaWebsiteApi>;
}
