import type { TBrowser } from "./puppeteer-with-plugins.js";
import { IPurchaseOrder, TPurchaseOrderState } from "../IPurchaseOrder.js";

export class PurchaseOrderImpl implements IPurchaseOrder {
    private readonly _id: string;
    private readonly _browser: TBrowser;

    private _state: TPurchaseOrderState = TPurchaseOrderState.All;

    public constructor(
        brwoser: TBrowser,
        id: string,
    ) {
        this._id = id;
        this._browser = brwoser;
    }

    public get id(): string {
        return this._id;
    }

    public get state(): TPurchaseOrderState {
        return this._state;
    }

    public setNewState(newState: TPurchaseOrderState): Promise<IPurchaseOrder> {
        if (newState === TPurchaseOrderState.All) {
            return Promise.reject(new Error("Invalid state provided"));
        }

        return Promise.resolve(this);
    }

    private loadDataFromBrowser(): Promise<IPurchaseOrder> {
        return Promise.resolve(this);
    }
}
