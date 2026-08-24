import express from "express";
import { brokerTopology } from "../../../platform/architecture/event-contracts.js";
import { getAiProfileForService } from "../../../platform/architecture/ai-topology.js";
import { getRealtimeFlowsForService } from "../../../platform/architecture/realtime-topology.js";
import { getResilienceProfileForService } from "../../../platform/architecture/resilience-topology.js";
import { getSecurityProfileForService } from "../../../platform/architecture/security-topology.js";
import { getServiceManifest } from "../../../platform/architecture/service-manifests.js";
import { bootstrapBroker } from "../../../platform/node/broker.js";
import { createDefaultDispatcher } from "./channel-dispatcher.js";
import { startNotificationEventConsumer } from "./kafka-consumer.js";
import { createNotificationRepository } from "./notification-repository.js";
import { NotificationService, NotificationValidationError } from "./notification-service.js";

export async function createNotificationApp({
  serviceKey = "notification-service",
  repository,
  dispatcher = createDefaultDispatcher(),
  logger = console,
  clock,
  maxAttempts,
  baseRetryDelayMs,
  dedupeWindowMs
} = {}) {
  const manifest = getServiceManifest(serviceKey);

  if (!manifest) {
    throw new Error(`Unknown service manifest: ${serviceKey}`);
  }

  const app = express();
  const broker = await bootstrapBroker(manifest);
  const repositoryRuntime = await createNotificationRepository({
    repository,
    logger
  });
  const notificationService = new NotificationService({
    repository: repositoryRuntime.repository,
    dispatcher,
    logger,
    clock,
    maxAttempts,
    baseRetryDelayMs,
    dedupeWindowMs
  });
  const aiProfile = getAiProfileForService(manifest.key);
  const realtimeFlows = getRealtimeFlowsForService(manifest.key);
  const resilienceProfile = getResilienceProfileForService(manifest.key);
  const securityProfile = getSecurityProfileForService(manifest.key);
  const eventConsumer = await startNotificationEventConsumer({
    serviceKey: manifest.key,
    onMessage: (eventEnvelope) => notificationService.processDomainEvent(eventEnvelope),
    logger
  });

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      service: manifest.key,
      status: "ok",
      brokerConnected: broker.connected,
      eventConsumerConnected: eventConsumer.connected,
      persistence: repositoryRuntime.persistence
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
      eventConsumer: {
        connected: eventConsumer.connected,
        topics: eventConsumer.topics
      },
      persistence: repositoryRuntime.persistence,
      aiProfile,
      realtimeFlows,
      resilienceProfile,
      securityProfile
    });
  });

  app.get(manifest.gatewayPath, async (request, response, next) => {
    try {
      if (!Object.prototype.hasOwnProperty.call(request.query, "userId")) {
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
          scope: "notification-service"
        });
        return;
      }

      const notifications = await notificationService.listNotifications(request.query);

      response.json({
        success: true,
        message: "Notifications retrieved",
        data: notifications.map((notification) => presentNotification(notification))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${manifest.gatewayPath}/health`, (_request, response) => {
    response.json({
      service: manifest.key,
      message: `${manifest.displayName} is reachable through the overall architecture`
    });
  });

  app.post("/internal/notifications/send", async (request, response, next) => {
    try {
      const result = await notificationService.submitNotification(request.body, {
        source: "internal-api"
      });

      response.status(result.duplicate ? 200 : 202).json({
        success: true,
        message: result.duplicate ? "Duplicate notification ignored" : "Notification accepted for delivery",
        data: presentNotification(result.notification),
        meta: {
          duplicate: result.duplicate
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof NotificationValidationError) {
      response.status(400).json({
        success: false,
        message: error.message,
        details: error.details || null
      });
      return;
    }

    logger.error?.(error);
    response.status(500).json({
      success: false,
      message: "Notification service encountered an unexpected error"
    });
  });

  app.use((_request, response) => {
    response.status(404).json({
      service: manifest.key,
      error: "Route not found"
    });
  });

  return {
    app,
    manifest,
    broker,
    eventConsumer,
    persistence: repositoryRuntime.persistence,
    notificationService,
    async close() {
      await notificationService.stop();
      await eventConsumer.close();
      await broker.close();
      await repositoryRuntime.close();
    }
  };
}

function presentNotification(notification) {
  return {
    notificationId: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    channel: notification.channel,
    status: notification.status,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    sentAt: notification.sentAt,
    attemptCount: notification.attemptCount,
    lastError: notification.lastError
  };
}
