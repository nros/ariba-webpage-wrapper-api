import type { Page } from "puppeteer";
import type { IAribaPage } from "./IAribaPage";

/**
 * The timeout to perform a login page reload
 */
export const LOGIN_REFRESH_TIMEOUT = Math.trunc(5 * 60 * 1000);

/***
 * Opens a login page and autheticates. The login page is kept open and refreshed every 5 minutes to keep the
 * authenticated session alive.
 */
export interface ILoginPage extends IAribaPage {
    /**
     * Login into the Ariba website and starts a session.
     *
     * <p>
     *     The session is kept alive by reloading a page every 5 minutes.
     * </p>
     */
    startSession(): Promise<ILoginPage>;

    /**
     * Stops the session refresh mechanism, closes the session and deletes all cookies.
     */
    stopSession(): Promise<ILoginPage>;

    /**
     * Opens the dashboard home on the provided page and tries to login if necessary.
     *
     * @param page the browser page to use for the login procedure. The current URL is changed. In the end
     *     then dashboard is opened in this page.
     */
    login(page: Page): Promise<Page>;
}
