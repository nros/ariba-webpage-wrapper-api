import type { IApiServer } from "./IApiServer.js";

import { ApiServerImpl } from "./impl/ApiServerImpl.js";

// install signal handlers
let apiServer: IApiServer;
async function terminateProgram(): Promise<void> {
    console.log("\nTERMINATING");
    if (apiServer) {
        try {
            await apiServer.stop();
        } catch (error) {
            console.log("FAILED TO STOP SERVER: ", error);
        }
    }
}

process.on("SIGINT", terminateProgram);
process.on("SIGTERM", terminateProgram);
process.on("SIGABRT", terminateProgram);
process.on("SIGQUIT", terminateProgram);

(async () => {
    apiServer = await new ApiServerImpl().start();
})().catch(console.error);
