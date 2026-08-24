import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { connectMongo, closeMongo } from './db/mongoClient.js';
import { ensurePaymentIndexes } from './repositories/paymentRepository.js';
import { ensureOutboxIndexes } from './repositories/outboxRepository.js';
import { ensureTransactionIndexes } from './repositories/transactionRepository.js';
import { startServer } from './server.js';
import { closePublisher } from './events/eventPublisher.js';

const env = getEnv();

async function bootstrap() {
  await connectMongo(env);
  await ensurePaymentIndexes(env);
  await ensureOutboxIndexes(env);
  await ensureTransactionIndexes(env);

  const app = createApp(env);
  const runtime = await startServer(app, env);

  async function shutdown(signal) {
    console.log(`[payment-service] received ${signal}, shutting down...`);
    await runtime.close();
    await closePublisher();
    await closeMongo();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[payment-service] bootstrap failed', error);
  process.exit(1);
});
