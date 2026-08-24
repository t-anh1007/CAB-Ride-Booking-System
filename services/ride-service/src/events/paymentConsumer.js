import { Kafka } from 'kafkajs';
import { applyPaymentEvent } from '../store/rideProjectionStore.js';

let consumer;

const ACCEPTED_TOPICS = new Set([
  'payment.completed',
  'payment.failed',
  'payment.refunded',
  'ride.payment.completed',
  'ride.payment.failed',
  'ride.payment.refunded'
]);

export async function startPaymentConsumer(env) {
  if (!env.kafkaEnabled || env.kafkaBrokers.length === 0) {
    console.log('[ride-service] Kafka disabled, running without choreography consumer');
    return;
  }

  const kafka = new Kafka({ clientId: env.kafkaClientId, brokers: env.kafkaBrokers });
  consumer = kafka.consumer({ groupId: env.kafkaGroupId });
  await consumer.connect();
  await consumer.subscribe({ topic: env.paymentTopic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const payload = JSON.parse(message.value.toString());
      if (!ACCEPTED_TOPICS.has(payload.topic)) return;
      const projection = applyPaymentEvent(payload);
      console.log(`[ride-service] applied event ${payload.topic} for ride ${projection.rideId}`);
    }
  });

  console.log(`[ride-service] consuming payment choreography events from ${env.paymentTopic}`);
}

export async function stopPaymentConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
