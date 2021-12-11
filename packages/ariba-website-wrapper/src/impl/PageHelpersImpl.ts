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

    public async executeSerializedFunction(page: Page, functionText: string): Promise<Page> {
        if (!functionText) {
            return page;
        }

        const id = "functionExecutor_" + Math.trunc(Math.random() * 99999) + Math.trunc(Math.random() * 99999);

        console.trace("EXECUTING REMOTE FUNCTION: ", `(function() { ${functionText}; })();`);
        const handle = await page.addScriptTag({
            id: id,
            type: "text/javascript",
            content: `alert("Script added");`,
        });
        console.trace("SCript added ",
            await page.evaluate((id) =>
                document.getElementById("#" + id)?.innerHTML,
            id),
        );
        await page.evaluate((id) => {
            setTimeout(function () {
                const elem = document.getElementById("#" + id);
                if (elem && elem.parentElement) {
                    // elem.parentElement.removeChild(elem);
                }
            }, 10000);
        }, id);
        return page;
    }
}
