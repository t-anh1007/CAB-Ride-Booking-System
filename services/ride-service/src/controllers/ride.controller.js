/**
 * Ride Controller
 * Handles HTTP requests for ride operations
 */

import { v4 as uuidv4 } from 'uuid';
import rideService from '../services/ride.service.js';
import * as locationService from '../services/location.service.js';
import { isAdminActor, isAuthenticatedActor } from '../middleware/auth-context.js';
import { recordAuditEvent } from '../utils/audit.js';

function generateRequestId() {
  return uuidv4();
}

function createResponse({
  success,
  message,
  data = null,
  meta = {},
  requestId = generateRequestId(),
  statusCode = 200,
}) {
  return {
    success,
    message,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...meta,
    },
    statusCode,
  };
}

async function createRide(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const isAdmin = isAdminActor(actor);
    const { bookingId, userId, driverId, pickup, destination } = req.body;
    const actorUserId = actor.userId || actor.subjectId;

    if (!isAdmin && actor.role !== 'Customer') {
      throw createHttpError(403, 'Only customers or admins can create rides');
    }

    if (!isAdmin && userId && userId !== actorUserId) {
      throw createHttpError(403, 'You can only create rides for yourself');
    }

    const effectiveUserId = isAdmin ? userId : actorUserId;
    const effectiveDriverId = isAdmin ? driverId : null;

    if (!bookingId || !effectiveUserId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'Missing required fields: bookingId, userId',
          statusCode: 400,
          requestId,
        })
      );
    }

    if (!pickup || !destination) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'Missing required fields: pickup, destination',
          statusCode: 400,
          requestId,
        })
      );
    }

    const ride = await rideService.createRide({
      bookingId,
      userId: effectiveUserId,
      driverId: effectiveDriverId,
      pickup,
      destination,
    });

    let nearbyDrivers = [];

    try {
      nearbyDrivers = await locationService.findNearbyDrivers(pickup, 5, 10);
    } catch (error) {
      console.warn('[createRide] nearby driver lookup skipped:', error.message);
    }

    auditRideSuccess(req, {
      action: 'ride.create',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || null,
      metadata: {
        bookingId,
        userId: effectiveUserId,
        driverId: effectiveDriverId,
        nearbyDriverCount: nearbyDrivers.length
      }
    });

    return res.status(201).json(
      createResponse({
        success: true,
        message: 'Ride created',
        data: ride.toJSON(),
        meta: {
          nearbyDrivers,
        },
        requestId,
        statusCode: 201,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.create',
      targetType: 'ride',
      targetId: req.body?.bookingId || null,
      outcome: 'failure',
      metadata: {
        requestedUserId: req.body?.userId || null
      },
      error
    });
    return res.status(error.statusCode || 500).json(
      createResponse({
        success: false,
        message: error.message || 'Internal server error',
        statusCode: error.statusCode || 500,
      })
    );
  }
}

async function getRide(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const { rideId } = req.params;

    const ride = await rideService.getRideById(rideId);
    if (!ride) {
      return res.status(404).json(
        createResponse({
          success: false,
          message: 'Ride not found',
          statusCode: 404,
          requestId,
        })
      );
    }

    enforceRideAccess(actor, ride);

    auditRideSuccess(req, {
      action: 'ride.read',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || rideId,
      metadata: {
        status: ride.status
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride fetched',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.read',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      error
    });
    return res.status(error.statusCode || 500).json(
      createResponse({
        success: false,
        message: error.message || 'Internal server error',
        statusCode: error.statusCode || 500,
      })
    );
  }
}

async function getUserRides(req, res) {
  try {
    const requestId = generateRequestId();
    const { userId } = req.params;
    const actor = requireAuthenticatedActor(req);

    enforceUserScope(actor, userId);

    const userRides = await rideService.getRidesByUserId(userId);

    auditRideSuccess(req, {
      action: 'ride.list.user',
      targetType: 'user',
      targetId: userId,
      metadata: {
        rideCount: userRides.length
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'User rides fetched',
        data: userRides.map((ride) => ride.toJSON()),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.list.user',
      targetType: 'user',
      targetId: req.params?.userId || null,
      outcome: 'failure',
      error
    });
    return res.status(error.statusCode || 500).json(
      createResponse({
        success: false,
        message: error.message || 'Internal server error',
        statusCode: error.statusCode || 500,
      })
    );
  }
}

async function assignDriver(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const { rideId } = req.params;
    const { driverId } = req.body;

    if (!isAdminActor(actor)) {
      throw createHttpError(403, 'Only admins can assign drivers through this endpoint');
    }

    if (!driverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'driverId is required',
          statusCode: 400,
          requestId,
        })
      );
    }

    const ride = await rideService.assignDriver(rideId, driverId);

    auditRideSuccess(req, {
      action: 'ride.assign-driver',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || rideId,
      metadata: {
        driverId,
        status: ride.status
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Driver assigned to ride',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.assign-driver',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      metadata: {
        driverId: req.body?.driverId || null
      },
      error
    });
    const statusCode = error.statusCode || (error.message === 'Ride not found' ? 404 : 400);
    return res.status(statusCode).json(
      createResponse({
        success: false,
        message: error.message,
        statusCode,
      })
    );
  }
}

async function acceptRide(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const { rideId } = req.params;
    const actorId = actor.userId || actor.subjectId;

    // Only the assigned driver (or admin) can accept
    if (actor.role !== 'Driver' && !isAdminActor(actor)) {
      throw createHttpError(403, 'Only drivers or admins can accept rides');
    }

    const ride = await rideService.acceptRide(rideId, actorId);

    auditRideSuccess(req, {
      action: 'ride.accept',
      targetType: 'ride',
      targetId: ride.rideId || rideId,
      metadata: {
        driverId: actorId,
        status: ride.status
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride accepted',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.accept',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      metadata: {
        driverId: req.auth?.userId || null
      },
      error
    });
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json(
      createResponse({
        success: false,
        message: error.message,
        statusCode,
      })
    );
  }
}

async function updateLocation(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const isAdmin = isAdminActor(actor);
    const { rideId } = req.params;
    const { driverId, currentLocation } = req.body;
    const actorDriverId = actor.userId || actor.subjectId;
    const effectiveDriverId = isAdmin ? driverId : actorDriverId;

    if (!isAdmin && actor.role !== 'Driver') {
      throw createHttpError(403, 'Only drivers or admins can update ride location');
    }

    if (!isAdmin && driverId && driverId !== actorDriverId) {
      throw createHttpError(403, 'Driver ID in payload does not match authenticated driver');
    }

    if (!effectiveDriverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'driverId is required',
          statusCode: 400,
          requestId,
        })
      );
    }

    const validation = locationService.validateLocation(currentLocation);
    if (!validation.valid) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: validation.error,
          statusCode: 400,
          requestId,
        })
      );
    }

    const ride = await rideService.updateRideLocation(
      rideId,
      effectiveDriverId,
      currentLocation
    );

    auditRideSuccess(req, {
      action: 'ride.location.update',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || rideId,
      metadata: {
        driverId: effectiveDriverId,
        status: ride.status,
        currentLocation
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Location updated',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.location.update',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      metadata: {
        driverId: req.body?.driverId || null
      },
      error
    });
    const statusCode = error.statusCode || (error.message === 'Ride not found' ? 404 : 400);
    return res.status(statusCode).json(
      createResponse({
        success: false,
        message: error.message,
        statusCode,
      })
    );
  }
}

async function startRide(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const isAdmin = isAdminActor(actor);
    const { rideId } = req.params;
    const { driverId } = req.body;
    const actorDriverId = actor.userId || actor.subjectId;
    const effectiveDriverId = isAdmin ? driverId : actorDriverId;

    if (!isAdmin && actor.role !== 'Driver') {
      throw createHttpError(403, 'Only drivers or admins can start rides');
    }

    if (!isAdmin && driverId && driverId !== actorDriverId) {
      throw createHttpError(403, 'Driver ID in payload does not match authenticated driver');
    }

    if (!effectiveDriverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'driverId is required',
          statusCode: 400,
          requestId,
        })
      );
    }

    const ride = await rideService.startRide(rideId, effectiveDriverId);

    auditRideSuccess(req, {
      action: 'ride.start',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || rideId,
      metadata: {
        driverId: effectiveDriverId,
        status: ride.status
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride started',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.start',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      metadata: {
        driverId: req.body?.driverId || null
      },
      error
    });
    const statusCode = error.statusCode || (error.message === 'Ride not found' ? 404 : 400);
    return res.status(statusCode).json(
      createResponse({
        success: false,
        message: error.message,
        statusCode,
      })
    );
  }
}

async function completeRide(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const isAdmin = isAdminActor(actor);
    const { rideId } = req.params;
    const { driverId } = req.body;
    const actorDriverId = actor.userId || actor.subjectId;
    const effectiveDriverId = isAdmin ? driverId : actorDriverId;

    if (!isAdmin && actor.role !== 'Driver') {
      throw createHttpError(403, 'Only drivers or admins can complete rides');
    }

    if (!isAdmin && driverId && driverId !== actorDriverId) {
      throw createHttpError(403, 'Driver ID in payload does not match authenticated driver');
    }

    if (!effectiveDriverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'driverId is required',
          statusCode: 400,
          requestId,
        })
      );
    }

    const ride = await rideService.completeRide(rideId, effectiveDriverId);

    auditRideSuccess(req, {
      action: 'ride.complete',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || rideId,
      metadata: {
        driverId: effectiveDriverId,
        status: ride.status
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride completed',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.complete',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      metadata: {
        driverId: req.body?.driverId || null
      },
      error
    });
    const statusCode = error.statusCode || (error.message === 'Ride not found' ? 404 : 400);
    return res.status(statusCode).json(
      createResponse({
        success: false,
        message: error.message,
        statusCode,
      })
    );
  }
}

async function cancelRide(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);
    const isAdmin = isAdminActor(actor);
    const { rideId } = req.params;
    const { userId, driverId, reason } = req.body;
    const actorId = actor.userId || actor.subjectId;
    let effectiveUserId = userId;
    let effectiveDriverId = driverId;

    if (isAdmin) {
      if (!effectiveUserId && !effectiveDriverId) {
        return res.status(400).json(
          createResponse({
            success: false,
            message: 'Either userId or driverId is required',
            statusCode: 400,
            requestId,
          })
        );
      }
    } else if (actor.role === 'Customer') {
      if (userId && userId !== actorId) {
        throw createHttpError(403, 'User ID in payload does not match authenticated customer');
      }
      effectiveUserId = actorId;
      effectiveDriverId = null;
    } else if (actor.role === 'Driver') {
      if (driverId && driverId !== actorId) {
        throw createHttpError(403, 'Driver ID in payload does not match authenticated driver');
      }
      effectiveUserId = null;
      effectiveDriverId = actorId;
    } else {
      throw createHttpError(403, 'Only customers, drivers, or admins can cancel rides');
    }

    if (!effectiveUserId && !effectiveDriverId) {
      return res.status(400).json(
        createResponse({
          success: false,
          message: 'Either userId or driverId is required',
          statusCode: 400,
          requestId,
        })
      );
    }

    const ride = await rideService.cancelRide(rideId, effectiveUserId, effectiveDriverId, reason);

    auditRideSuccess(req, {
      action: 'ride.cancel',
      targetType: 'ride',
      targetId: ride.rideId || ride.bookingId || rideId,
      metadata: {
        userId: effectiveUserId,
        driverId: effectiveDriverId,
        reason: reason || null,
        status: ride.status
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride cancelled',
        data: ride.toJSON(),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.cancel',
      targetType: 'ride',
      targetId: req.params?.rideId || null,
      outcome: 'failure',
      metadata: {
        userId: req.body?.userId || null,
        driverId: req.body?.driverId || null,
        reason: req.body?.reason || null
      },
      error
    });
    const statusCode = error.statusCode || (error.message === 'Ride not found' ? 404 : 400);
    return res.status(statusCode).json(
      createResponse({
        success: false,
        message: error.message,
        statusCode,
      })
    );
  }
}

async function getStatistics(req, res) {
  try {
    const requestId = generateRequestId();
    const actor = requireAuthenticatedActor(req);

    if (!isAdminActor(actor)) {
      throw createHttpError(403, 'Only admins can access ride statistics');
    }

    const stats = await rideService.getRideStatistics();

    auditRideSuccess(req, {
      action: 'ride.stats.read',
      targetType: 'ride',
      targetId: 'statistics',
      metadata: {
        totalRides: stats.totalRides,
        completedRides: stats.completedRides,
        cancelledRides: stats.cancelledRides
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Ride statistics fetched',
        data: stats,
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.stats.read',
      targetType: 'ride',
      targetId: 'statistics',
      outcome: 'failure',
      error
    });
    return res.status(error.statusCode || 500).json(
      createResponse({
        success: false,
        message: error.message || 'Internal server error',
        statusCode: error.statusCode || 500,
      })
    );
  }
}

async function getDriverHistory(req, res) {
  try {
    const requestId = generateRequestId();
    const { driverId } = req.params;
    const actor = requireAuthenticatedActor(req);

    // Ensure the driver is accessing their own history or is an admin
    enforceUserScope(actor, driverId);

    const history = await rideService.getHistoryByDriverId(driverId);

    auditRideSuccess(req, {
      action: 'ride.list.driver.history',
      targetType: 'driver',
      targetId: driverId,
      metadata: {
        rideCount: history.length
      }
    });

    return res.json(
      createResponse({
        success: true,
        message: 'Driver ride history fetched',
        data: history.map((ride) => ride.toJSON()),
        requestId,
      })
    );
  } catch (error) {
    recordAuditEvent(req, {
      action: 'ride.list.driver.history',
      targetType: 'driver',
      targetId: req.params?.driverId || null,
      outcome: 'failure',
      error
    });
    return res.status(error.statusCode || 500).json(
      createResponse({
        success: false,
        message: error.message || 'Internal server error',
        statusCode: error.statusCode || 500,
      })
    );
  }
}

function auditRideSuccess(req, details) {
  recordAuditEvent(req, {
    outcome: 'success',
    ...details
  });
}

function requireAuthenticatedActor(req) {
  if (!isAuthenticatedActor(req.auth)) {
    throw createHttpError(401, 'Authentication context is required');
  }

  return req.auth;
}

function enforceUserScope(actor, userId) {
  if (isAdminActor(actor)) {
    return;
  }

  const actorId = actor.userId || actor.subjectId;
  if (actorId !== userId) {
    throw createHttpError(403, 'You can only access your own ride records');
  }
}

function enforceRideAccess(actor, ride) {
  if (isAdminActor(actor)) {
    return;
  }

  const actorId = actor.userId || actor.subjectId;
  const isOwner = ride.userId === actorId;
  const isAssignedDriver = ride.driverId === actorId;

  if (!isOwner && !isAssignedDriver) {
    throw createHttpError(403, 'You do not have access to this ride');
  }
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export {
  createRide,
  getRide,
  getUserRides,
  assignDriver,
  acceptRide,
  updateLocation,
  startRide,
  completeRide,
  cancelRide,
  getStatistics,
  getDriverHistory,
};
