/**
 * The possible states of the purchase order
 */
export enum TPurchaseOrderState {
    All = -2,
    NEW = 0,
    CHANGED = 1,
    CONFIRMED = 2,
    FAILED = 3,
    DELIVERY_INITIATED = 4,
    FULLY_CONFIRMED = 5,
    RETURNED = 6,
    SERVICE_DONE = 7,
    INVOICED = 8,
    PARTIALLY_CONFIRMED = 9,
    PARTIAL_DELIVERY = 10,
    PARTIAL_PROCESSED = 11,
    SERVICE_PARTIALLY_DONE = 12,
    INVOICED_PARTIALLY = 13,
    REJECTED_PARTIALLY = 14,
    BACK_ORDERED_PARTIALLY = 15,
    PROCESSING = 16,
    REJECTED = 17,
    OUT_OF_DATE = 18,
    REFUSED = 19,
    ACCEPTED = 20,
}

/**
 * Data about a purches order as retrieved from the Ariba website.
 */
export interface IPurchaseOrder {
    /**
     * The id of the purchase order on the website.
     */
    readonly id: string;

    /**
     * The id of the purchase order on the website.
     */
    readonly state: TPurchaseOrderState;

    /**
     * Apply a new state to the purchase order.
     *
     * @param purchaseOrderId The ID of the purchase order to retrieve.
     */
    setNewState(newState: TPurchaseOrderState): Promise<IPurchaseOrder>;
}
