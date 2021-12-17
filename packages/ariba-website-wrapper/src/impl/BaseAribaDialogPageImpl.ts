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
                window.ariba.Handlers.fakeClick(jQuery("button:contains('Done')").first()[0]),
            ),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]);

        // this session storage item makes Ariba website re-open detail page again
        await page.evaluate(() => {
            sessionStorage.removeItem("an:pageName");
        });

        return this;
    }
}
