import { randomUUID } from "node:crypto";
import { Kafka, logLevel } from "kafkajs";

let producerPromise = null;

function parseBrokers(rawBrokers) {
  return String(rawBrokers || "")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

async function getProducer() {
  if (producerPromise) {
    return producerPromise;
  }

  const brokers = parseBrokers(process.env.KAFKA_BROKERS);

  if (brokers.length === 0) {
    return null;
  }

  const kafka = new Kafka({
    clientId: "driver-service",
    brokers,
    logLevel: logLevel.NOTHING
  });

  const producer = kafka.producer();

  producerPromise = producer
    .connect()
    .then(() => producer)
    .catch((error) => {
      console.warn(`[driver-service] Kafka producer unavailable: ${error.message}`);
      producerPromise = null;
      return null;
    });

  return producerPromise;
}

export async function publishDriverEvent(topic, payload, key = null) {
  const producer = await getProducer();

  if (!producer) {
    return { published: false, reason: "kafka-unavailable" };
  }

  await producer.send({
    topic,
    messages: [
      {
        key: key ? String(key) : undefined,
        value: JSON.stringify({
          eventId: payload.eventId || randomUUID(),
          ...payload,
          emittedAt: new Date().toISOString(),
          sourceService: "driver-service"
        })
      }
    ]
  });

  return { published: true };
}