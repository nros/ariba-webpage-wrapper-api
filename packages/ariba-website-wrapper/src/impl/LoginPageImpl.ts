import type { ILoginPage } from "../ILoginPage.js";

import { BaseAribaPageImpl } from "./BaseAribaPageImpl.js";

/***
 * Opens a login page and authenticates. The login page is kept open and refreshed every 5 minutes to keep the
 * authenticated session alive.
 */
export class LoginPageImpl extends BaseAribaPageImpl implements ILoginPage {
    private _refreshTimer?: ReturnType<typeof setTimeout>;

    public get loggerName(): string {
        return "LoginPageImpl";
    }

    public async login(): Promise<void> {
        const page = this.page;

        // open the home page and see whether this is successful or a login form appears
        this._logger.debug("Loading start page to check for login form!");
        await page.goto(this.config.overviewPageUrl);

        // the home page has multiple redirect and sometimes blocks loading some unimportant assets.
        this._logger.debug("waiting for network idel2 after page load");
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // which page has been loaded? check to see if the session was still active!
        this._logger.debug("Waiting for login or overview page loading.");
        await page.waitForSelector("div.dashboard-container, .loginFormBox input[name='UserName']");

        this._logger.debug("Is already logged in? Check whether login form has been loaded");
        const isAlreadyLoggedIn = await page.evaluate(() =>
            document.querySelectorAll(".loginFormBox input[name='UserName']").length === 0,
        );

        if (!isAlreadyLoggedIn) {
            this._logger.debug("Performing a login with the user credentials");

            // fill the login form
            await page.waitForSelector(".loginFormBox input[name='UserName']", { visible: true });

            this._logger.debug("Setting user name");
            await page.focus(".loginFormBox input[name='UserName']");
            await page.keyboard.type("" + this.config.username);

            this._logger.debug("Setting password");
            await page.focus(".loginFormBox input[name='Password']");
            await page.keyboard.type("" + this.config.password);

            this._logger.debug("performing submit and waiting for page navigation");
            await this.pageHelper.deactivateAribaClickCheck(page);
            await Promise.all([
                page.evaluate(() => jQuery("input[type='submit']").trigger("click")),
                page.waitForNavigation(),
            ]);

            try {
                this._logger.debug("Waiting for dashboard to load.");
                await page.waitForSelector("app-overview-tiles");
            } catch (err) {
                let errorMessage = err + "";
                if (err instanceof Error) {
                    errorMessage = err.message;
                }

                this._logger.error("Dashboard failed to load.");
                throw new Error("Login has failed or overview page is unexpected! " + errorMessage);
            }

            this._logger.debug("Login has been performed successfully");
        } else {
            this._logger.debug("User is already logged in");
        }
    }
}
