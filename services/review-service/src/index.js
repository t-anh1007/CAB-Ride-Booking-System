/**
 * Review Service — Entry point.
 *
 * Bootstraps the service using the shared platform framework (create-service-app)
 * and then registers the review-specific API routes on top.
 *
 * Architecture:
 *   - Uses the platform's startService() for health, architecture and broker bootstrapping
 *   - Extends with review-specific routes (POST/GET /api/v1/reviews/*)
 *   - Publishes ReviewCreated events to Kafka
 *   - Consumes RideStatusChanged events (for future eligibility validation)
 */

import { getServiceManifest } from "../../../platform/architecture/service-manifests.js";
import { bootstrapBroker } from "../../../platform/node/broker.js";
import { getAiProfileForService } from "../../../platform/architecture/ai-topology.js";
import { brokerTopology } from "../../../platform/architecture/event-contracts.js";
import { getRealtimeFlowsForService } from "../../../platform/architecture/realtime-topology.js";
import { getResilienceProfileForService } from "../../../platform/architecture/resilience-topology.js";
import { getSecurityProfileForService } from "../../../platform/architecture/security-topology.js";
import express from "express";
import { createReviewRouter } from "./routes.js";
import startServersModule from "../../../platform/node/start-servers.cjs";

async function startReviewService() {
  const { startServiceServers } = startServersModule;
  const serviceKey = "review-service";
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

  // ── Platform standard endpoints ─────────────────────────────
  app.get("/health", (_request, response) => {
    response.json({
      service: manifest.key,
      status: "ok",
      port,
      brokerConnected: broker.connected
    });
  });

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

  // ── Review-specific API routes ──────────────────────────────
  const reviewRouter = createReviewRouter({ broker });
  app.use(reviewRouter);

  // ── Gateway path architecture endpoint ──────────────────────
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

  app.get(`${manifest.gatewayPath}/health`, (_request, response) => {
    response.json({
      service: manifest.key,
      message: `${manifest.displayName} is reachable through the overall architecture`
    });
  });

  // ── 404 catch-all ───────────────────────────────────────────
  app.use((_request, response) => {
    response.status(404).json({
      service: manifest.key,
      error: "Route not found"
    });
  });

  const runtime = await startServiceServers({
    app,
    env: process.env,
    publicPort: port,
    serviceName: manifest.key,
    logger: console
  });

  console.log(`[${manifest.key}] listening on port ${port}`);
  if (runtime.internalPort) {
    console.log(`[${manifest.key}] internal mTLS listening on ${runtime.internalPort}`);
  }
}

startReviewService().catch((error) => {
  console.error(error);
  process.exit(1);
});
