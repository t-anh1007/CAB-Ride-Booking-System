/**
 * Review Store — Data access layer for review-service.
 *
 * In production this would talk to PostgreSQL (as declared in the manifest).
 * For now an in-memory Map is used so the service is fully runnable without
 * external dependencies while preserving the exact same interface that a real
 * repository would expose.
 *
 * Every public method returns plain objects that match the API contract defined
 * in the project documentation.
 */

import { v4 as uuidv4 } from "uuid";

const reviews = new Map();

/**
 * Persist a new review and return the stored record.
 *
 * @param {{ rideId: string, userId: string, driverId: string, rating: number, comment?: string }} data
 * @returns {{ reviewId: string, rideId: string, userId: string, driverId: string, rating: number, comment: string|null, createdAt: string }}
 */
export function createReview(data) {
  const reviewId = uuidv4();
  const createdAt = new Date().toISOString();

  const review = {
    reviewId,
    rideId: data.rideId,
    userId: data.userId,
    driverId: data.driverId,
    rating: data.rating,
    comment: data.comment || null,
    createdAt
  };

  reviews.set(reviewId, review);
  return review;
}

/**
 * Retrieve all reviews associated with a ride.
 *
 * @param {string} rideId
 * @returns {Array}
 */
export function findByRideId(rideId) {
  return [...reviews.values()].filter((review) => review.rideId === rideId);
}

/**
 * Retrieve all reviews targeting a specific driver.
 *
 * @param {string} driverId
 * @returns {Array}
 */
export function findByDriverId(driverId) {
  return [...reviews.values()].filter((review) => review.driverId === driverId);
}

/**
 * Calculate the average rating for a driver.
 * Returns `null` when no reviews exist yet.
 *
 * @param {string} driverId
 * @returns {{ averageRating: number|null, totalReviews: number }}
 */
export function getDriverAverageRating(driverId) {
  const driverReviews = findByDriverId(driverId);

  if (driverReviews.length === 0) {
    return { averageRating: null, totalReviews: 0 };
  }

  const sum = driverReviews.reduce((accumulator, review) => accumulator + review.rating, 0);
  const averageRating = Math.round((sum / driverReviews.length) * 100) / 100;

  return { averageRating, totalReviews: driverReviews.length };
}

/**
 * Check whether a user has already reviewed a specific ride.
 * Used for idempotency at the service level (gateway also enforces this).
 *
 * @param {string} rideId
 * @param {string} userId
 * @returns {object|null}
 */
export function findExistingReview(rideId, userId) {
  return [...reviews.values()].find(
    (review) => review.rideId === rideId && review.userId === userId
  ) || null;
}
