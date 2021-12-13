import type { Logger } from "winston";

export interface IAribaConfigurationPageUrls {
    overviewPageUrl: string; // the URL of the start page
}

export interface IAribaConfiguration extends IAribaConfigurationPageUrls {
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
        headless: boolean,
        width?: number; // defaults to 1980 if omitted
        height?: number; // defaults to 1024 if omitted
    },
}
