import { Kafka, logLevel } from "kafkajs";

function parseBrokers(rawBrokers) {
  return String(rawBrokers || "")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

function parseTopics(rawTopics) {
  return String(rawTopics || "")
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

export async function startNotificationEventConsumer({
  serviceKey,
  rawBrokers = process.env.KAFKA_BROKERS,
  rawTopics = process.env.NOTIFICATION_EVENT_TOPICS || "driver.assigned,ride.assigned,ride.status.changed,payment.failed,payment.success,payment.completed",
  groupId = process.env.NOTIFICATION_CONSUMER_GROUP || `${serviceKey}-consumer`,
  onMessage,
  logger = console
}) {
  const brokers = parseBrokers(rawBrokers);
  console.log(`🚀 [Kafka Consumer] Starting initialization for ${serviceKey}...`);

  if (brokers.length === 0 || typeof onMessage !== "function") {
    return createNoopConsumer("Kafka consumer disabled");
  }

  const topics = parseTopics(rawTopics);

  if (topics.length === 0) {
    return createNoopConsumer("No event topics configured");
  }

  const kafka = new Kafka({
    clientId: `${serviceKey}-events`,
    brokers,
    logLevel: logLevel.NOTHING,
    connectionTimeout: 5000,
    requestTimeout: 10000
  });

  const consumer = kafka.consumer({ groupId });

  try {
    await consumer.connect();

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const payload = safeParseJson(message.value?.toString("utf8"));

        if (!payload) {
          logger.warn?.(`[${serviceKey}] ignored invalid Kafka message on topic ${topic}`);
          return;
        }

        await onMessage({
          topic,
          key: message.key?.toString("utf8") || null,
          payload
        });
      }
    });

    return {
      connected: true,
      topics,
      async close() {
        await consumer.disconnect();
      }
    };
  } catch (error) {
    logger.warn?.(`[${serviceKey}] Kafka consumer disabled: ${error.message}`);

    try {
      await consumer.disconnect();
    } catch {
      // Ignore disconnect failures after a failed boot attempt.
    }

    return createNoopConsumer(error.message);
  }
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createNoopConsumer(reason) {
  return {
    connected: false,
    reason,
    topics: [],
    async close() {
      return true;
    }
  };
}
