/// <reference types="node" />
import type { IAribaWebsite } from "ariba-website-wrapper";

import { createAribaWebsite } from "ariba-website-wrapper";
import { readConfiguaration } from "./Configuration";

// install signal handlers
let aribaWebSite: IAribaWebsite;
function terminateProgram(): Promise<unknown> {
    console.log("\nTERMINATING");
    if (aribaWebSite) {
        return aribaWebSite.close();
    }

    return Promise.resolve();
}
process.on("SIGINT", terminateProgram);
process.on("SIGTERM", terminateProgram);
process.on("SIGABRT", terminateProgram);
process.on("SIGQUIT", terminateProgram);


readConfiguaration()
    .then((config) => createAribaWebsite(config))
    .then((ariba) => {
        aribaWebSite = ariba;
        return ariba;
    })
    .then((ariba) => ariba.startSession())
    .then((ariba) => ariba.getAribaWebsiteApi())
    .then((ariba) => ariba.confirmPurchaseOrder(
        "0035928976",
        "2021-12-06T11:06:00.000Z",
        "2021-12-03T11:48:20.714Z",
            "1615248"
    ).then(() => ariba))
    .then((ariba) => ariba.confirmPurchaseOrder(
        "0035951102",
        "2021-12-13T08:15:00.000Z",
        "2021-12-10T07:58:24.439Z",
        "1638824"
    ).then(() => ariba))
    .then((ariba) => ariba.confirmPurchaseOrder(
        "0035948996",
        "2021-12-13T09:30:00.000Z",
        "2021-12-09T09:49:16.677Z",
        "1637162"
    ).then(() => ariba))
    .then((ariba) => {
        return new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000)).then(() => ariba);
    })
    .catch(console.error)
    .then(terminateProgram)
;
