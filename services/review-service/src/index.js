/**
 * Review Service — Entry point.
 *
 * Bootstraps the service using the shared platform framework and registers the
 * review-specific API routes with durable MongoDB storage and lazy Kafka
 * publication.
 */

import { Kafka } from "kafkajs";
import { getServiceManifest } from "../../../platform/architecture/service-manifests.js";
import { bootstrapBroker } from "../../../platform/node/broker.js";
import { getAiProfileForService } from "../../../platform/architecture/ai-topology.js";
import { brokerTopology } from "../../../platform/architecture/event-contracts.js";
import { getRealtimeFlowsForService } from "../../../platform/architecture/realtime-topology.js";
import { getResilienceProfileForService } from "../../../platform/architecture/resilience-topology.js";
import { getSecurityProfileForService } from "../../../platform/architecture/security-topology.js";
import express from "express";
import { createReviewRouter } from "./routes.js";
import { createMongoReviewStore } from "./store.js";
import startServersModule from "../../../platform/node/start-servers.cjs";

async function startReviewService() {
  const { startServiceServers } = startServersModule;
  const serviceKey = "review-service";
  const manifest = getServiceManifest(serviceKey);

  if (!manifest) {
    throw new Error(`Unknown service manifest: ${serviceKey}`);
  }

  const store = await createMongoReviewStore({ mongoUri: process.env.MONGO_URI });
  const publisher = createLazyKafkaPublisher({ env: process.env });
  let runtime = null;

  try {
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
    app.use(createReviewRouter({ store, publisher, logger: console }));

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

    runtime = await startServiceServers({
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

    let closePromise = null;
    const close = () => {
      if (!closePromise) {
        closePromise = closeResources({ runtime, publisher, store });
      }
      return closePromise;
    };
    let shutdownPromise = null;
    const shutdown = (signal) => {
      if (!shutdownPromise) {
        shutdownPromise = (async () => {
          console.log(`[${manifest.key}] received ${signal}, shutting down...`);
          try {
            await close();
            process.exit(0);
          } catch (error) {
            console.error(`[${manifest.key}] shutdown failed`, error);
            process.exit(1);
          }
        })();
      }
      return shutdownPromise;
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

    return { ...runtime, close };
  } catch (error) {
    await closeResources({ runtime, publisher, store }).catch((cleanupError) => {
      console.error(`[${serviceKey}] startup cleanup failed`, cleanupError);
    });
    throw error;
  }
}

function createLazyKafkaPublisher({ env = process.env } = {}) {
  let producerPromise = null;

  async function getProducer() {
    if (!producerPromise) {
      producerPromise = connectProducer().catch((error) => {
        producerPromise = null;
        throw error;
      });
    }
    return producerPromise;
  }

  async function connectProducer() {
    const brokers = parseBrokers(env.KAFKA_BROKERS);
    if (brokers.length === 0) {
      throw new Error("KAFKA_BROKERS is required to publish review events");
    }

    const kafka = new Kafka({ clientId: "review-service", brokers });
    const producer = kafka.producer();
    await producer.connect();
    return producer;
  }

  return {
    async send(message) {
      const producer = await getProducer();
      await producer.send(message);
    },
    async close() {
      const pendingProducer = producerPromise;
      producerPromise = null;
      if (!pendingProducer) {
        return;
      }

      let producer;
      try {
        producer = await pendingProducer;
      } catch {
        return;
      }
      await producer.disconnect();
    }
  };
}

function parseBrokers(rawBrokers) {
  return String(rawBrokers || "")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

async function closeResources({ runtime, publisher, store }) {
  const errors = [];

  if (runtime) {
    try {
      await runtime.close();
    } catch (error) {
      errors.push(error);
    }
  }

  const results = await Promise.allSettled([
    publisher.close(),
    store.close()
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      errors.push(result.reason);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, "Failed to close review-service resources");
  }
}

startReviewService().catch((error) => {
  console.error(error);
  process.exit(1);
});
