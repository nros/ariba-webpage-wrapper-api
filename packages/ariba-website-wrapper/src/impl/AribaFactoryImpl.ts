import type { Browser, Page } from "puppeteer";
import type * as Transport from "winston-transport";

import type { IAribaConfiguration } from "../IAribaConfiguration";
import type { IAribaFactory } from "../IAribaFactory";
import type { IAribaWebsiteApi } from "../IAribaWebsiteApi";
import type { ILoginPage } from "../ILoginPage";
import type { IPageHelpers } from "../IPageHelpers";
import type { IPurchaseOrderPage } from "../IPurchaseOrderPage";

import puppeteer from "./puppeteer-with-plugins";
import { AribaWebsiteImplApi } from "./AribaWebsiteImplApi";
import { LoginPageImpl } from "./LoginPageImpl";
import { PageHelpersImpl } from "./PageHelpersImpl";
import { PurchaseOrderPageImpl } from "./PurchaseOrderPageImpl";
import { createLogger, format, transports, Logger } from "winston";

interface Console {
    [funcName: string]: (...args: unknown[]) => void;
}


export class AribaFactoryImpl implements IAribaFactory {
    private readonly _config: IAribaConfiguration;

    private _browser?: Browser;
    private _logger: Logger;
    private _website?: IAribaWebsiteApi;
    private _pageHelper?: IPageHelpers;

    public constructor(configuration: IAribaConfiguration) {
        this._config = configuration;

        const { combine, splat, timestamp, printf } = format;
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
            this._logger = createLogger({
                level: logLevel,
                format: combine(
                    format.colorize(),
                    splat(),
                    timestamp(),
                    myFormat,
                ),
                transports: [
                    new transports.Console({ level: logLevel }) as Transport,
                ].concat(((): Transport[] => (configuration.logger?.logFile && [
                    new transports.File({ filename: configuration.logger.logFile, level: logLevel }) as Transport,
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
                devtools: true,
                headless: false,
                args: ["--lang=en-US,en"],
                // slowMo: 25, // for debugging purpose
            });
        }

        return this._browser;
    }

    public async createAribaWebsiteApi(): Promise<IAribaWebsiteApi> {
        if (!this._website) {
            this._website = new AribaWebsiteImplApi(this);
        }

        return this._website;
    }

    public createNewPage(): Promise<Page> {
        return this.getBrowser()
            .then((browser) => browser.newPage())
            .then(async (page) => {
                if (!page) {
                    return Promise.reject<Page>(new Error("Failed to create a new page!"));
                }

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
                        ((window.ariba as any).Event || {}).handleMouseEvent =
                        function () { return true; };
                    }

                    if (!window.jQuery) {
                        // Load the script
                        const script = document.createElement("SCRIPT") as HTMLScriptElement;
                        script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js";
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

                return page;
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

    public createLogger(loggerName: string): Logger {
        return this._logger.child({ loggerName });
    }

    public async createPurchaseOrderPage(): Promise<IPurchaseOrderPage> {
        return new PurchaseOrderPageImpl(this);
    }

    public async createLoginPage(): Promise<ILoginPage> {
        return new LoginPageImpl(this);
    }

    private getViewportSize(config?: IAribaConfiguration): { width: number, height: number } {
        const configScreenResolution = (config || this._config || {}).screenResolution || {};

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
