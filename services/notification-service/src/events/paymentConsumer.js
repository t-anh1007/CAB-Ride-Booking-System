import { Kafka } from 'kafkajs';
import { appendNotification } from '../store/notificationStore.js';

let consumer;

const ACCEPTED_TOPICS = new Set([
  'payment.completed',
  'payment.failed',
  'payment.refunded',
  'notification.payment.completed',
  'notification.payment.failed',
  'notification.payment.refunded'
]);

export async function startNotificationConsumer(env) {
  if (!env.kafkaEnabled || env.kafkaBrokers.length === 0) {
    console.log('[notification-service] Kafka disabled, running without choreography consumer');
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
      const notification = appendNotification(payload);
      console.log(`[notification-service] notification sent for payment ${notification.paymentId || 'n/a'} topic ${payload.topic}`);
    }
  });

  console.log(`[notification-service] consuming payment choreography events from ${env.paymentTopic}`);
}

export async function stopNotificationConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
