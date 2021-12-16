import type { Page } from "puppeteer";
import type { IAribaPage } from "../IAribaPage";

import { BaseAribaPageImpl } from "./BaseAribaPageImpl";

/**
 * The base interface for all wrappers of Ariba website pages.
 */
export abstract class BaseAribaDialogPageImpl extends BaseAribaPageImpl {
    /**
     * Press "Done" on Ariba dialog
     */
    public async closeDialog(page: Page): Promise<IAribaPage> {
        this.createLogger("BaseAribaDialogPageImpl")
            .debug("Closing dialog page.");

        await this.pageHelper.deactivateAribaClickCheck(page);
        await Promise.all([
            page.evaluate(() =>
                window.ariba.Handlers.fakeClick(jQuery("button:contains('Done'):first")[0]),
            ),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]);
        return this;
    }
}
