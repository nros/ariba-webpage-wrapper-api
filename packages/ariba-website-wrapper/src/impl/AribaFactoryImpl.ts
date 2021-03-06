import type { Browser, Page } from "puppeteer";
import type * as Transport from "winston-transport";

import type { IAribaConfiguration } from "../IAribaConfiguration.js";
import type { IAribaFactory } from "../IAribaFactory.js";
import type { PageWithClient } from "../IAribaPage";
import type { IAribaWebsiteApiWithLogin } from "../IAribaWebsiteApiWithLogin.js";
import type { IInvoicePage } from "../IInvoicePage.js";
import type { ILoginPage } from "../ILoginPage.js";
import type { IPageFormHelper } from "../IPageFormHelper.js";
import type { IPageHelpers } from "../IPageHelpers.js";
import type { IPurchaseOrderPage } from "../IPurchaseOrderPage.js";

import winston from "winston";
import puppeteer from "./puppeteer-with-plugins.js";

import { AribaWebsiteImplApi } from "./AribaWebsiteImplApi.js";
import { InvoicePageImpl } from "./InvoicePageImpl.js";
import { LoginPageImpl } from "./LoginPageImpl.js";
import { PageFormHelperImpl } from "./PageFormHelperImpl.js";
import { PageHelpersImpl } from "./PageHelpersImpl.js";
import { PurchaseOrderPageImpl } from "./PurchaseOrderPageImpl.js";

interface Console {
    [funcName: string]: (...args: unknown[]) => void;
}


export class AribaFactoryImpl implements IAribaFactory {
    private readonly _config: IAribaConfiguration;

    private _browser?: Browser;
    private _logger: winston.Logger;
    private _pageHelper?: IPageHelpers;
    private _pageFormHelper?: IPageFormHelper;

    public constructor(configuration: IAribaConfiguration) {
        this._config = configuration;

        const { combine, splat, timestamp, printf } = winston.format;
        const myFormat = printf(({ level, message, timestamp, loggerName, ...metadata }) => {
            let msg = `${timestamp} [${level}] ${loggerName}: ${message} `;

            if (metadata) {
                const metadataMessage = JSON.stringify(metadata, undefined, 4);
                if (metadataMessage.trim() !== "{}") {
                    msg += " " + metadataMessage;
                }
            }
            return msg;
        });

        if (typeof configuration.logger === "function") {
            this._logger = configuration.logger();
            //
        } else {
            const logLevel = configuration.logger?.logLevel || "debug";
            this._logger = winston.createLogger({
                level: logLevel,
                format: combine(
                    winston.format.colorize(),
                    splat(),
                    timestamp(),
                    myFormat,
                ),
                transports: [
                    new winston.transports.Console({ level: logLevel }) as Transport,
                ].concat(((): Transport[] => (configuration.logger?.logFile && [
                    new winston.transports.File({ filename: configuration.logger.logFile, level: logLevel }) as Transport,
                ]) || [])()),
            });
        }
    }

    public get config(): IAribaConfiguration {
        return this._config;
    }

    public async getBrowser(): Promise<Browser> {
        if (!this._browser) {
            this._browser = await puppeteer.launch({
                defaultViewport: this.getViewportSize(this.config),
                devtools: false,
                headless: !!this.config.screenResolution?.headless,
                args: ["--lang=en-US,en"],
                slowMo: 50, // Ariba website is so heavy weight, it seems to need some slow down
            });

            // close all pages created by default
            (await this._browser.pages()).forEach((page) => page.close());
        }

        return this._browser;
    }

    public async createAribaWebsiteApi(page: PageWithClient): Promise<IAribaWebsiteApiWithLogin> {
        return new AribaWebsiteImplApi(this, page);
    }

    public createNewPage(): Promise<PageWithClient> {
        return this.getBrowser()
            .then((browser) => browser.newPage())
            .then(async (page) => {
                if (!page) {
                    return Promise.reject<PageWithClient>(new Error("Failed to create a new page!"));
                }

                // setting a specific user agent to speed up headless mode
                // see: https://github.com/puppeteer/puppeteer/issues/1718
                await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36");

                await page.setViewport(this.getViewportSize(this._config));

                // --- set language to English
                await page.setExtraHTTPHeaders({ "Accept-Language": "en" });
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, "language", {
                        get: function () {
                            return "en-US";
                        },
                    });
                    Object.defineProperty(navigator, "languages", {
                        get: function () {
                            return ["en-US", "en"];
                        },
                    });
                });

                // add a script to enable jQuery all the time
                await page.evaluateOnNewDocument(() => {
                    if (window.ariba) {
                        (window.ariba.Event || {}).handleMouseEvent =
                        function () { return true; };
                    }

                    if (!window.jQuery) {
                        // Load the script
                        const script = document.createElement("SCRIPT") as HTMLScriptElement;
                        script.src = "https://service.ariba.com/an/3569122807/ariba/ui/aribaweb/jquery.js";
                        script.type = "text/javascript";
                        document.getElementsByTagName("head")[0].appendChild(script);

                        return new Promise((resolve, reject) => {
                            script.onload = function () {
                                resolve(window.jQuery);
                            };
                            script.onerror = function (error) {
                                reject(error);
                            };
                        });
                    } else {
                        return Promise.resolve(window.jQuery);
                    }
                });

                page.on("console", async (msg) =>
                    ((console as unknown as Console)[(msg as unknown as {_type: string})._type || "log"] ||
                        console.log
                    )(
                        ...await Promise.all(msg.args().map(arg => arg.jsonValue().catch((error) => error))),
                    ))
                ;

                // for debugging purposes
                if (this._config.debugBrowserConsole) {


                    page.on("console", (message) => {
                        const logFuncName = Object.getOwnPropertyNames(console)
                            .filter((name) => name === message.type())
                            .shift() || "log";

                        const consoleObject = (
                            console as unknown as { [name: string]: (...params: unknown[]) => { /* */ } }
                        );
                        consoleObject[logFuncName].call(
                            null,
                            ["PAGE LOG:", message.text(), ...message.args(), message.stackTrace()],
                        );
                    });
                }

                // since version 14.4.0, the internal property "_client()" is part of the page. So, just type
                // changing is required.
                return page as PageWithClient;
            })
        ;
    }

    public async close(): Promise<void> {
        if (this._browser) {
            await this._browser.close();
            this._browser = undefined;
        }
    }

    public getPageHelper(): IPageHelpers {
        if (!this._pageHelper) {
            this._pageHelper = new PageHelpersImpl();
        }

        return this._pageHelper;
    }

    public getFormHelper(): IPageFormHelper {
        if (!this._pageFormHelper) {
            this._pageFormHelper = new PageFormHelperImpl(this);
        }

        return this._pageFormHelper;
    }

    public createLogger(loggerName: string): winston.Logger {
        return this._logger.child({ loggerName });
    }

    public async createPurchaseOrderPage(page: PageWithClient): Promise<IPurchaseOrderPage> {
        return new PurchaseOrderPageImpl(this, page);
    }

    public async createLoginPage(page: PageWithClient): Promise<ILoginPage> {
        return new LoginPageImpl(this, page);
    }

    public async createInvoicePage(page: PageWithClient): Promise<IInvoicePage> {
        return new InvoicePageImpl(this, page);
    }

    private getViewportSize(config?: IAribaConfiguration): { width: number, height: number } {
        const configScreenResolution =
            (config || this._config || {}).screenResolution || {} as { width: number, height: number};

        return {
            ...configScreenResolution,
            width: (configScreenResolution.width &&
                Number.isInteger(configScreenResolution.width) && configScreenResolution.width
            ) || 1920,
            height: (configScreenResolution.height &&
                Number.isInteger(configScreenResolution.height) && configScreenResolution.height
            ) || 1080,
        };
    }
}
