import type { Page } from "puppeteer";
import type { IAribaPage } from "./IAribaPage";

import type { IPurchaseOrder } from "./IPurchaseOrder";

import { TPurchaseOrderState } from "./IPurchaseOrder";

export interface IPurchaseOrderPage extends IAribaPage {
    /**
     * Opens the page order status dialog and confirms the specified order.
     *
     * @param purchaseOrderId The ID of the purchase order to confirm.
     * @param estimatedDeliveryDate The ID of the purchase order to confirm.
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
     * Prepares the purchase order search page filters by opening them and applying common filters.
     *
     * @param page the page to set the filters to.
     * @param filterForState the state of the purchase order to search for.
     * @private
     */
    setPurchaseOrdersFilterOpen(page: Page): Promise<Page>;

    /**
     * Sets the purchase order filter of the Purchase Order (PO) state.
     *
     * @param page the page to set the filters to.
     * @param filterForState the state of the purchase order to search for.
     * @private
     */
    setPurchaseOrdersFilterPoState(page: Page, filterForState: TPurchaseOrderState): Promise<Page>;

    /**
     * Sets the date range filter to the maximum days (32) or to "none".
     *
     * @param isUseNone (optional) if {@code true}, then the date range is set to "none" of the page supports that.
     * @private
     */
    setPurchaseOrdersFilterDateRange(page: Page, isUseNone?: boolean): Promise<Page>;

    /**
     * Sets the order number in the purchase order page to the given value.
     *
     * @param orderId The order ID to set.
     * @private
     */
    setPurchaseOrdersFilterOrderNumber(page: Page, orderId: string): Promise<Page>;
}
