/**
 * ETA AI Service – Configuration
 * ────────────────────────────────
 * Central config object built from environment variables.
 * Import this wherever you need ETA-related constants.
 */

'use strict';

require('dotenv').config();

const config = {
  // ── Routing ──────────────────────────────────────────────────────────────
  /** Which routing provider to use: osrm | graphhopper | googlemaps | mapbox */
  routingProvider: (process.env.ROUTING_PROVIDER || 'osrm').toLowerCase(),

  /** Base URL for OSRM (default: public demo server) */
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'http://router.project-osrm.org',

  /** GraphHopper base URL */
  graphhopperBaseUrl: process.env.GRAPHHOPPER_BASE_URL || 'https://graphhopper.com/api/1',
  graphhopperApiKey: process.env.GRAPHHOPPER_API_KEY || '',

  /** Google Maps API key */
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',

  /** Mapbox access token */
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || '',

  // ── Traffic Provider ──────────────────────────────────────────────────────
  /** Which traffic provider to use: heuristic | none */
  trafficProvider: (process.env.TRAFFIC_PROVIDER || 'heuristic').toLowerCase(),

  /** Default traffic delay factor when no live context exists */
  defaultTrafficDelayFactor: parseFloat(process.env.DEFAULT_TRAFFIC_DELAY_FACTOR || '1.0'),

  // ── Redis cache TTLs ─────────────────────────────────────────────────────
  /** Seconds to keep a cached ETA result */
  etaCacheTtl: parseInt(process.env.ETA_CACHE_TTL_SECONDS || '30', 10),

  /** Seconds to keep a driver location or active ride in Redis */
  locationTtl: parseInt(process.env.DRIVER_LOCATION_TTL_SECONDS || '300', 10),

  // ── ETA Heuristics ───────────────────────────────────────────────────────
  /** Average speed (km/h) used when all routing APIs are unavailable */
  fallbackAvgSpeedKmh: parseFloat(process.env.FALLBACK_AVG_SPEED_KMH || '30'),

  /** Minimum ETA value to ever return (minutes) */
  etaMinMinutes: parseInt(process.env.ETA_MIN_MINUTES || '1', 10),

  // ── AI Bias Correction ───────────────────────────────────────────────────
  /**
   * Multiplicative factor applied to the routing API's duration.
   * 1.0 = no adjustment, 1.15 = +15% buffer for traffic variance.
   * Future ML models can dynamically set this per route / time-of-day.
   */
  etaBiasFactor: parseFloat(process.env.ETA_BIAS_FACTOR || '1.0'),

  /** Clamp AI bias correction to a defensible range */
  etaBiasFactorMin: parseFloat(process.env.ETA_BIAS_FACTOR_MIN || '0.85'),
  etaBiasFactorMax: parseFloat(process.env.ETA_BIAS_FACTOR_MAX || '1.5'),

  /** Seconds to keep an ETA bias profile in Redis */
  etaBiasProfileTtl: parseInt(process.env.ETA_BIAS_PROFILE_TTL_SECONDS || '86400', 10),

  // ── Kafka / Event-driven ETA ─────────────────────────────────────────────
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
