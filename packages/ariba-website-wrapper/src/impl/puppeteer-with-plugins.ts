import type { Browser } from "puppeteer";
import puppeteer from "puppeteer";

/*
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
// import BlockResources from "puppeteer-extra-plugin-block-resources";
*/

export type TBrowser = Browser;


// apply some plugins
/*
puppeteer
    .use(AdblockerPlugin())
    .use(StealthPlugin())
;
 */

export default puppeteer;
