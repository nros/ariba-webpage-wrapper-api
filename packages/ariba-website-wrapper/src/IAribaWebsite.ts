import type { IAribaConfiguration } from "./IAribaConfiguration.js";
import type { IAribaWebsiteApi } from "./IAribaWebsiteApi.js";

/**
 * A wrapper around a browser instance to drive the Ariba webshop.
 *
 * <p>
 * Since the authenticated session is strongly bound to a single browser instance, a new such instance must be
 * created with every login credentials supplied. Never mix the same instance with different credentials!
 * </p>
 */
export interface IAribaWebsite {
    /**
     * Initialises the website wrapper with the required configuration but no session is started.
     *
     * <p>
     * This function must be called prior to every other function or property. Failing to do so, will fail the
     * execution of other member functions.
     * </p>
     */
    init(config: IAribaConfiguration): IAribaWebsite;

    /**
     * Get the configuration data to use.
     */
    readonly config: IAribaConfiguration;

    /**
     * Login into the Ariba website and starts a session.
     *
     * <p>
     *     The session is kept alive by reloading a page every 5 minutes.
     * </p>
     */
    startSession(): Promise<IAribaWebsite>;

    /**
     * Stops the session refresh mechanism, closes the session and deletes all cookies.
     */
    stopSession(): Promise<IAribaWebsite>;

    /**
     * Stops the login session, closes the browser instance and free all system resources.
     */
    close(): Promise<void>;

    /**
     * Get the Ariba website API.
     */
    getAribaWebsiteApi(): Promise<IAribaWebsiteApi>;
}
