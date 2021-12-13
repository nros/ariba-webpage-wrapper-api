import type { IApiServer } from "./IApiServer";

import { ApiServerImpl } from "./impl/ApiServerImpl";

// install signal handlers
let apiServer: IApiServer;
function terminateProgram(): Promise<unknown> {
    console.log("\nTERMINATING");
    if (apiServer) {
        return apiServer.stop().catch(console.error);
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
