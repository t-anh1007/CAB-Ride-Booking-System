/**
 * Ride Routes
 * Defines all ride API endpoints
 */

import express from 'express';
import * as rideController from '../controllers/ride.controller.js';

const router = express.Router();

/**
 * Ride Management Endpoints
 */

// Create a new ride
router.post('/', rideController.createRide);

// Get ride statistics
router.get('/stats', rideController.getStatistics);

// Get ride history for a user through ride-service gateway namespace
router.get('/user/:userId', rideController.getUserRides);

// Get ride history for a driver
router.get('/driver/:driverId/history', rideController.getDriverHistory);

// Get ride by ID
router.get('/:rideId', rideController.getRide);

// Assign driver to ride
router.post('/:rideId/assign-driver', rideController.assignDriver);

// Accept a ride
router.post('/:rideId/accept', rideController.acceptRide);

// Update driver location
router.post('/:rideId/location', rideController.updateLocation);

// Start a ride
router.post('/:rideId/start', rideController.startRide);

// Complete a ride
router.post('/:rideId/complete', rideController.completeRide);

// Cancel a ride
router.post('/:rideId/cancel', rideController.cancelRide);

export default router;
