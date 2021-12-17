import type { IApiServer } from "./IApiServer.js";

import { ApiServerImpl } from "./impl/ApiServerImpl.js";

// install signal handlers
let apiServer: IApiServer;
function terminateProgram(): Promise<unknown> {
    console.log("\nTERMINATING");
    if (apiServer) {
        return Promise.resolve(apiServer.stop()).catch(console.error);
    }

    return Promise.resolve();
}
process.on("SIGINT", terminateProgram);
process.on("SIGTERM", terminateProgram);
process.on("SIGABRT", terminateProgram);
process.on("SIGQUIT", terminateProgram);

(async () => {
    apiServer = await new ApiServerImpl().start();
})().catch(console.error);
