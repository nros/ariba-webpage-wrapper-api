import type { Logger } from "winston";

export interface IAribaConfiguration {
    /**
     * Read browser console messages and print them on the console.
     */
    debugBrowserConsole?: boolean;

    logger?: {
        logLevel?: string & ("debug" | "info" | "warning" | "error" | "critical"),
        logFile?: string;
    } | (() => Logger),

    username: string;
    password: string;
    screenResolution?: {
        width?: number; // defaults to 1980 if omitted
        height?: number; // defaults to 1024 if omitted
    },

    overviewPageUrl: string; // the URL of the start page

}
