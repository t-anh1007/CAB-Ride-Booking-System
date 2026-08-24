import WebSocket, { WebSocketServer } from "ws";
import { startNotificationEventConsumer } from "./kafka-consumer.js";

const DEFAULT_TOPICS = "driver.location.updated,ride.status.changed,driver.assigned,ride.assigned";

export async function startRealtimeGateway(server, { logger = console } = {}) {
  const wss = new WebSocketServer({ server });
  const subscriptions = new Map();

  const consumer = await startNotificationEventConsumer({
    serviceKey: "notification-realtime",
    rawTopics: process.env.REALTIME_EVENT_TOPICS || DEFAULT_TOPICS,
    groupId: process.env.NOTIFICATION_REALTIME_CONSUMER_GROUP || "notification-realtime-gateway",
    logger,
    onMessage: async (eventEnvelope) => {
      broadcastEvent(eventEnvelope);
    }
  });

  wss.on("connection", (socket) => {
    subscriptions.set(socket, createSubscriptionState());

    socket.send(JSON.stringify({
      type: "realtime_connected",
      service: "notification-service",
      timestamp: new Date().toISOString()
    }));

    socket.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleSocketMessage(socket, data);
      } catch (error) {
        sendToSocket(socket, {
          type: "error",
          error: "Failed to process websocket message"
        });
      }
    });

    socket.on("close", () => {
      subscriptions.delete(socket);
    });
  });

  function handleSocketMessage(socket, data) {
    if (!data || typeof data !== "object") {
      sendToSocket(socket, {
        type: "error",
        error: "Invalid websocket payload"
      });
      return;
    }

    switch (data.type) {
      case "subscribe":
        updateSubscription(socket, data, true);
        break;
      case "unsubscribe":
        updateSubscription(socket, data, false);
        break;
      default:
        sendToSocket(socket, {
          type: "error",
          error: `Unsupported message type: ${data.type}`
        });
    }
  }

  function updateSubscription(socket, data, isSubscribe) {
    const subscription = subscriptions.get(socket);

    if (!subscription) {
      return;
    }

    if (data.rideId) {
      const targetSet = subscription.rideIds;
      if (isSubscribe) {
        targetSet.add(String(data.rideId));
      } else {
        targetSet.delete(String(data.rideId));
      }
    }

    if (data.driverId) {
      const targetSet = subscription.driverIds;
      if (isSubscribe) {
        targetSet.add(String(data.driverId));
      } else {
        targetSet.delete(String(data.driverId));
      }
    }

    sendToSocket(socket, {
      type: isSubscribe ? "subscribed" : "unsubscribed",
      rideId: data.rideId || null,
      driverId: data.driverId || null
    });
  }

  function broadcastEvent(eventEnvelope) {
    const message = buildRealtimeMessage(eventEnvelope);

    for (const [socket, subscription] of subscriptions.entries()) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (!shouldDeliver(subscription, message)) {
        continue;
      }

      socket.send(JSON.stringify(message));
    }
  }

  function shouldDeliver(subscription, message) {
    const payload = message.payload || {};
    const rideId = payload.rideId || payload.relatedEntityId || null;
    const driverId = payload.driverId || payload.driver?.driverId || null;

    if (subscription.rideIds.size === 0 && subscription.driverIds.size === 0) {
      return true;
    }

    return (
      (rideId && subscription.rideIds.has(String(rideId))) ||
      (driverId && subscription.driverIds.has(String(driverId)))
    );
  }

  function buildRealtimeMessage(eventEnvelope) {
    const topic = String(eventEnvelope?.topic || "").trim();
    const payload = eventEnvelope?.payload || {};
    const type =
      payload.eventType ||
      payload.type ||
      topic.replace(/\./g, "_") ||
      "realtime_event";

    return {
      type,
      topic,
      payload,
      timestamp: new Date().toISOString()
    };
  }

  function sendToSocket(socket, payload) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  return {
    wss,
    consumer,
    async close() {
      await consumer.close();
      await new Promise((resolve) => {
        wss.close(() => resolve());
      });
    }
  };
}

function createSubscriptionState() {
  return {
    rideIds: new Set(),
    driverIds: new Set()
  };
}