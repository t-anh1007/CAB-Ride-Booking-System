import 'dotenv/config';
import express from 'express';
import { getEnv } from './src/config/env.js';
import { createApp } from './src/app.js';
import { connectMongo, disconnectMongo } from './src/database/mongoose.js';
import { startPaymentConsumer, stopPaymentConsumer } from './src/events/paymentConsumer.js';
import { startBookingConsumer, stopBookingConsumer } from './src/events/bookingConsumer.js';
import messageBroker from './src/utils/messageBroker.js';
import { startServiceServers } from '../../platform/node/start-servers.cjs';

const env = getEnv();
const app = createApp();
let runtime = null;

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://ride-mongodb:27017/cab_booking_ride';
    await connectMongo(mongoUri);
    console.log('[MongoDB] Connected');
  } catch (error) {
    console.warn('[MongoDB] Connection skipped or failed:', error.message);
  }

  try {
    await messageBroker.connect();
  } catch (error) {
    console.warn('[Kafka] Broker connection failed:', error.message);
  }

  for (const [name, start] of [
    ['Payment', startPaymentConsumer],
    ['Booking', startBookingConsumer]
  ]) {
    try {
      console.log(`[Kafka] Starting ${name} Consumer...`);
      await start(env);
      console.log(`[Kafka] ${name} Consumer started.`);
    } catch (error) {
      console.warn(`[Kafka] ${name} Consumer failed to start:`, error.message);
    }
  }

  const port = env.port || 3109;
  runtime = await startServiceServers({
    app,
    env: process.env,
    publicPort: port,
    serviceName: 'ride-service',
    logger: console,
  });

  console.log(`\n🚖 Ride Service Started`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Port: ${port}`);
  console.log(`REST API: http://localhost:${port}/api/v1/rides`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`Realtime events: Kafka -> notification-service`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

async function shutdown(signal) {
  console.log(`[ride-service] received ${signal}, shutting down...`);
  await stopBookingConsumer();
  await stopPaymentConsumer();
  await disconnectMongo();
  if (runtime) {
    await runtime.close();
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch((error) => {
  console.error('[ride-service] startup failed', error);
  process.exit(1);
});
