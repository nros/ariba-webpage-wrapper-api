import type { Page } from "puppeteer";

/**
 * The timeout to perform a login page reload
 */
export const LOGIN_REFRESH_TIMEOUT = Math.trunc(5 * 60 * 1000);

export type TLoginError = Error & { isLoginNeeded: boolean };

/***
 * Opens a login page and authenticates. The login page is kept open and refreshed every 5 minutes to keep the
 * authenticated session alive.
 */
export interface ILogin {
    /**
     * Opens the dashboard home on the provided page and tries to login if necessary.
     *
     * @param page the browser page to use for the login procedure. The current URL is changed. In the end
     *     then dashboard is opened in this page.
     */
    login(): Promise<void>;

    readonly page: Page;
}
