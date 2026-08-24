import { startNotificationEventConsumer } from "./kafka-consumer.js";
import { readSecret } from "./config/read-secret.js";

const DEFAULT_TOPICS = "driver.location.updated,ride.status.changed,driver.assigned,ride.assigned";

export async function startRealtimeRelay({
  gatewayRealtimePublishUrl = process.env.GATEWAY_REALTIME_PUBLISH_URL || "http://api-gateway:3000/internal/realtime/publish",
  internalKey = readSecret("REALTIME_INTERNAL_KEY", ""),
  fetchImpl = globalThis.fetch,
  logger = console
} = {}) {
  if (typeof fetchImpl !== "function" || !gatewayRealtimePublishUrl || !internalKey) {
    return createNoopRelay("Realtime relay disabled");
  }

  const consumer = await startNotificationEventConsumer({
    serviceKey: "notification-realtime-relay",
    rawTopics: process.env.REALTIME_EVENT_TOPICS || DEFAULT_TOPICS,
    groupId: process.env.NOTIFICATION_REALTIME_CONSUMER_GROUP || "notification-realtime-relay",
    logger,
    onMessage: async (eventEnvelope) => {
      const targetUserIds = extractTargetUserIds(eventEnvelope.payload);
      if (targetUserIds.length === 0) {
        return;
      }

      const event = buildRealtimeEvent(eventEnvelope);
      const response = await fetchImpl(gatewayRealtimePublishUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-realtime-internal-key": internalKey
        },
        body: JSON.stringify({
          userIds: targetUserIds,
          event
        })
      });

      if (!response.ok) {
        const body = await safeReadText(response);
        throw new Error(`Gateway realtime publish failed (${response.status}): ${body || "unknown error"}`);
      }
    }
  });

  return {
    connected: consumer.connected,
    topics: consumer.topics,
    async close() {
      await consumer.close();
    }
  };
}

function buildRealtimeEvent(eventEnvelope) {
  const topic = String(eventEnvelope?.topic || "").trim();
  const payload = eventEnvelope?.payload || {};

  return {
    type: topic || payload.eventType || "realtime.event",
    eventType: payload.eventType || payload.type || null,
    topic,
    payload,
    timestamp: new Date().toISOString()
  };
}

function extractTargetUserIds(payload = {}) {
  return Array.from(
    new Set(
      [
        payload.userId,
        payload.customerId,
        payload.passengerId,
        payload.driverId
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function createNoopRelay(reason) {
  return {
    connected: false,
    reason,
    topics: [],
    async close() {
      return true;
    }
  };
}
