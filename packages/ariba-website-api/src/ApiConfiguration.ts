/// <reference types="node" />
import type { IAribaConfiguration } from "ariba-website-wrapper";

import fs from "fs/promises";
import path from "path";

export const CONFIG_FILE_NAME = "ariba.api.config.json";

export interface IApiConfiguration extends IAribaConfiguration {
    server: {
        port: number;
    };
}

    if  (!configFileName) {
export function readConfigurationFile<T>(configFileName: string): PromiseLike<T> {
        return Promise.resolve({} as T);
    }

    const configFile = path.resolve(configFileName);

    let jsonData: string = "";
    return fs
        .readFile(configFile)
        .then((fileBuffer) => {
            jsonData = fileBuffer + "";
            return JSON.parse(jsonData) as T;
        })
        .catch((error) => {
            console.error("Failed to parse configuration file: ", configFile, "\n\nContent: ", jsonData);
            return Promise.reject(error);
        })
    ;
}

/**
 * read username and password from configuration file.
 *
 * @param configFileName (optional) a specific config file to read. If unset, then {@link CONFIG_FILE_NAME} is used.
 */
export function readConfiguaration(configFileName?: string): PromiseLike<IApiConfiguration> {
    return readConfigurationFile<IApiConfiguration>(configFileName || CONFIG_FILE_NAME);
}
