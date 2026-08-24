import http from "node:http";
import mtlsServer from "../../../platform/node/mtls-server.cjs";
import { createGatewayApp } from "./app.js";
import { createRealtimeHub } from "./realtime/hub.js";

export async function createGatewayServer(options = {}) {
  const runtime = await createGatewayApp(options);
  const env = options.env || process.env;
  const { createServiceServer } = mtlsServer;
  const server = http.createServer(runtime.app);
  const internalServer = env.GATEWAY_INTERNAL_TLS_ENABLED
    ? createServiceServer(runtime.app, env, { prefix: "GATEWAY_INTERNAL_TLS" })
    : null;
  const realtimeHub = createRealtimeHub({
    endpoint: options.realtimeEndpoint || "/realtime",
    jwtService: runtime.dependencies.jwtService,
    store: runtime.dependencies.store,
    logger: runtime.dependencies.logger,
    metrics: runtime.dependencies.metrics,
    rideServiceUrl: runtime.dependencies.env.RIDE_SERVICE_URL,
    fetchImpl: options.fetchImpl || runtime.dependencies.fetchImpl || globalThis.fetch,
    upstreamTimeoutMs: Number(runtime.dependencies.env.UPSTREAM_TIMEOUT_MS || 5000),
    forwardDriverLocationUpdate: options.forwardDriverLocationUpdate,
    resolveRideAccessContext: options.resolveRideAccessContext
  });

  runtime.dependencies.realtimePublisher.publish = (userIds, event) => {
    const targets = Array.isArray(userIds) ? userIds : [userIds];
    return targets.reduce(
      (deliveredCount, userId) => deliveredCount + realtimeHub.publishToUser(String(userId), event),
      0
    );
  };

  realtimeHub.attach(server);

  return {
    ...runtime,
    server,
    realtimeHub,
    internalServer,
    async close() {
      realtimeHub.close();

      if (internalServer?.listening) {
        await new Promise((resolve, reject) => {
          internalServer.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }

      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }

      await runtime.close();
    }
  };
}

export async function startGatewayServer(options = {}) {
  const runtime = await createGatewayServer(options);
  const env = options.env || process.env;
  const port = Number(env.PORT || 3000);

  await new Promise((resolve, reject) => {
    runtime.server.listen(port, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  if (runtime.internalServer) {
    const internalPort = Number(env.GATEWAY_INTERNAL_TLS_PORT || 3443);
    await new Promise((resolve, reject) => {
      runtime.internalServer.listen(internalPort, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  runtime.dependencies.logger.info({
    event: "gateway.started",
    port
  });

  return runtime;
}
