'use strict';

const { Kafka, logLevel } = require('kafkajs');
const config = require('../eta.config');

let kafka = null;
let producer = null;
let consumer = null;
let consumerStarted = false;

function isKafkaEnabled() {
  return config.kafkaEnabled;
}

function getKafka() {
  if (!isKafkaEnabled()) {
    return null;
  }

  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafkaClientId,
      brokers: config.kafkaBrokers,
      logLevel: logLevel.NOTHING,
    });
  }

  return kafka;
}

async function getProducer() {
  if (!isKafkaEnabled()) {
    return null;
  }

  if (!producer) {
    producer = getKafka().producer();
    await producer.connect();
  }

  return producer;
}

function normalizeDriverLocationEvent(payload = {}) {
  const location = payload.location || payload.currentLocation || payload.driverLocation || null;
  if (!payload.driverId || !location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return null;
  }

  return {
    rideId: payload.rideId || null,
    driverId: payload.driverId,
    location: {
      lat: location.lat,
      lng: location.lng,
      address: location.address || '',
    },
    updatedAt: payload.updatedAt || new Date().toISOString(),
    source: payload.sourceService || payload.source || 'unknown',
  };
}

async function publishEtaResult(eventPayload) {
  if (!isKafkaEnabled()) {
    return { published: false, reason: 'kafka-disabled' };
  }

  const etaProducer = await getProducer();
  const payload = {
    eventType: 'EtaResult',
    emittedAt: new Date().toISOString(),
    ...eventPayload,
  };

  await etaProducer.send({
    topic: config.etaResultTopic,
    messages: [
      {
        key: payload.rideId || payload.driverId || payload.segment || 'eta',
        value: JSON.stringify(payload),
      },
    ],
  });

  return {
    published: true,
    topic: config.etaResultTopic,
  };
}

async function startDriverLocationConsumer({ onDriverLocationUpdated }) {
  if (!isKafkaEnabled()) {
    console.log('[ETA-Kafka] Kafka disabled; driver-location consumer will not start');
    return { started: false, reason: 'kafka-disabled' };
  }

  if (consumerStarted) {
    return { started: true, reused: true };
  }

  const candidateConsumer = getKafka().consumer({ groupId: config.kafkaConsumerGroupId });

  try {
    await candidateConsumer.connect();
    await candidateConsumer.subscribe({ topic: config.driverLocationTopic, fromBeginning: false });
    await candidateConsumer.run({
      eachMessage: async ({ message }) => {
        if (!message?.value) {
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(message.value.toString('utf8'));
        } catch (error) {
          console.warn('[ETA-Kafka] Invalid driver location payload:', error.message);
          return;
        }

        const normalized = normalizeDriverLocationEvent(parsed);
        if (!normalized) {
          console.warn('[ETA-Kafka] Ignored driver location event with incomplete payload');
          return;
        }

        if (typeof onDriverLocationUpdated === 'function') {
          await onDriverLocationUpdated(normalized);
        }
      },
    });

    consumer = candidateConsumer;
    consumerStarted = true;
    console.log(`[ETA-Kafka] consuming ${config.driverLocationTopic}`);
    return { started: true, reused: false };
  } catch (error) {
    try {
      await candidateConsumer.disconnect();
    } catch (_) {
      // ignore cleanup errors for failed startup attempts
    }

    if (consumer === candidateConsumer) {
      consumer = null;
    }
    consumerStarted = false;
    throw error;
  }
}

async function shutdownKafka() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    consumerStarted = false;
  }

  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}

module.exports = {
  isKafkaEnabled,
  normalizeDriverLocationEvent,
  publishEtaResult,
  startDriverLocationConsumer,
  shutdownKafka,
};
