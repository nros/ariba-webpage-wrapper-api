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

export function status2String(status: TPurchaseOrderState): string {
    const translate: { [key: string]: string } = {
        "i-2": "All",
        "i0": "NEW",
        "i1": "CHANGED",
        "i2": "CONFIRMED",
        "i3": "FAILED",
        "i4": "DELIVERY_INITIATED",
        "i5": "FULLY_CONFIRMED",
        "i6": "RETURNED",
        "i7": "SERVICE_DONE",
        "i8": "INVOICED",
        "i9": "PARTIALLY_CONFIRMED",
        "i10": "PARTIAL_DELIVERY",
        "i11": "PARTIAL_PROCESSED",
        "i12": "SERVICE_PARTIALLY_DONE",
        "i13": "INVOICED_PARTIALLY",
        "i14": "REJECTED_PARTIALLY",
        "i15": "BACK_ORDERED_PARTIALLY",
        "i16": "PROCESSING",
        "i17": "REJECTED",
        "i18": "OUT_OF_DATE",
        "i19": "REFUSED",
        "i20": "ACCEPTED",
    };

    return translate["i" + status] || "UNKNOWN";
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
     * The date of the invoice
     */
    invoiceDate?: Date;
}
