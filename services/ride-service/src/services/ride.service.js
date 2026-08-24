/**
 * Ride Service
 * Business logic for ride operations with optional MongoDB persistence
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Ride, RIDE_STATUS } from '../models/ride.model.js';
import { RideMongoModel } from '../models/ride.mongo.model.js';
import { calculateETA } from './eta.service.js';
import { updateDriverLocation } from './location.service.js';
import { publishRideEvent } from './kafka.publisher.js';
import { isMongoConnected } from '../database/mongoose.js';


const rides = new Map();

function usesMongo() {
  return isMongoConnected();
}

function toRideObject(ride) {
  if (!ride) {
    return null;
  }

  if (typeof ride.toJSON === 'function') {
    return ride;
  }

  return new Ride(ride);
}

function fromMongoDoc(doc) {
  return doc ? doc : null;
}

function setRideFields(ride, updates) {
  Object.assign(ride, updates);
  return ride;
}

function serializeRide(ride) {
  if (!ride) {
    return null;
  }

  return typeof ride.toJSON === 'function' ? ride.toJSON() : ride;
}

async function emitRideStatusChanged(ride, extra = {}) {
  if (!ride) {
    return;
  }

  try {
    await publishRideEvent('ride.status.changed', {
      eventType: 'RideStatusChanged',
      rideId: ride.rideId,
      bookingId: ride.bookingId,
      userId: ride.userId,
      driverId: ride.driverId || null,
      status: ride.status,
      currentLocation: ride.currentLocation || null,
      pickup: ride.pickup || null,
      destination: ride.destination || null,
      etaMinutes: ride.etaMinutes ?? null,
      price: ride.priceSnapshot || 0,
      priceSnapshot: ride.priceSnapshot || 0,
      distanceKm: ride.distanceKm || 0,
      rideType: ride.rideType || 'bike',
      updatedAt: ride.updatedAt,
      ...extra,
    }, ride.rideId);
  } catch (error) {
    console.warn('[ride.service] failed to publish ride.status.changed:', error.message);
  }
}

async function emitDriverAssigned(ride, extra = {}) {
  if (!ride) {
    return;
  }

  try {
    await publishRideEvent('driver.assigned', {
      eventType: 'DriverAssigned',
      rideId: ride.rideId,
      bookingId: ride.bookingId,
      userId: ride.userId,
      driverId: ride.driverId || null,
      status: ride.status,
      pickup: ride.pickup || null,
      destination: ride.destination || null,
      updatedAt: ride.updatedAt,
      ...extra,
    }, ride.driverId || ride.rideId);
  } catch (error) {
    console.warn('[ride.service] failed to publish driver.assigned:', error.message);
  }
}

async function emitDriverLocationUpdated(ride, location, extra = {}) {
  if (!ride || !location) {
    return;
  }

  try {
    await publishRideEvent(
      'driver.location.updated',
      {
        eventType: 'DriverLocationUpdated',
        rideId: ride.rideId,
        bookingId: ride.bookingId,
        userId: ride.userId,
        driverId: ride.driverId || null,
        status: ride.status,
        etaMinutes: ride.etaMinutes ?? null,
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address || null,
          updatedAt: location.updatedAt || ride.updatedAt || null,
        },
        updatedAt: ride.updatedAt,
        ...extra,
      },
      ride.driverId || ride.rideId
    );
  } catch (error) {
    console.warn('[ride.service] failed to publish driver.location.updated:', error.message);
  }
}

async function saveRide(ride) {
  if (usesMongo()) {
    if (typeof ride.save === 'function') {
      await ride.save();
      return ride;
    }

    const payload = ride.toJSON ? ride.toJSON() : ride;
    return RideMongoModel.create(payload);
  }

  rides.set(ride.rideId, ride);
  return ride;
}

async function getRideById(rideId) {
  if (usesMongo()) {
    return RideMongoModel.findOne({ rideId });
  }

  return rides.get(rideId) || null;
}

async function getRidesByUserId(userId) {
  if (usesMongo()) {
    return RideMongoModel.find({ userId }).sort({ updatedAt: -1 });
  }

  return Array.from(rides.values()).filter((ride) => ride.userId === userId);
}

async function getRidesByDriverId(driverId) {
  if (usesMongo()) {
    return RideMongoModel.find({
      driverId,
      status: {
        $in: [
          RIDE_STATUS.WAITING_FOR_ACCEPTANCE,
          RIDE_STATUS.ACCEPTED,
          RIDE_STATUS.DRIVER_ARRIVING,
          RIDE_STATUS.IN_PROGRESS,
        ],
      },
    }).sort({ updatedAt: -1 });
  }

  return Array.from(rides.values()).filter(
    (ride) =>
      ride.driverId === driverId &&
      [
        RIDE_STATUS.WAITING_FOR_ACCEPTANCE,
        RIDE_STATUS.ACCEPTED,
        RIDE_STATUS.DRIVER_ARRIVING,
        RIDE_STATUS.IN_PROGRESS,
      ].includes(ride.status)
  );
}

async function getHistoryByDriverId(driverId) {
  if (usesMongo()) {
    return RideMongoModel.find({
      driverId,
      status: {
        $in: [RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED],
      },
    }).sort({ updatedAt: -1 });
  }

  return Array.from(rides.values()).filter(
    (ride) =>
      ride.driverId === driverId &&
      [RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED].includes(ride.status)
  );
}

async function emitRideCreated(ride, extra = {}) {
  if (!ride) return;
  try {
    await publishRideEvent('ride.created.internal', {
      eventType: 'RideInitialized',
      rideId: ride.rideId,
      bookingId: ride.bookingId,
      userId: ride.userId,
      pickup: ride.pickup,
      destination: ride.destination,
      priceSnapshot: ride.priceSnapshot,
      status: ride.status,
      updatedAt: ride.updatedAt,
      ...extra,
    }, ride.rideId);
  } catch (error) {
    console.warn('[ride.service] failed to publish ride.created.internal:', error.message);
  }
}

async function createRide(rideData) {
  if (!rideData.bookingId || !rideData.userId) {
    throw new Error('bookingId and userId are required');
  }
  if (!rideData.pickup || !rideData.destination) {
    throw new Error('pickup and destination are required');
  }

  const payload = {
    rideId: rideData.rideId || uuidv4(),
    bookingId: rideData.bookingId,
    userId: rideData.userId,
    driverId: rideData.driverId || null,
    pickup: rideData.pickup,
    destination: rideData.destination,
    priceSnapshot: rideData.priceSnapshot || 0,
    distanceKm: rideData.distanceKm || 0,
    rideType: rideData.rideType || 'bike',
    quoteId: rideData.quoteId || null,
    status: rideData.status || RIDE_STATUS.SEARCHING
  };

  let savedRide;
  if (usesMongo()) {
    // Idempotency check using findOneAndUpdate with upsert
    savedRide = await RideMongoModel.findOneAndUpdate(
      { bookingId: payload.bookingId },
      { $setOnInsert: payload },
      { upsert: true, new: true }
    );
  } else {
    if (rides.has(payload.rideId)) {
      savedRide = rides.get(payload.rideId);
    } else {
      savedRide = new Ride(payload);
      rides.set(payload.rideId, savedRide);
    }
  }

  const serialized = serializeRide(savedRide);
  await emitRideStatusChanged(serialized, { action: 'created' });
  await emitRideCreated(serialized); // Notify matching-service

  return savedRide;
}

async function assignDriver(rideId, driverId) {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (!driverId) {
    throw new Error('driverId is required');
  }

  // Phase 4: Matching-service assigns a driver, but we wait for acceptance
  if (ride.status !== RIDE_STATUS.SEARCHING) {
    throw new Error(`Cannot assign driver to ride in ${ride.status} status`);
  }

  if (usesMongo()) {
    ride.driverId = driverId;
    ride.status = RIDE_STATUS.WAITING_FOR_ACCEPTANCE;
    await ride.save();
    await emitDriverAssigned(ride);
    await emitRideStatusChanged(serializeRide(ride), { action: 'assigned' });
    return ride;
  }

  ride.driverId = driverId;
  ride.updateStatus(RIDE_STATUS.WAITING_FOR_ACCEPTANCE);
  await saveRide(ride);
  await emitDriverAssigned(ride);
  await emitRideStatusChanged(serializeRide(ride), { action: 'assigned' });
  return ride;
}

async function acceptRide(rideId, driverId) {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.driverId !== driverId) {
    throw new Error('Unauthorized: Driver ID mismatch');
  }

  if (ride.status !== RIDE_STATUS.WAITING_FOR_ACCEPTANCE) {
    throw new Error(`Cannot accept ride in ${ride.status} status`);
  }

  if (usesMongo()) {
    ride.status = RIDE_STATUS.ACCEPTED;
    await ride.save();
  } else {
    ride.status = RIDE_STATUS.ACCEPTED;
    ride.updatedAt = new Date().toISOString();
    await saveRide(ride);
  }

  await emitRideStatusChanged(serializeRide(ride), {
    action: 'accepted',
    driverId
  });

  return ride;
}

async function updateRideLocation(rideId, driverId, location) {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (!driverId || ride.driverId !== driverId) {
    throw new Error('Driver ID mismatch');
  }

  if (!location || location.lat === undefined || location.lng === undefined) {
    throw new Error('Invalid location: must include lat and lng');
  }

  const allowedStatuses = new Set([
    RIDE_STATUS.DRIVER_ASSIGNED,
    RIDE_STATUS.DRIVER_ARRIVING,
    RIDE_STATUS.IN_PROGRESS
  ]);
  if (!allowedStatuses.has(ride.status)) {
    throw new Error(`Driver can update GPS only when ride is active, arriving, or in progress (current: ${ride.status})`);
  }

  const previousStatus = ride.status;

  if (usesMongo()) {
    ride.currentLocation = location;

    if (ride.status === RIDE_STATUS.ACCEPTED) {
      ride.status = RIDE_STATUS.DRIVER_ARRIVING;
    }

    if (
      ride.status === RIDE_STATUS.DRIVER_ASSIGNED ||
      ride.status === RIDE_STATUS.DRIVER_ARRIVING
    ) {
      ride.etaMinutes = await calculateETA(location, ride.pickup);
    } else if (ride.status === RIDE_STATUS.IN_PROGRESS) {
      ride.etaMinutes = await calculateETA(location, ride.destination);
    }

    await ride.save();
    await updateDriverLocation(driverId, location);
    await emitDriverLocationUpdated(serializeRide(ride), location, {
      action: 'location-updated',
    });
    if (ride.status !== previousStatus) {
      await emitRideStatusChanged(serializeRide(ride), {
        action: 'status-transition',
        previousStatus,
      });
    }
    return ride;
  }

  ride.currentLocation = location;
  ride.updatedAt = new Date().toISOString();

  if (ride.status === RIDE_STATUS.ACCEPTED) {
    ride.status = RIDE_STATUS.DRIVER_ARRIVING;
  }

  if (
    ride.status === RIDE_STATUS.ACCEPTED ||
    ride.status === RIDE_STATUS.DRIVER_ARRIVING
  ) {
    ride.etaMinutes = await calculateETA(location, ride.pickup);
  } else if (ride.status === RIDE_STATUS.IN_PROGRESS) {
    ride.etaMinutes = await calculateETA(location, ride.destination);
  }

  await updateDriverLocation(driverId, location);
  await saveRide(ride);
  await emitDriverLocationUpdated(serializeRide(ride), location, {
    action: 'location-updated',
  });
  if (ride.status !== previousStatus) {
    await emitRideStatusChanged(serializeRide(ride), {
      action: 'status-transition',
      previousStatus,
    });
  }
  return ride;
}

async function startRide(rideId, driverId) {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (!driverId || ride.driverId !== driverId) {
    throw new Error('Unauthorized: Driver ID does not match');
  }

  if (
    ![RIDE_STATUS.ACCEPTED, RIDE_STATUS.DRIVER_ASSIGNED, RIDE_STATUS.DRIVER_ARRIVING].includes(
      ride.status
    )
  ) {
    throw new Error(
      `Cannot start ride in ${ride.status} status. Must be in ACCEPTED, DRIVER_ASSIGNED or DRIVER_ARRIVING`
    );
  }

  if (usesMongo()) {
    ride.status = RIDE_STATUS.IN_PROGRESS;
    ride.startedAt = new Date();
    ride.updatedAt = new Date();
    if (ride.currentLocation) {
      ride.etaMinutes = await calculateETA(ride.currentLocation, ride.destination);
    }
    await ride.save();
  } else {
    ride.status = RIDE_STATUS.IN_PROGRESS;
    ride.startedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();
    if (ride.currentLocation) {
      ride.etaMinutes = await calculateETA(ride.currentLocation, ride.destination);
    }
    await saveRide(ride);
  }

  await emitRideStatusChanged(serializeRide(ride), {
    action: 'started',
    startedAt: ride.startedAt,
  });
  return ride;
}

async function completeRide(rideId, driverId) {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (!driverId || ride.driverId !== driverId) {
    throw new Error('Unauthorized: Driver ID does not match');
  }

  if (ride.status !== RIDE_STATUS.IN_PROGRESS) {
    throw new Error(
      `Cannot complete ride in ${ride.status} status. Must be IN_PROGRESS`
    );
  }

  if (usesMongo()) {
    ride.status = RIDE_STATUS.COMPLETED;
    ride.completedAt = new Date();
    ride.updatedAt = new Date();
    ride.currentLocation = ride.destination;
    ride.etaMinutes = 0;
    await ride.save();
  } else {
    ride.status = RIDE_STATUS.COMPLETED;
    ride.completedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();
    ride.currentLocation = ride.destination;
    ride.etaMinutes = 0;
    await saveRide(ride);
  }

  await emitRideStatusChanged(serializeRide(ride), {
    action: 'completed',
    completedAt: ride.completedAt,
  });

  // [BỔ SUNG] Giải phóng tài xế sang AVAILABLE
  try {
    const driverServiceUrl = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3107';
    await axios.patch(`${driverServiceUrl}/api/v1/drivers/${ride.driverId}`, {
      availability: 'AVAILABLE'
    });
    console.log(`🔓 [Ride Service] Driver ${ride.driverId} set back to AVAILABLE`);

    // [BỔ SUNG] Cập nhật Booking sang COMPLETED
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3103';
    await axios.patch(`${bookingServiceUrl}/api/v1/bookings/${ride.bookingId}`, {
      status: 'COMPLETED'
    });
    console.log(`✅ [Ride Service] Booking ${ride.bookingId} set to COMPLETED`);

  } catch (error) {
    console.error(`⚠️ [Ride Service] Failed to sync status to other services: ${error.message}`);
  }


  return ride;
}

async function cancelRide(rideId, userId = null, driverId = null, reason = '') {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  const isUserAuthorized = userId && ride.userId === userId;
  const isDriverAuthorized = driverId && ride.driverId === driverId;

  if (!isUserAuthorized && !isDriverAuthorized) {
    throw new Error('Unauthorized: Cannot cancel this ride');
  }

  if ([RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED].includes(ride.status)) {
    throw new Error(`Cannot cancel ride in ${ride.status} status`);
  }

  if (usesMongo()) {
    ride.status = RIDE_STATUS.CANCELLED;
    ride.updatedAt = new Date();
    await ride.save();
  } else {
    ride.status = RIDE_STATUS.CANCELLED;
    ride.updatedAt = new Date().toISOString();
    await saveRide(ride);
  }

  await emitRideStatusChanged(serializeRide(ride), {
    action: 'cancelled',
    reason,
  });

  return ride;
}

async function getRideStatistics() {
  if (usesMongo()) {
    const [searching, driverAssigned, driverArriving, inProgress, completed, cancelled] =
      await Promise.all([
        RideMongoModel.countDocuments({ status: RIDE_STATUS.SEARCHING }),
        RideMongoModel.countDocuments({ status: RIDE_STATUS.DRIVER_ASSIGNED }),
        RideMongoModel.countDocuments({ status: RIDE_STATUS.DRIVER_ARRIVING }),
        RideMongoModel.countDocuments({ status: RIDE_STATUS.IN_PROGRESS }),
        RideMongoModel.countDocuments({ status: RIDE_STATUS.COMPLETED }),
        RideMongoModel.countDocuments({ status: RIDE_STATUS.CANCELLED }),
      ]);

    return {
      totalRides: searching + driverAssigned + driverArriving + inProgress + completed + cancelled,
      byStatus: {
        searching,
        driverAssigned,
        driverArriving,
        inProgress,
        completed,
        cancelled,
      },
    };
  }

  const allRides = Array.from(rides.values());

  return {
    totalRides: allRides.length,
    byStatus: {
      searching: allRides.filter((r) => r.status === RIDE_STATUS.SEARCHING).length,
      driverAssigned: allRides.filter((r) => r.status === RIDE_STATUS.DRIVER_ASSIGNED).length,
      driverArriving: allRides.filter((r) => r.status === RIDE_STATUS.DRIVER_ARRIVING).length,
      inProgress: allRides.filter((r) => r.status === RIDE_STATUS.IN_PROGRESS).length,
      completed: allRides.filter((r) => r.status === RIDE_STATUS.COMPLETED).length,
      cancelled: allRides.filter((r) => r.status === RIDE_STATUS.CANCELLED).length,
    },
  };
}

async function clearAllRides() {
  if (usesMongo()) {
    await RideMongoModel.deleteMany({});
    return;
  }

  rides.clear();
}

export default {
  createRide,
  getRideById,
  getRidesByUserId,
  getRidesByDriverId,
  acceptRide,
  updateRideLocation,
  startRide,
  completeRide,
  cancelRide,
  getHistoryByDriverId,
  getRideStatistics,
  clearAllRides,
};

export {
    createRide,
    getRideById,
    getRidesByUserId,
    getRidesByDriverId,
    acceptRide,
    updateRideLocation,
    startRide,
    completeRide,
    cancelRide,
    getHistoryByDriverId,
    getRideStatistics,
    clearAllRides,
};
