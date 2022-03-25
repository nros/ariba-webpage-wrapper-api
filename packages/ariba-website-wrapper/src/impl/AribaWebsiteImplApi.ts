import type { Page } from "puppeteer";
import type { Logger } from "winston";

import type { IAribaDialogPage } from "../IAribaDialogPage.js";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { IAribaWebsiteApiWithLogin } from "../IAribaWebsiteApiWithLogin.js";
import type { TLoginError } from "../ILogin.js";
import type { IPurchaseOrder } from "../IPurchaseOrder.js";

import PQueue from "p-queue";
import { TPurchaseOrderState, status2String } from "../IPurchaseOrder.js";
import { LOGIN_REFRESH_TIMEOUT, MAX_LOGIN_REFRESH } from "../ILogin.js";

import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";


function isDialogPage(page: unknown): page is IAribaDialogPage {
    return !!page && (typeof (page as IAribaDialogPage).closeDialog === "function");
}


export class AribaWebsiteImplApi implements IAribaWebsiteApiWithLogin {
    private readonly _factory: IAribaFactory;
    private readonly _logger: Logger;

    // Ariba website is awfull and can just operate on a single page at once!
    private readonly _operationQueue = new PQueue({ concurrency: 1 });
    private readonly _page: Page;
    private _nextTaskOrderNumber = 1;

    private _lastLogin: Date = new Date(2);
    private _refreshLoginTimer?: ReturnType<typeof setTimeout>;
    private _refreshCounter = 0;

    public constructor(factory: IAribaFactory, page: Page) {
        this._factory = factory;
        this._logger = factory.createLogger("AribaWebsiteImplApi");
        this._page = page;
    }

    public get page(): Page {
        return this._page;
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

        return await this.addOperationAndWait("confirmPurchaseOrder", async () => {
            this._logger.info(`Confirming purchase order with ID ${purchaseOrderId}.`);

            const purchaseOrderPage = await this._factory.createPurchaseOrderPage(this.page);
            try {
                return await purchaseOrderPage.confirmPurchaseOrder(
                    purchaseOrderId,
                    new Date(estimatedDeliveryDate),
                    estimatedShippingDate ? new Date(estimatedShippingDate) : undefined,
                    supplierOrderId,
                );
            } finally {
                if (isDialogPage(purchaseOrderPage)) {
                    await purchaseOrderPage.closeDialog(purchaseOrderPage.page);
                }
            }
        });
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

        if (!carrierName) {
            throw new Error(`Carrier is invalid '${carrierName}'`);
        }

        let deliveryDateTimestamp: number;
        let shippingDateTimestamp: number;

        try {
            this._logger.debug(`Checking estimated delivery date: ${estimatedDeliveryDate}`);

            const check = new Date(estimatedDeliveryDate);
            deliveryDateTimestamp = check.getTime();

            this._logger.debug(`Estimated delivery date is: ${check}`);
        } catch (error) {
            throw new Error("Parameter 'estimatedDeliveryDate' is an invalid date");
        }

        if (shippingDate) {
            try {
                this._logger.debug(`Checking estimated shipping date: ${shippingDate}`);

                const check = new Date(shippingDate);
                shippingDateTimestamp = check.getTime();

                this._logger.debug(`Shipping date is: ${check}`);
            } catch (error) {
                throw new Error("Parameter 'shippingDate' is an invalid date");
            }

            if (deliveryDateTimestamp <= shippingDateTimestamp) {
                throw new Error("Delivery date can not be earlier than the shipping date.");
            }
        }

        return await this.addOperationAndWait("createShippingNotice", async () => {
            this._logger.info(`Confirming purchase order with ID ${purchaseOrderId}.`);
            const purchaseOrderPage = await this._factory.createPurchaseOrderPage(this.page);

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
                if (isDialogPage(purchaseOrderPage)) {
                    await purchaseOrderPage.closeDialog(purchaseOrderPage.page);
                }
            }
        });
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

        return await this.addOperationAndWait("createInvoice", async () => {
            this._logger.info(`Create invoice for purchase order with ID ${purchaseOrderId}.`);
            const purchaseOrderPage = await this._factory.createPurchaseOrderPage(this.page);

            try {
                return await purchaseOrderPage.createInvoice(
                    purchaseOrderId,
                    logisticsOrderId,
                    invoiceNumber || "",
                );
            } finally {
                if (isDialogPage(purchaseOrderPage)) {
                    await purchaseOrderPage.closeDialog(purchaseOrderPage.page);
                }
            }
        });
    }

    public async sendInvoiceToUrl(purchaseOrderId: string, targetUrl: string): Promise<string> {
        if (!purchaseOrderId) {
            throw new Error("Invalid purchase order ID!");
        }

        if (!targetUrl) {
            throw new Error("Invalid upload URL!");
        }

        let fileData: fs.ReadStream;

        return await this.addOperationAndWait("downloadInvoice", async () => {
            this._logger.info(`Download invoice for purchase order with ID ${purchaseOrderId}.`);
            const purchaseOrderPage = await this._factory.createPurchaseOrderPage(this.page);

            try {
                const downloadedInvoiceFilePath = await purchaseOrderPage.downloadInvoice(purchaseOrderId);
                if (!downloadedInvoiceFilePath) {
                    throw new Error(`Failed to download the invoice for purchase order ${purchaseOrderId}.`);
                }

                this._logger.debug(
                    `Uploading invoice PDF ${downloadedInvoiceFilePath} to target URL ${targetUrl}.`,
                );

                fileData = fs.createReadStream(downloadedInvoiceFilePath);
                const formData = new FormData();
                formData.append(
                    "file",
                    fileData,
                    path.basename(downloadedInvoiceFilePath),
                );

                await axios.post(targetUrl, formData, { headers: { ...formData.getHeaders() } });
                return downloadedInvoiceFilePath;

            } finally {
                if (isDialogPage(purchaseOrderPage)) {
                    await purchaseOrderPage.closeDialog(purchaseOrderPage.page);
                }
                if (fileData) {
                    fileData.close();
                }
            }
        });
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
        return await this.addOperationAndWait("getPurchaseOrderStatus", async () => {
            this._logger.info(`Get status of purchase order with ID ${purchaseOrderId}.`);
            const purchaseOrderPage = await this._factory.createPurchaseOrderPage(this.page);

            try {
                return {
                    id: purchaseOrderId,
                    state: await purchaseOrderPage.getOrderStatus(purchaseOrderId)
                        .then(status2String),
                };
            } finally {
                if (isDialogPage(purchaseOrderPage)) {
                    await purchaseOrderPage.closeDialog(purchaseOrderPage.page);
                }
            }
        });
    }

    public async getLastInvoiceNumber(): Promise<string> {
        return await this.addOperationAndWait("getLastInvoiceNumber", async () => {
            this._logger.info(`Getting last invoice number.`);
            const page = await this._factory.createInvoicePage(this.page);

            try {
                return await page.getLatestInvoiceNumber();
            } finally {
                if (isDialogPage(page)) {
                    await page.closeDialog(page.page);
                }
            }
        });
    }

    public async getNextInvoiceNumber(): Promise<string> {
        return await this.addOperationAndWait("getNextInvoiceNumber", async () => {
            this._logger.info(`Getting last invoice number.`);
            const page = await this._factory.createInvoicePage(this.page);

            try {
                return await page.getNextInvoiceNumber();
            } finally {
                if (isDialogPage(page)) {
                    await page.closeDialog(page.page);
                }
            }
        });
    }

    public async login(): Promise<void> {
        await this.addRefreshLoginSessionOperation();
    }

    public async deleteAllCookies(): Promise<IAribaWebsiteApiWithLogin> {
        const allCookies = await this.page.cookies();
        if (allCookies && allCookies.length > 0) {
            await this.page.deleteCookie(...allCookies);
        }

        await this.page.evaluate(() => {
            sessionStorage.clear();
            localStorage.clear();
        });
        return this;
    }

    public async openPurchaseOrderPage(purchaseOrderId:string): Promise<IAribaWebsiteApiWithLogin> {
        await this.addOperationAndWait("openPurchaseOrderPage", async () => {
            this._logger.info(`Open purchase order with ID ${purchaseOrderId}.`);
            const purchaseOrderPage = await this._factory.createPurchaseOrderPage(this.page);

            await purchaseOrderPage.navigateToPurchaseOrder(purchaseOrderId);
        });
        return this;
    }

    private async doLogin(): Promise<void> {
        this._logger.info("Logging into Ariba.");
        const loginPage = await this._factory.createLoginPage(this.page);
        await loginPage.login();
        this._lastLogin = new Date();
    }

    private async checkLoginSession(): Promise<number> {
        if (Date.now() - this._lastLogin.getTime() >= LOGIN_REFRESH_TIMEOUT) {
            await this.refreshLoginSession();
        }

        const nextRefresh = LOGIN_REFRESH_TIMEOUT - (Date.now() - this._lastLogin.getTime());
        this._logger.debug(`Session is still fresh. Next refresh is due at ${new Date(Date.now() + nextRefresh)}`);
        return nextRefresh;
    }

    private async refreshLoginSession(): Promise<void> {
        this._logger.info(`================= Executing next task 'LOGIN' ======================`);
        await this.doLogin();
        this._lastLogin = new Date();
    }

    private async addRefreshLoginSessionOperation(): Promise<void> {
        if (this._refreshLoginTimer) {
            clearTimeout(this._refreshLoginTimer);
            this._refreshLoginTimer = undefined;
        }

        await this._operationQueue.add(async () => {
            this._refreshCounter++;

            // close the session with the website and start a fresh one.
            if (this._refreshCounter > MAX_LOGIN_REFRESH) {
                await this.deleteAllCookies();
                await this.refreshLoginSession();
                this._refreshCounter = 0;
            }

            // set timer first
            let nextRefresh = LOGIN_REFRESH_TIMEOUT;
            try {
                nextRefresh = await this.checkLoginSession();
            } catch (error) {
                this._logger.error(`Failed to refresh login! ${error}`, { error });
            }

            this._logger.debug(`Next session refresh at ${new Date(Date.now() + nextRefresh)}`);
            this._refreshLoginTimer = setTimeout(this.addRefreshLoginSessionOperation.bind(this), nextRefresh);
        });
    }

    private addOperationAndWait<T>(taskName: string, task: () => Promise<T>): Promise<T> {
        taskName += `(${++this._nextTaskOrderNumber})`;

        // wait for the task to finish and return its result
        return new Promise((resolve: (data: T) => void, reject:(error: Error) => void) => {
            this._operationQueue.add(async () => {
                await this.checkLoginSession();

                this._logger.info(`================= Executing next task '${taskName}' ======================`);
                return task()
                    .catch((error) => {
                        // try again if the task failed because the login has expired
                        if ((error as TLoginError).isLoginNeeded) {
                            return this.doLogin().then(() => task());
                        } else {
                            return Promise.reject(error);
                        }
                    })
                    .then(
                        (data) => {
                            this._logger.debug(`----------------- ENDING task '${taskName}' -----------------`);
                            resolve(data);
                        },
                        (error) => {
                            this._logger.error(`!!!!!!!!!!! ERROR task '${taskName}' !!!!!!!!!!!!!!!!`, { error });
                            reject(error);
                        },
                    )
                    .catch()
                    .then();
            });
        });
    }
}
