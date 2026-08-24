import { getAiProfileForService } from "../architecture/ai-topology.js";
import express from "express";
import { brokerTopology } from "../architecture/event-contracts.js";
import { getRealtimeFlowsForService } from "../architecture/realtime-topology.js";
import { getResilienceProfileForService } from "../architecture/resilience-topology.js";
import { getSecurityProfileForService } from "../architecture/security-topology.js";
import { getServiceManifest } from "../architecture/service-manifests.js";
import { bootstrapBroker } from "./broker.js";
import startServersModule from "./start-servers.cjs";

export async function startService(serviceKey, configureApp) {
  const { startServiceServers } = startServersModule;
  const manifest = getServiceManifest(serviceKey);

  if (!manifest) {
    throw new Error(`Unknown service manifest: ${serviceKey}`);
  }

  const app = express();
  const broker = await bootstrapBroker(manifest);
  const port = Number(process.env.PORT || manifest.port);
  const aiProfile = getAiProfileForService(manifest.key);
  const realtimeFlows = getRealtimeFlowsForService(manifest.key);
  const resilienceProfile = getResilienceProfileForService(manifest.key);
  const securityProfile = getSecurityProfileForService(manifest.key);

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      service: manifest.key,
      status: "ok",
      port,
      brokerConnected: broker.connected
    });
  });

  async function attachServiceRoutes(app, manifest) {
    const routeCandidates = [
      `../../services/${manifest.key}/src/routes/index.js`,
      `../../services/${manifest.key}/src/routes.js`
    ];

    for (const candidate of routeCandidates) {
      const routeFile = new URL(candidate, import.meta.url).href;
      try {
        const serviceModule = await import(routeFile);
        if (typeof serviceModule.default === "function") {
          app.use(manifest.gatewayPath, serviceModule.default);
          return true;
        } else if (typeof serviceModule.register === "function") {
          serviceModule.register(app, manifest);
          return true;
        }
      } catch (error) {
        if (error.code !== "ERR_MODULE_NOT_FOUND" && !error.message.includes("Cannot find module")) {
          console.warn(`[${manifest.key}] failed to mount service routes:`, error.message);
          return false;
        }
      }
    }

    return false;
  }

  app.get("/architecture", (_request, response) => {
    response.json({
      ...manifest,
      broker: {
        provider: brokerTopology.provider,
        brokersEnv: brokerTopology.brokersEnv,
        connected: broker.connected,
        mode: broker.mode,
        supportedEvents: broker.supportedEvents
      },
      aiProfile,
      realtimeFlows,
      resilienceProfile,
      securityProfile
    });
  });

  app.get(`${manifest.gatewayPath}/health`, (_request, response) => {
    response.json({
      service: manifest.key,
      message: `${manifest.displayName} is reachable through the overall architecture`
    });
  });

  if (typeof configureApp === "function") {
    await configureApp(app, broker, manifest);
  } else {
    app.get(manifest.gatewayPath, (_request, response) => {
      response.json({
        service: manifest.key,
        displayName: manifest.displayName,
        gatewayPath: manifest.gatewayPath,
        protocols: manifest.protocols,
        dataStores: manifest.dataStores,
        producesEvents: manifest.publishes,
        consumesEvents: manifest.consumes,
        aiProfile,
        realtimeFlows,
        resilienceProfile,
        securityProfile,
        scope: "architecture-only"
      });
    });

    await attachServiceRoutes(app, manifest);
  }

  app.use((_request, response) => {
    response.status(404).json({
      service: manifest.key,
      error: "Route not found"
    });
  });

  await startServiceServers({
    app,
    env: process.env,
    publicPort: port,
    serviceName: manifest.key,
    logger: console
  });
}
