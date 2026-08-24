import { createApp } from "./app.js";
import { serviceConfig } from "./config.js";
import startServersModule from "../../../platform/node/start-servers.cjs";

const { startServiceServers } = startServersModule;

createApp().then(async ({ app, manifest }) => {
  const runtime = await startServiceServers({
    app,
    env: process.env,
    publicPort: serviceConfig.port,
    serviceName: manifest.key,
    logger: console
  });
  console.log(`[${manifest.key}] listening on port ${serviceConfig.port}`);
  if (runtime.internalPort) {
    console.log(`[${manifest.key}] internal mTLS listening on ${runtime.internalPort}`);
  }
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
