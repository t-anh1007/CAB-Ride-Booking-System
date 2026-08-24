/**
 * Ride Model
 * Defines the structure of a Ride document
 */

import { v4 as uuidv4 } from 'uuid';

// Ride Status Enum
export const RIDE_STATUS = {
  REQUESTED: 'REQUESTED',
  SEARCHING: 'SEARCHING',
  WAITING_FOR_ACCEPTANCE: 'WAITING_FOR_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  DRIVER_ARRIVING: 'DRIVER_ARRIVING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED_NO_DRIVER: 'FAILED_NO_DRIVER',
};

/**
 * Create a new Ride object
 * @param {Object} data - Ride data
 * @returns {Object} Ride object
 */
class Ride {
  constructor(data) {
    this.rideId = data.rideId || uuidv4();
    this.bookingId = data.bookingId;
    this.userId = data.userId;
    this.driverId = data.driverId || null;
    this.status = data.status || RIDE_STATUS.REQUESTED;
    
    // Financial Data (Phase 2)
    this.quoteId = data.quoteId || null;
    this.priceSnapshot = data.priceSnapshot || 0;
    this.distanceKm = data.distanceKm || 0;
    this.rideType = data.rideType || 'bike';
    this.paymentStatus = data.paymentStatus || 'PENDING';
    this.paymentId = data.paymentId || null;

    this.pickup = data.pickup;
    this.destination = data.destination;
    this.currentLocation = data.currentLocation || null;
    this.etaMinutes = data.etaMinutes || null;
    this.startedAt = data.startedAt || null;
    this.completedAt = data.completedAt || null;
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Convert to JSON response format
   */
  toJSON() {
    return {
      rideId: this.rideId,
      bookingId: this.bookingId,
      userId: this.userId,
      driverId: this.driverId,
      status: this.status,
      quoteId: this.quoteId,
      priceSnapshot: this.priceSnapshot,
      distanceKm: this.distanceKm,
      rideType: this.rideType,
      paymentStatus: this.paymentStatus,
      paymentId: this.paymentId,
      pickup: this.pickup,
      destination: this.destination,
      currentLocation: this.currentLocation,
      etaMinutes: this.etaMinutes,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Check if ride can transition to new status
   */
  canTransitionTo(newStatus) {
    const validTransitions = {
      [RIDE_STATUS.REQUESTED]: [RIDE_STATUS.SEARCHING, RIDE_STATUS.CANCELLED],
      [RIDE_STATUS.SEARCHING]: [RIDE_STATUS.WAITING_FOR_ACCEPTANCE, RIDE_STATUS.FAILED_NO_DRIVER, RIDE_STATUS.CANCELLED],
      [RIDE_STATUS.WAITING_FOR_ACCEPTANCE]: [RIDE_STATUS.ACCEPTED, RIDE_STATUS.SEARCHING, RIDE_STATUS.CANCELLED],
      [RIDE_STATUS.ACCEPTED]: [RIDE_STATUS.DRIVER_ARRIVING, RIDE_STATUS.CANCELLED],
      [RIDE_STATUS.DRIVER_ARRIVING]: [RIDE_STATUS.IN_PROGRESS, RIDE_STATUS.CANCELLED],
      [RIDE_STATUS.IN_PROGRESS]: [RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED],
      [RIDE_STATUS.COMPLETED]: [],
      [RIDE_STATUS.CANCELLED]: [],
      [RIDE_STATUS.FAILED_NO_DRIVER]: [RIDE_STATUS.SEARCHING, RIDE_STATUS.CANCELLED],
    };

    return (validTransitions[this.status] || []).includes(newStatus);
  }

  /**
   * Update status with validation
   */
  updateStatus(newStatus) {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${newStatus}`
      );
    }
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();
  }
}

export {
  Ride,
};
