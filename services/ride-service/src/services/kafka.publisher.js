import { Kafka, logLevel } from 'kafkajs';

let producerPromise = null;

function parseBrokers(rawBrokers) {
  return String(rawBrokers || '')
    .split(',')
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
    clientId: 'ride-service',
    brokers,
    logLevel: logLevel.NOTHING,
  });

  const producer = kafka.producer();

  producerPromise = producer
    .connect()
    .then(() => producer)
    .catch((error) => {
      console.warn(`[ride-service] Kafka producer unavailable: ${error.message}`);
      producerPromise = null;
      return null;
    });

  return producerPromise;
}

async function publishRideEvent(topic, payload, key = null) {
  const producer = await getProducer();

  if (!producer) {
    return { published: false, reason: 'kafka-unavailable' };
  }

  await producer.send({
    topic,
    messages: [
      {
        key: key ? String(key) : undefined,
        value: JSON.stringify({
          ...payload,
          emittedAt: new Date().toISOString(),
          sourceService: 'ride-service',
        }),
      },
    ],
  });

  return { published: true };
}

export {
  publishRideEvent,
};