'use strict';

const express = require('express');
const config = require('./eta.config');
const etaService = require('./eta.service');

function createResponse({ success, message, data = null }) {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

function validatePoint(point, label) {
  if (!point || typeof point !== 'object') {
    return `${label} is required`;
  }
  if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    return `${label} must include numeric lat and lng`;
  }
  if (point.lat < -90 || point.lat > 90) {
    return `${label}.lat must be between -90 and 90`;
  }
  if (point.lng < -180 || point.lng > 180) {
    return `${label}.lng must be between -180 and 180`;
  }
  return null;
}

function normalizeLocationPayload(body = {}) {
  return body.location || body.currentLocation || body.driverLocation || null;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function safePublishEtaResult(publishEtaResultEvent, eventPayload) {
  if (typeof publishEtaResultEvent !== 'function') {
    return { published: false, reason: 'publisher-not-configured' };
  }

  try {
    return await publishEtaResultEvent(eventPayload);
  } catch (error) {
    return { published: false, reason: error.message };
  }
}

function createApp(options = {}) {
  const app = express();
  const { publishEtaResultEvent } = options;

  app.use(express.json());

  app.get('/health', asyncHandler(async (_req, res) => {
    res.json(
      createResponse({
        success: true,
        message: 'ETA service is healthy',
        data: {
          service: 'eta-service',
          architecture: {
            independentService: true,
            kafkaEnabled: config.kafkaEnabled,
            trafficProvider: config.trafficProvider,
            routingProvider: config.routingProvider,
            redisHotStore: true,
            etaResultTopic: config.etaResultTopic,
            driverLocationTopic: config.driverLocationTopic,
          },
        },
      })
    );
  }));

  app.get('/api/v1/eta', (_req, res) => {
    res.json(
      createResponse({
        success: true,
        message: 'ETA service endpoints',
        data: {
          service: 'eta-service',
          routes: [
            'POST /api/v1/eta/calculate',
            'POST /api/v1/eta/pickup',
            'POST /api/v1/eta/ride-estimates',
            'POST /api/v1/eta/tracking',
            'POST /api/v1/eta/driver-location-events',
            'GET /api/v1/eta/driver-locations/:driverId',
            'POST /api/v1/eta/active-rides',
            'GET /api/v1/eta/active-rides/:rideId',
            'DELETE /api/v1/eta/active-rides/:rideId',
            'POST /api/v1/eta/bias-profiles',
            'GET /api/v1/eta/bias-profiles/:profileKey',
            'DELETE /api/v1/eta/bias-profiles/:profileKey',
          ],
        },
      })
    );
  });

  app.post('/api/v1/eta/calculate', asyncHandler(async (req, res) => {
    const {
      origin,
      destination,
      rideId = null,
      segment = 'toDestination',
      skipCache = false,
      biasContext = {},
    } = req.body || {};

    const originError = validatePoint(origin, 'origin');
    const destinationError = validatePoint(destination, 'destination');

    if (originError || destinationError) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: originError || destinationError,
        })
      );
    }

    const result = await etaService.calculateETA(origin, destination, {
      rideId,
      segment,
      skipCache,
      biasContext,
    });

    if (!result) {
      return res.status(503).json(
        createResponse({
          success: false,
          message: 'Unable to calculate ETA',
        })
      );
    }

    const publishOutcome = await safePublishEtaResult(publishEtaResultEvent, {
      rideId,
      segment,
      etaResult: result,
      requestContext: { origin, destination, biasContext },
    });

    return res.json(
      createResponse({
        success: true,
        message: 'ETA calculated',
        data: {
          ...result,
          eventPublished: publishOutcome.published,
        },
      })
    );
  }));

  app.post('/api/v1/eta/pickup', asyncHandler(async (req, res) => {
    const {
      driverLocation,
      pickup,
      rideId = null,
      skipCache = false,
      biasContext = {},
    } = req.body || {};

    const driverError = validatePoint(driverLocation, 'driverLocation');
    const pickupError = validatePoint(pickup, 'pickup');

    if (driverError || pickupError) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: driverError || pickupError,
        })
      );
    }

    const result = await etaService.calculatePickupETA(driverLocation, pickup, {
      rideId,
      skipCache,
      biasContext,
    });

    if (!result) {
      return res.status(503).json(
        createResponse({
          success: false,
          message: 'Unable to calculate pickup ETA',
        })
      );
    }

    const publishOutcome = await safePublishEtaResult(publishEtaResultEvent, {
      rideId,
      segment: 'toPickup',
      etaResult: result,
      requestContext: { driverLocation, pickup, biasContext },
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Pickup ETA calculated',
        data: {
          ...result,
          eventPublished: publishOutcome.published,
        },
      })
    );
  }));

  app.post('/api/v1/eta/ride-estimates', asyncHandler(async (req, res) => {
    const {
      driverLocation,
      pickup,
      destination,
      rideId = null,
      skipCache = false,
      biasContext = {},
    } = req.body || {};

    const driverError = validatePoint(driverLocation, 'driverLocation');
    const pickupError = validatePoint(pickup, 'pickup');
    const destinationError = validatePoint(destination, 'destination');

    if (driverError || pickupError || destinationError) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: driverError || pickupError || destinationError,
        })
      );
    }

    const result = await etaService.calculateRideEstimates(driverLocation, pickup, destination, {
      rideId,
      skipCache,
      biasContext,
    });

    const publishOutcome = await safePublishEtaResult(publishEtaResultEvent, {
      rideId,
      segment: 'ride-estimates',
      etaResult: result,
      requestContext: { driverLocation, pickup, destination, biasContext },
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride ETA estimates calculated',
        data: {
          ...result,
          eventPublished: publishOutcome.published,
        },
      })
    );
  }));

  app.post('/api/v1/eta/tracking', asyncHandler(async (req, res) => {
    const {
      rideId = null,
      driverId = null,
      pickup = null,
      destination = null,
      segment = 'toPickup',
      skipCache = false,
      biasContext = {},
    } = req.body || {};

    if (!rideId && !driverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'rideId or driverId is required',
        })
      );
    }

    if (pickup) {
      const pickupError = validatePoint(pickup, 'pickup');
      if (pickupError) {
        return res.status(400).json(
          createResponse({
            success: false,
            message: pickupError,
          })
        );
      }
    }

    if (destination) {
      const destinationError = validatePoint(destination, 'destination');
      if (destinationError) {
        return res.status(400).json(
          createResponse({
            success: false,
            message: destinationError,
          })
        );
      }
    }

    try {
      const result = await etaService.calculateTrackingETA({
        rideId,
        driverId,
        pickup,
        destination,
        segment,
        skipCache,
        biasContext,
      });

      const publishOutcome = await safePublishEtaResult(publishEtaResultEvent, {
        rideId: result.rideId,
        driverId: result.driverId,
        segment: result.segment,
        etaResult: result.eta,
        requestContext: {
          mode: 'tracking',
          locationSource: result.locationSource,
        },
      });

      return res.json(
        createResponse({
          success: true,
          message: 'Tracking ETA calculated',
          data: {
            ...result,
            eventPublished: publishOutcome.published,
          },
        })
      );
    } catch (error) {
      if (error.code === 'DRIVER_LOCATION_NOT_FOUND') {
        return res.status(404).json(
          createResponse({
            success: false,
            message: error.message,
          })
        );
      }

      throw error;
    }
  }));

  app.post('/api/v1/eta/driver-location-events', asyncHandler(async (req, res) => {
    const driverId = req.body?.driverId;
    const rideId = req.body?.rideId || null;
    const location = normalizeLocationPayload(req.body);
    const locationError = validatePoint(location, 'location');

    if (!driverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'driverId is required',
        })
      );
    }

    if (locationError) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: locationError,
        })
      );
    }

    const result = await etaService.handleDriverLocationUpdated({
      driverId,
      rideId,
      location,
      source: 'http',
      updatedAt: req.body?.updatedAt || new Date().toISOString(),
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Driver location event processed',
        data: result,
      })
    );
  }));

  app.get('/api/v1/eta/driver-locations/:driverId', asyncHandler(async (req, res) => {
    const location = await etaService.getDriverLocation(req.params.driverId);
    if (!location) {
      return res.status(404).json(
        createResponse({
          success: false,
          message: 'Driver location not found',
        })
      );
    }

    return res.json(
      createResponse({
        success: true,
        message: 'Driver location loaded',
        data: location,
      })
    );
  }));

  app.post('/api/v1/eta/active-rides', asyncHandler(async (req, res) => {
    const { rideId, snapshot } = req.body || {};
    if (!rideId || !snapshot || typeof snapshot !== 'object') {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'rideId and snapshot are required',
        })
      );
    }

    await etaService.saveActiveRide(rideId, snapshot);
    return res.status(201).json(
      createResponse({
        success: true,
        message: 'Active ride saved',
        data: { rideId },
      })
    );
  }));

  app.get('/api/v1/eta/active-rides/:rideId', asyncHandler(async (req, res) => {
    const ride = await etaService.getActiveRide(req.params.rideId);
    if (!ride) {
      return res.status(404).json(
        createResponse({
          success: false,
          message: 'Active ride not found',
        })
      );
    }

    return res.json(
      createResponse({
        success: true,
        message: 'Active ride loaded',
        data: ride,
      })
    );
  }));

  app.delete('/api/v1/eta/active-rides/:rideId', asyncHandler(async (req, res) => {
    await etaService.removeActiveRide(req.params.rideId);
    return res.json(
      createResponse({
        success: true,
        message: 'Active ride removed',
        data: { rideId: req.params.rideId },
      })
    );
  }));

  app.post('/api/v1/eta/bias-profiles', asyncHandler(async (req, res) => {
    const { profileKey, biasFactor, metadata = {} } = req.body || {};
    if (!profileKey || typeof biasFactor !== 'number') {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'profileKey and numeric biasFactor are required',
        })
      );
    }

    const saved = await etaService.saveBiasProfile(profileKey, biasFactor, metadata);
    return res.status(201).json(
      createResponse({
        success: true,
        message: 'ETA bias profile saved',
        data: saved,
      })
    );
  }));

  app.get('/api/v1/eta/bias-profiles/:profileKey', asyncHandler(async (req, res) => {
    const profile = await etaService.getBiasProfile(req.params.profileKey);
    if (!profile) {
      return res.status(404).json(
        createResponse({
          success: false,
          message: 'ETA bias profile not found',
        })
      );
    }

    return res.json(
      createResponse({
        success: true,
        message: 'ETA bias profile loaded',
        data: profile,
      })
    );
  }));

  app.delete('/api/v1/eta/bias-profiles/:profileKey', asyncHandler(async (req, res) => {
    await etaService.removeBiasProfile(req.params.profileKey);
    return res.json(
      createResponse({
        success: true,
        message: 'ETA bias profile removed',
        data: { profileKey: req.params.profileKey },
      })
    );
  }));

  app.use((req, res) => {
    res.status(404).json(
      createResponse({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
      })
    );
  });

  app.use((error, _req, res, _next) => {
    const message = error?.message || 'Unexpected ETA service error';
    const unavailable =
      /redis|ECONNREFUSED|max retries per request/i.test(message);

    res.status(unavailable ? 503 : 500).json(
      createResponse({
        success: false,
        message: unavailable ? 'ETA infrastructure unavailable' : message,
        data: {
          error: message,
        },
      })
    );
  });

  return app;
}

module.exports = {
  createApp,
};
