import { Kafka, logLevel } from "kafkajs";
import { brokerTopology } from "../architecture/event-contracts.js";

export async function bootstrapBroker(serviceManifest) {
  const brokers = (process.env.KAFKA_BROKERS || "")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (brokers.length === 0) {
    return createNoopBroker("KAFKA_BROKERS is not configured");
  }

  try {
    const kafka = new Kafka({
      clientId: serviceManifest.key,
      brokers,
      logLevel: logLevel.NOTHING
    });

    const admin = kafka.admin();
    await admin.connect();
    await admin.disconnect();

    return {
      connected: true,
      mode: "architecture-only",
      supportedEvents: Object.keys(brokerTopology.events),
      async close() {
        return true;
      }
    };
  } catch (error) {
    return createNoopBroker(error.message);
  }
}

function createNoopBroker(reason) {
  return {
    connected: false,
    reason,
    mode: "architecture-only",
    supportedEvents: Object.keys(brokerTopology.events),
    async close() {
      return true;
    }
  };
}
