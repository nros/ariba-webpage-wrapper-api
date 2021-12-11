import type { Page } from "puppeteer";
import type { IPageHelpers } from "../IPageHelpers";

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
}
