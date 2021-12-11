/// <reference types="node" />
import type { IAribaConfiguration } from "ariba-website-wrapper";

import path from "path";
import fs from "fs";


export const CONFIG_FILE_NAME = "ariba.config.json";

/**
 * read username and password from configuration file.
 *
 * @param configFileName (optional) a specific config file to read. If unset, then {@link CONFIG_FILE_NAME} is used.
 */
export function readConfiguaration(configFileName?: string): Promise<IAribaConfiguration> {
    const configFile = path.resolve(configFileName || CONFIG_FILE_NAME);

    let jsonData: string = "";
    return fs.promises
        .readFile(configFile)
        .then((fileBuffer) => {
            jsonData = fileBuffer + "";
            return JSON.parse(jsonData) as IAribaConfiguration;
        })
        .catch((error) => {
            console.error("Failed to parse configuration file: ", configFile, "\n\nContent: ", jsonData);

            return Promise.reject(error);
        });
}
