'use strict';

require('dotenv').config();

const { createApp } = require('./app');
const etaService = require('./eta.service');
const { publishEtaResult, startDriverLocationConsumer, shutdownKafka } = require('./infra/kafka');
const { startServiceServers } = require('../../../platform/node/start-servers.cjs');

const app = createApp({
  publishEtaResultEvent: publishEtaResult,
});
const port = Number(process.env.PORT || 3110);
const kafkaRetryBaseMs = Number(process.env.KAFKA_STARTUP_RETRY_BASE_MS || 2000);
const kafkaRetryMaxMs = Number(process.env.KAFKA_STARTUP_RETRY_MAX_MS || 30000);
let kafkaRetryTimer = null;
let kafkaRetryAttempt = 0;
let shuttingDown = false;
let runtime = null;

async function ensureDriverLocationConsumer() {
  if (shuttingDown) {
    return;
  }

  try {
    const result = await startDriverLocationConsumer({
      onDriverLocationUpdated: etaService.handleDriverLocationUpdated,
    });

    kafkaRetryAttempt = 0;
    if (result?.started) {
      console.log('[eta-service] driver location consumer ready');
    }
  } catch (error) {
    kafkaRetryAttempt += 1;
    const delayMs = Math.min(
      kafkaRetryBaseMs * Math.max(1, 2 ** (kafkaRetryAttempt - 1)),
      kafkaRetryMaxMs,
    );
    console.warn(
      `[eta-service] driver location consumer unavailable (${error.message}). Retrying in ${delayMs}ms...`,
    );

    kafkaRetryTimer = setTimeout(() => {
      kafkaRetryTimer = null;
      ensureDriverLocationConsumer().catch((innerError) => {
        console.error('[eta-service] unexpected Kafka retry failure:', innerError.message);
      });
    }, delayMs);

    if (typeof kafkaRetryTimer.unref === 'function') {
      kafkaRetryTimer.unref();
    }
  }
}

ensureDriverLocationConsumer().catch((error) => {
  console.error('[eta-service] unexpected Kafka startup failure:', error.message);
});

async function startServer() {
  runtime = await startServiceServers({
    app,
    env: process.env,
    publicPort: port,
    serviceName: 'eta-service',
    logger: console,
  });

  console.log(`[eta-service] listening on port ${port}`);
  if (runtime.internalPort) {
    console.log(`[eta-service] internal mTLS listening on ${runtime.internalPort}`);
  }
}

async function shutdown(signal) {
  console.log(`[eta-service] received ${signal}, shutting down...`);
  shuttingDown = true;

  if (kafkaRetryTimer) {
    clearTimeout(kafkaRetryTimer);
    kafkaRetryTimer = null;
  }

  try {
    if (runtime) {
      await runtime.close();
    }
    await shutdownKafka();
    await etaService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('[eta-service] shutdown failed:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch((error) => {
  console.error('[eta-service] startup failed:', error.message);
  process.exit(1);
});
