/**
 * Express App Configuration
 * Sets up middleware and routes
 */

import express from 'express';
import rideRoutes from './routes/ride.routes.js';
import * as rideController from './controllers/ride.controller.js';
import { authContextMiddleware } from './middleware/auth-context.js';

/**
 * Create and configure Express app
 */
function createApp() {
  const app = express();

  // ==================== MIDDLEWARE ====================

  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));
  app.use(authContextMiddleware);

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });
    next();
  });

  // ==================== HEALTH CHECKS ====================

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      service: 'ride-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/v1/rides/health', (req, res) => {
    res.json({
      success: true,
      service: 'ride-service',
      status: 'ok',
      message: 'Ride Service is reachable through the overall architecture',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/', (req, res) => {
    res.json({
      service: 'Ride Service',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        api: '/api/v1/rides',
        documentation: '/docs',
      },
    });
  });

  app.get('/api/v1/rides', (req, res) => {
    res.json({
      service: 'ride-service',
      displayName: 'Ride Service',
      gatewayPath: '/api/v1/rides',
      routes: [
        'POST /api/v1/rides',
        'GET /api/v1/rides/stats',
        'GET /api/v1/rides/:rideId',
        'GET /api/v1/rides/user/:userId',
        'POST /api/v1/rides/:rideId/assign-driver',
        'POST /api/v1/rides/:rideId/location',
        'POST /api/v1/rides/:rideId/start',
        'POST /api/v1/rides/:rideId/complete',
        'POST /api/v1/rides/:rideId/cancel',
      ],
      scope: 'ride-service',
    });
  });

  // ==================== API ROUTES ====================

  // Ride API endpoints
  app.use('/api/v1/rides', rideRoutes);

  // User ride history endpoint
  app.get('/api/v1/users/:userId/rides', rideController.getUserRides);

  // ==================== ERROR HANDLING ====================

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Internal server error',
      statusCode: err.statusCode || 500,
    });
  });

  return app;
}

export {
  createApp,
};
