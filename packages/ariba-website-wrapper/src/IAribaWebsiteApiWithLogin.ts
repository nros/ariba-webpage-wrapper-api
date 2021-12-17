import type { IAribaWebsiteApi } from "./IAribaWebsiteApi.js";
import type { ILogin } from "./ILogin.js";

/**
 * A wrapper of the Ariba webshop website to perform some actions utilising an internal headless browser.
 */
export interface IAribaWebsiteApiWithLogin extends IAribaWebsiteApi, ILogin {
}
