import {
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_PORT,
  DEFAULT_CURRENCY,
  MAX_BACKOFF_DELAY_MS
} from './constants.js';
import { readSecret } from './read-secret.js';

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnv() {
  return {
    port: toInt(process.env.PORT, DEFAULT_PORT),
    nodeEnv: process.env.NODE_ENV || 'development',
    defaultCurrency: process.env.DEFAULT_CURRENCY || DEFAULT_CURRENCY,
    mongoUri: readSecret('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
    mongoDbName: process.env.MONGODB_DB_NAME || 'cab_payment_service',
    paymentsCollection: process.env.MONGODB_COLLECTION_NAME || 'payments',
    outboxCollection: process.env.MONGODB_OUTBOX_COLLECTION || 'payment_outbox',
    transactionsCollection: process.env.MONGODB_TRANSACTIONS_COLLECTION || 'payment_transactions',
    retry: {
      maxRetries: toInt(process.env.PAYMENT_MAX_RETRIES, DEFAULT_MAX_RETRIES),
      baseDelayMs: toInt(process.env.PAYMENT_BASE_DELAY_MS, DEFAULT_BASE_DELAY_MS),
      maxDelayMs: toInt(process.env.PAYMENT_MAX_DELAY_MS, MAX_BACKOFF_DELAY_MS)
    },
    kafkaEnabled: String(process.env.KAFKA_ENABLED || 'false').toLowerCase() === 'true',
    kafkaClientId: process.env.KAFKA_CLIENT_ID || 'payment-service',
    kafkaBrokers: String(process.env.KAFKA_BROKERS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    paymentTopic: process.env.KAFKA_PAYMENT_TOPIC || 'payment-events'
  };
}
