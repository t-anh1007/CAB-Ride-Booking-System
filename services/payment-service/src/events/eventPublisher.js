import { Kafka } from 'kafkajs';
import { appendOutboxEvent } from '../repositories/outboxRepository.js';
import { generateId } from '../utils/ids.js';
import { nowIso } from '../utils/time.js';

let producer;
let kafkaReady = false;

async function getProducer(env) {
  if (!env.kafkaEnabled || env.kafkaBrokers.length === 0) {
    return null;
  }

  if (!producer) {
    const kafka = new Kafka({ clientId: env.kafkaClientId, brokers: env.kafkaBrokers });
    producer = kafka.producer();
    await producer.connect();
    kafkaReady = true;
  }

  return producer;
}

export async function publishPaymentEvent(env, topic, payload) {
  const event = {
    eventId: generateId(),
    topic,
    payload,
    createdAt: nowIso(),
    delivered: false,
    deliveredAt: null
  };

  await appendOutboxEvent(env, event);

  const kafkaProducer = await getProducer(env);
  if (kafkaProducer) {
    await kafkaProducer.send({
      topic: env.paymentTopic,
      messages: [
        {
          key: payload.paymentId,
          value: JSON.stringify({ topic, ...payload })
        }
      ]
    });
    event.delivered = true;
    event.deliveredAt = nowIso();
  }

  return event;
}

export async function closePublisher() {
  if (producer && kafkaReady) {
    await producer.disconnect();
  }
  producer = null;
  kafkaReady = false;
}
