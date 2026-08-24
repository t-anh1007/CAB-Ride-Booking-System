#!/usr/bin/env node
/**
 * Ride Service Test Suite
 * Tests all REST API endpoints and WebSocket functionality
 */

const http = require('http');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3009';
const WS_URL = 'ws://localhost:3009';

// Test data
let testRideId = null;
const testUserId = 'user-123-test';
const testDriverId = 'driver-456-test';
const testBookingId = 'booking-789-test';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(type, message) {
  const timestamp = new Date().toISOString();
  let color = colors.reset;

  switch (type) {
    case 'success':
      color = colors.green;
      break;
    case 'error':
      color = colors.red;
      break;
    case 'info':
      color = colors.blue;
      break;
    case 'test':
      color = colors.yellow;
      break;
  }

  console.log(`${color}[${timestamp}] ${type.toUpperCase()}: ${message}${colors.reset}`);
}

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3009,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            body: parsed,
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
            headers: res.headers,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test functions
async function testCreateRide() {
  log('test', 'Testing POST /api/v1/rides - Create Ride');

  const payload = {
    bookingId: testBookingId,
    userId: testUserId,
    driverId: null,
    pickup: {
      lat: 10.762622,
      lng: 106.660172,
      address: 'Quận 1, TP.HCM',
    },
    destination: {
      lat: 10.776889,
      lng: 106.700806,
      address: 'Bình Thạnh, TP.HCM',
    },
  };

  try {
    const res = await makeRequest('POST', '/api/v1/rides', payload);
    if (res.statusCode === 201 && res.body.success) {
      testRideId = res.body.data.rideId;
      log('success', `Ride created: ${testRideId}`);
      log('info', `Response data: ${JSON.stringify(res.body.data, null, 2)}`);
      return true;
    } else {
      log('error', `Failed to create ride: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testGetRide() {
  log('test', `Testing GET /api/v1/rides/:rideId - Get Ride (ID: ${testRideId})`);

  try {
    const res = await makeRequest('GET', `/api/v1/rides/${testRideId}`);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Ride retrieved: ${JSON.stringify(res.body.data, null, 2)}`);
      return true;
    } else {
      log('error', `Failed to get ride: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testAssignDriver() {
  log('test', `Testing POST /api/v1/rides/:rideId/assign-driver`);

  const payload = {
    driverId: testDriverId,
  };

  try {
    const res = await makeRequest('POST', `/api/v1/rides/${testRideId}/assign-driver`, payload);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Driver assigned. New status: ${res.body.data.status}`);
      return true;
    } else {
      log('error', `Failed to assign driver: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testUpdateLocation() {
  log('test', `Testing POST /api/v1/rides/:rideId/location - Update Location`);

  const payload = {
    driverId: testDriverId,
    currentLocation: {
      lat: 10.765,
      lng: 106.665,
      address: 'En route',
    },
  };

  try {
    const res = await makeRequest('POST', `/api/v1/rides/${testRideId}/location`, payload);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Location updated. ETA: ${res.body.data.etaMinutes} minutes`);
      return true;
    } else {
      log('error', `Failed to update location: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testStartRide() {
  log('test', `Testing POST /api/v1/rides/:rideId/start - Start Ride`);

  const payload = {
    driverId: testDriverId,
  };

  try {
    const res = await makeRequest('POST', `/api/v1/rides/${testRideId}/start`, payload);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Ride started. Status: ${res.body.data.status}`);
      return true;
    } else {
      log('error', `Failed to start ride: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testCompleteRide() {
  log('test', `Testing POST /api/v1/rides/:rideId/complete - Complete Ride`);

  const payload = {
    driverId: testDriverId,
  };

  try {
    const res = await makeRequest('POST', `/api/v1/rides/${testRideId}/complete`, payload);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Ride completed. Status: ${res.body.data.status}`);
      return true;
    } else {
      log('error', `Failed to complete ride: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testCancelRide() {
  log('test', `Testing POST /api/v1/rides/:rideId/cancel - Cancel Ride`);

  // Create another ride for cancellation test
  const payload = {
    bookingId: 'booking-cancel-test',
    userId: testUserId,
    pickup: {
      lat: 10.762622,
      lng: 106.660172,
      address: 'Test location',
    },
    destination: {
      lat: 10.776889,
      lng: 106.700806,
      address: 'Test destination',
    },
  };

  try {
    const createRes = await makeRequest('POST', '/api/v1/rides', payload);
    const cancelRideId = createRes.body.data.rideId;

    const cancelPayload = {
      userId: testUserId,
      reason: 'Test cancellation',
    };

    const res = await makeRequest('POST', `/api/v1/rides/${cancelRideId}/cancel`, cancelPayload);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Ride cancelled. Status: ${res.body.data.status}`);
      return true;
    } else {
      log('error', `Failed to cancel ride: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testGetUserRides() {
  log('test', `Testing GET /api/v1/users/:userId/rides - Get User Rides`);

  try {
    const res = await makeRequest('GET', `/api/v1/users/${testUserId}/rides`);
    if (res.statusCode === 200 && res.body.success) {
      log('success', `Retrieved ${res.body.data.length} rides for user ${testUserId}`);
      return true;
    } else {
      log('error', `Failed to get user rides: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (error) {
    log('error', `Error: ${error.message}`);
    return false;
  }
}

async function testWebSocket() {
  log('test', 'Testing WebSocket Connection');

  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        log('success', 'WebSocket connection established');

        // Register driver
        const registerMsg = {
          type: 'driver_register',
          driverId: testDriverId,
        };
        ws.send(JSON.stringify(registerMsg));
        log('info', 'Driver registered');

        // Send location update
        setTimeout(() => {
          const locationMsg = {
            type: 'driver_location',
            rideId: testRideId,
            driverId: testDriverId,
            currentLocation: {
              lat: 10.77,
              lng: 106.7,
              address: 'WebSocket test location',
            },
          };
          ws.send(JSON.stringify(locationMsg));
          log('info', 'Location update sent via WebSocket');
        }, 500);

        // Listen for responses
        ws.on('message', (msg) => {
          const data = JSON.parse(msg);
          log('success', `Received message: ${data.type}`);
        });

        // Close after 2 seconds
        setTimeout(() => {
          ws.close();
          log('success', 'WebSocket test completed');
          resolve(true);
        }, 2000);
      });

      ws.on('error', (error) => {
        log('error', `WebSocket error: ${error.message}`);
        resolve(false);
      });
    } catch (error) {
      log('error', `Error: ${error.message}`);
      resolve(false);
    }
  });
}

// Run all tests
async function runTests() {
  log('info', '========== RIDE SERVICE TEST SUITE ==========');
  log('info', `Base URL: ${BASE_URL}`);
  log('info', `WebSocket URL: ${WS_URL}`);
  log('info', '==========================================\n');

  const results = [];

  // Run REST API tests
  results.push(await testCreateRide());
  results.push(await testGetRide());
  results.push(await testAssignDriver());
  results.push(await testUpdateLocation());
  results.push(await testStartRide());
  results.push(await testCompleteRide());
  results.push(await testCancelRide());
  results.push(await testGetUserRides());

  // Run WebSocket test
  results.push(await testWebSocket());

  // Summary
  log('info', '\n========== TEST SUMMARY ==========');
  const passed = results.filter((r) => r).length;
  const total = results.length;
  log(passed === total ? 'success' : 'error', `${passed}/${total} tests passed`);
  log('info', '==================================\n');

  process.exit(passed === total ? 0 : 1);
}

// Run tests if script is executed directly
if (require.main === module) {
  // Wait a bit for service to be ready
  setTimeout(runTests, 1000);
}

module.exports = {
  testCreateRide,
  testGetRide,
  testAssignDriver,
  testUpdateLocation,
  testStartRide,
  testCompleteRide,
  testCancelRide,
  testGetUserRides,
  testWebSocket,
};
