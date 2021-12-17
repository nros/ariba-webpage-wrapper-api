import type { ILogin } from "./ILogin.js";
import type { IAribaPage } from "./IAribaPage.js";

/**
 * The timeout to perform a login page reload
 */
export const LOGIN_REFRESH_TIMEOUT = Math.trunc(5 * 60 * 1000);

/***
 * Opens a login page and autheticates. The login page is kept open and refreshed every 5 minutes to keep the
 * authenticated session alive.
 */
export interface ILoginPage extends IAribaPage, ILogin {
}
