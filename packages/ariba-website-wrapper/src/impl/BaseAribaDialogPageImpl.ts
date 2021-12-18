import type { Page } from "puppeteer";
import type { IAribaDialogPage } from "../IAribaDialogPage.js";

import { BaseAribaPageImpl } from "./BaseAribaPageImpl.js";

/**
 * The base interface for all wrappers of Ariba website pages.
 */
export abstract class BaseAribaDialogPageImpl extends BaseAribaPageImpl implements IAribaDialogPage {
    public async closeDialog(page: Page): Promise<IAribaDialogPage> {
        this.createLogger("BaseAribaDialogPageImpl")
            .debug("Closing dialog page.");

        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            page.evaluate(() =>
                window.ariba?.Handlers?.fakeClick(jQuery("button:contains('Done')").first()[0]),
            ),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]).catch((error) => this._logger.error(error));

        // this session storage item makes Ariba website re-open detail page again
        await page.evaluate(() => {
            sessionStorage.removeItem("an:pageName");
        }).catch();

        // wait two seconds. For some reason, puppeteer is too fast for Ariba web site
        await new Promise((resolve) => setTimeout(resolve, 2 * 1000));

        return this;
    }
}
