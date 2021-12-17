import type { Page } from "puppeteer";
import type { IPageHelpers } from "../IPageHelpers.js";

export class PageHelpersImpl implements IPageHelpers {
    public async deactivateAribaClickCheck(page: Page): Promise<Page> {
        await page.addScriptTag({
            // id: "aribaClickBlockerDeactivator",
            type: "text/javascript",
            content: "if (window.ariba) { (window.ariba.Event || {}).handleMouseEvent = function () {return true;} }",
        });
        /*
        await page.evaluate(() => {
            const elem = document.getElementById("aribaClickBlockerDeactivator");
            if (elem && elem.parentElement) {
                elem.parentElement.removeChild(elem);
            }
        });
        */
        return page;
    }

    public async loadJQuery(page: Page): Promise<Page> {
        const isJQueryInstalled = await page.evaluate(() => !!window.jQuery);
        if (!isJQueryInstalled) {
            await page.addScriptTag({
                type: "text/javascript",
                url: "https://service.ariba.com/an/3569122807/ariba/ui/aribaweb/jquery.js",
            });
        }

        return page;
    }
}
