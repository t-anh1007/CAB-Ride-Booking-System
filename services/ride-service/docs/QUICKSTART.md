# Ride Service - Quick Start Guide

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd services/ride-service
npm install
```

### Step 2: Start the Service
```bash
npm start
```

You should see:
```
🚖 Ride service listening on port 3009
   REST API: http://localhost:3009/api/v1/rides
   WebSocket: ws://localhost:3009
```

### Step 3: Verify Service is Running
```bash
curl http://localhost:3009/health
```

Expected response:
```json
{
  "success": true,
  "service": "ride-service",
  "status": "ok",
  "timestamp": "2026-04-08T10:15:30Z"
}
```

## Test the APIs

### In a New Terminal Window

#### 1. Create a Ride
```bash
curl -X POST http://localhost:3009/api/v1/rides \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking-001",
    "userId": "user-001",
    "pickup": {
      "lat": 10.762622,
      "lng": 106.660172,
      "address": "Quận 1, TP.HCM"
    },
    "destination": {
      "lat": 10.776889,
      "lng": 106.700806,
      "address": "Bình Thạnh, TP.HCM"
    }
  }'
```

**Save the `rideId` from the response** (you'll need it for subsequent requests)

#### 2. Get the Ride
```bash
# Replace RIDE_ID with the actual ID from step 1
curl http://localhost:3009/api/v1/rides/RIDE_ID
```

#### 3. Assign a Driver
```bash
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/assign-driver \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-001"}'
```

Status should change to `DRIVER_ASSIGNED`

#### 4. Update Driver Location (Simulating GPS)
```bash
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/location \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-001",
    "currentLocation": {
      "lat": 10.765,
      "lng": 106.665,
      "address": "En route"
    }
  }'
```

Notice `etaMinutes` and `currentLocation` in the response!

#### 5. Start the Ride
```bash
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/start \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-001"}'
```

Status changes to `IN_PROGRESS`

#### 6. Complete the Ride
```bash
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-001"}'
```

Status changes to `COMPLETED`

#### 7. Get All User Rides
```bash
curl http://localhost:3009/api/v1/users/user-001/rides
```

## Test WebSocket (Real-time Tracking)

### Using JavaScript/Node.js

Create a file `ws-test.js`:

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3009');

ws.on('open', () => {
  console.log('Connected to Ride Service');

  // Register driver
  ws.send(JSON.stringify({
    type: 'driver_register',
    driverId: 'driver-ws-001',
  }));

  console.log('Driver registered. Sending location updates...');

  // Simulate location updates
  let counter = 0;
  const interval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'driver_location',
      rideId: 'RIDE_ID', // Use actual ride ID
      driverId: 'driver-ws-001',
      currentLocation: {
        lat: 10.762622 + (counter * 0.001),
        lng: 106.660172 + (counter * 0.001),
        address: `Location ${counter}`,
      },
    }));

    counter++;
    if (counter > 5) clearInterval(interval);
  }, 1000);
});

ws.on('message', (message) => {
  const data = JSON.parse(message);
  console.log('📍 Received:', data.type);
  if (data.type === 'ride_update') {
    console.log('   Status:', data.data.status);
    console.log('   ETA:', data.data.etaMinutes, 'minutes');
    console.log('   Location:', data.data.currentLocation);
  }
});

ws.on('close', () => console.log('Disconnected'));
ws.on('error', (err) => console.error('Error:', err.message));
```

Run it:
```bash
node ws-test.js
```

## Run Complete Test Suite

```bash
# Terminal 1: Start the service
npm start

# Terminal 2: Run all tests
node test.js
```

Expected output:
```
🟢 [timestamp] SUCCESS: Ride created
🟢 [timestamp] SUCCESS: Ride retrieved
🟢 [timestamp] SUCCESS: Driver assigned
🟢 [timestamp] SUCCESS: Location updated
🟢 [timestamp] SUCCESS: Ride started
🟢 [timestamp] SUCCESS: Ride completed
🟢 [timestamp] SUCCESS: Ride cancelled
🟢 [timestamp] SUCCESS: User rides retrieved
🟢 [timestamp] SUCCESS: WebSocket test completed

========== TEST SUMMARY ==========
✅ 9/9 tests passed
==================================
```

## API Response Examples

### Create Ride Response (201)
```json
{
  "success": true,
  "message": "Ride created",
  "data": {
    "rideId": "550e8400-e29b-41d4-a716-446655440000",
    "bookingId": "booking-001",
    "userId": "user-001",
    "driverId": null,
    "status": "SEARCHING",
    "pickup": {
      "lat": 10.762622,
      "lng": 106.660172,
      "address": "Quận 1, TP.HCM"
    },
    "destination": {
      "lat": 10.776889,
      "lng": 106.700806,
      "address": "Bình Thạnh, TP.HCM"
    },
    "currentLocation": null,
    "etaMinutes": null,
    "startedAt": null,
    "completedAt": null,
    "updatedAt": "2026-04-08T10:15:30.123Z"
  },
  "meta": {
    "requestId": "660e8400-e29b-41d4-a716-446655440001",
    "correlationId": "770e8400-e29b-41d4-a716-446655440002",
    "timestamp": "2026-04-08T10:15:30.123Z"
  }
}
```

### Ride with Location Response (200)
```json
{
  "success": true,
  "message": "Location updated",
  "data": {
    "rideId": "550e8400-e29b-41d4-a716-446655440000",
    "bookingId": "booking-001",
    "userId": "user-001",
    "driverId": "driver-001",
    "status": "DRIVER_ARRIVING",
    "pickup": {...},
    "destination": {...},
    "currentLocation": {
      "lat": 10.765,
      "lng": 106.665,
      "address": "En route"
    },
    "etaMinutes": 5,
    "startedAt": null,
    "completedAt": null,
    "updatedAt": "2026-04-08T10:15:35.456Z"
  },
  "meta": {...}
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 201  | ✅ Ride created |
| 200  | ✅ Success |
| 400  | ❌ Bad request (missing fields) |
| 403  | ❌ Forbidden (wrong driver/user) |
| 404  | ❌ Ride not found |
| 500  | ❌ Server error |

## Ride Statuses

```
SEARCHING ─────────→ DRIVER_ASSIGNED ─────────→ DRIVER_ARRIVING
                                                       ↓
                    CANCELLED ←─────────────────── IN_PROGRESS
                                                       ↓
                                                  COMPLETED
```

## Environment Variables

Edit `.env` to customize:

```bash
PORT=3009                          # Service port
LOG_LEVEL=info                     # Logging level
NOTIFICATION_SERVICE_URL=http://... # Other services
PAYMENT_SERVICE_URL=http://...
AVG_DRIVER_SPEED=30               # km/h for ETA calc
```

## Next Steps

1. ✅ Verify service works with Quick Start
2. 📖 Read [API Documentation](./README.md)
3. 🏗️ Review [Architecture](./ARCHITECTURE.md)
4. 🔗 Integrate with other services using [Integration Guide](./INTEGRATION.md)
5. 🐳 Deploy using [Docker](#docker-setup)

## Docker Setup

```bash
# Build image
docker build -t ride-service:latest .

# Run container
docker run -p 3009:3009 \
  -e PORT=3009 \
  -e LOG_LEVEL=info \
  ride-service:latest

# Or use docker-compose
docker-compose up ride-service
```

## Troubleshooting

**Port already in use:**
```bash
# Find what's using port 3009
lsof -i :3009
# Kill the process
kill -9 <PID>
```

**Module not found:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**WebSocket connection refused:**
- Verify service is running: `curl http://localhost:3009/health`
- Check firewall isn't blocking port 3009
- WebSocket URL should be `ws://localhost:3009` (not `http://`)

## Support

- 📖 See [README.md](./README.md) for API details
- 🏗️ See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- 🔗 See [INTEGRATION.md](./INTEGRATION.md) for integration examples
