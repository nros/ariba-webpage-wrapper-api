import { IAribaConfiguration } from "./IAribaConfiguration.js";
import { IAribaWebsite } from "./IAribaWebsite.js";
import { AribaWebsiteImpl } from "./impl/AribaWebsiteImpl.js";

export async function createAribaWebsite(configuration: IAribaConfiguration): Promise<IAribaWebsite> {
    return (new AribaWebsiteImpl())
        .init(configuration);
}
