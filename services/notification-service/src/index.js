import { createNotificationApp } from "./app.js";
import { loadNotificationEnv } from "./load-env.js";
import { startRealtimeRelay } from "./realtime-relay.js";
import mtlsClient from "../../../platform/node/mtls-client.cjs";
import startServersModule from "../../../platform/node/start-servers.cjs";

loadNotificationEnv();
const { createMtlsFetch } = mtlsClient;
const { startServiceServers } = startServersModule;
const internalFetch = createMtlsFetch({ env: process.env, prefix: "INTERNAL_TLS" });

const runtime = await createNotificationApp({
  logger: console
});

const port = Number.parseInt(process.env.PORT || "3108", 10);
const serverRuntime = await startServiceServers({
  app: runtime.app,
  env: process.env,
  publicPort: port,
  serviceName: "notification-service",
  logger: console
});

let realtimeRelay = await startRealtimeRelay({
  fetchImpl: internalFetch,
  logger: console
}).catch((error) => {
  console.error("[notification-service] failed to start realtime relay", error);
  return null;
});

async function shutdown(signal) {
  console.log(`[notification-service] received ${signal}, shutting down...`);

  if (realtimeRelay) {
    await realtimeRelay.close();
  }

  await runtime.close();
  await serverRuntime.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
