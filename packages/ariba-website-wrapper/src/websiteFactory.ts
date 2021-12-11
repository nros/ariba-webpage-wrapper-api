import { IAribaConfiguration } from "./IAribaConfiguration";
import { IAribaWebsite } from "./IAribaWebsite";
import { AribaWebsiteImpl } from "./impl/AribaWebsiteImpl";

export async function createAribaWebsite(configuration: IAribaConfiguration): Promise<IAribaWebsite> {
    return (new AribaWebsiteImpl())
        .init(configuration);
}
