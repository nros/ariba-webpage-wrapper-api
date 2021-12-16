import type express from "express";
import type { IAribaWebsite } from "ariba-website-wrapper";
import type { IMiddleware } from "../IMiddleware";
import type { RequestWithAuthentication } from "./AuthenticatorJsonImpl";
import type { RequestWithConfig } from "./ConfigMiddleware";
import type { TAsyncMiddleware } from "./BaseMiddleware";
import type { IMiddlewareNeedsTimer } from "../IMiddlewareNeedsTimer";

import { createAribaWebsite } from "ariba-website-wrapper";
import { BaseMiddleware } from "./BaseMiddleware";

interface IAribaWebsiteCacheEntry {
    user: string;
    ariba: IAribaWebsite;
    lastUsed: Date,
}

const MAX_CACHE_TIME = 120 * 60 * 1000; // 2 hours

export type RequestWithAribaWebsite = express.Request & {
    aribaWebsite?: IAribaWebsite;
};

export class AribaApiMiddleware extends BaseMiddleware implements IMiddleware, IMiddlewareNeedsTimer {
    private _cachedAribaWebsites: { [user: string]: IAribaWebsiteCacheEntry } = {};

    public get timerInterval(): number {
        return 15 * 60 * 1000; // 15 minutes
    }

    public timerEvent(): void {
        const evictionDate = Date.now() - MAX_CACHE_TIME;
        for (const user of Object.getOwnPropertyNames(this._cachedAribaWebsites)) {
            if (this._cachedAribaWebsites[user].lastUsed.getTime() < evictionDate) {
                this._cachedAribaWebsites[user].ariba?.close();
                delete this._cachedAribaWebsites[user];
            }
        }
    }

    public close(): void {
        for (const user of Object.getOwnPropertyNames(this._cachedAribaWebsites)) {
            this._cachedAribaWebsites[user].ariba?.close();
        }
        this._cachedAribaWebsites = {};
    }

    protected getMiddleware(): PromiseLike<TAsyncMiddleware[]> {
        const middleware: TAsyncMiddleware = async (request) => {
            // authentication has been performed previously
            const userData = (request as RequestWithAuthentication).auth;
            const user = userData?.user;

            if (userData && user) {
                let cacheEntry = this._cachedAribaWebsites[user];

                if ((!cacheEntry || !cacheEntry.ariba) && !userData?.aribaUsername || !userData?.aribaPassword) {
                    throw new Error("Missing Ariba user name or password to connect to Ariba website.");

                } else if (!cacheEntry?.ariba) {
                    const baseConfig = (request as RequestWithConfig).apiConfig || {};
                    cacheEntry = {
                        user,
                        ariba: await createAribaWebsite({
                            ...baseConfig,
                            username: userData.aribaUsername,
                            password: userData.aribaPassword,
                        }),
                        lastUsed: new Date(),
                    };

                    // add the entry now
                    this._cachedAribaWebsites[user] = cacheEntry;
                }

                this._cachedAribaWebsites[user].lastUsed = new Date();
                (request as RequestWithAribaWebsite).aribaWebsite = this._cachedAribaWebsites[user].ariba;
            }
        };

        return Promise.resolve([middleware]);
    }
}
