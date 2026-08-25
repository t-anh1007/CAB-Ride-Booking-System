'use strict';

require('dotenv').config();

const config = {
  routingProviders: ['osrm', 'haversine'],
  routingProvider: 'osrm',
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
  osrmTimeoutMs: parseInt(process.env.OSRM_TIMEOUT_MS || '2000', 10),
  fallbackAvgSpeedKmh: parseFloat(process.env.FALLBACK_AVG_SPEED_KMH || '28'),
  maxDistanceKm: parseFloat(process.env.ETA_MAX_DISTANCE_KM || '500'),
  trafficProvider: (process.env.TRAFFIC_PROVIDER || 'heuristic').toLowerCase(),
  defaultTrafficDelayFactor: parseFloat(process.env.DEFAULT_TRAFFIC_DELAY_FACTOR || '1.0'),
  etaCacheTtl: parseInt(process.env.ETA_CACHE_TTL_SECONDS || '30', 10),
  locationTtl: parseInt(process.env.DRIVER_LOCATION_TTL_SECONDS || '300', 10),
  etaMinMinutes: parseInt(process.env.ETA_MIN_MINUTES || '0', 10),
  etaBiasFactor: parseFloat(process.env.ETA_BIAS_FACTOR || '1.0'),
  etaBiasFactorMin: parseFloat(process.env.ETA_BIAS_FACTOR_MIN || '0.85'),
  etaBiasFactorMax: parseFloat(process.env.ETA_BIAS_FACTOR_MAX || '1.5'),
  etaBiasProfileTtl: parseInt(process.env.ETA_BIAS_PROFILE_TTL_SECONDS || '86400', 10),
  kafkaBrokers: (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || 'eta-service',
  kafkaConsumerGroupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'eta-service-driver-location',
  driverLocationTopic: process.env.DRIVER_LOCATION_TOPIC || 'driver.location.updated',
  etaResultTopic: process.env.ETA_RESULT_TOPIC || 'eta.result',
  kafkaStartupRetryBaseMs: parseInt(process.env.KAFKA_STARTUP_RETRY_BASE_MS || '2000', 10),
  kafkaStartupRetryMaxMs: parseInt(process.env.KAFKA_STARTUP_RETRY_MAX_MS || '30000', 10),
};

config.kafkaEnabled = config.kafkaBrokers.length > 0;

module.exports = config;
