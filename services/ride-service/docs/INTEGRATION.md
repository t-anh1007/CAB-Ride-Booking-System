# Ride Service - Integration Guide

This guide shows how to integrate and use the Ride Service from other applications.

## Quick Start

### 1. Start the Service

```bash
# Install dependencies
npm install

# Start service
npm start
# Service runs on http://localhost:3009
```

### 2. Verify Service is Running

```bash
curl http://localhost:3009/health
```

Response:
```json
{
  "success": true,
  "service": "ride-service",
  "status": "ok",
  "timestamp": "2026-04-08T10:15:30Z"
}
```

## REST API Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3009/api/v1';

// Create a ride
async function createRide() {
  const response = await axios.post(`${API_URL}/rides`, {
    bookingId: 'booking-123',
    userId: 'user-456',
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
  });

  return response.data.data.rideId;
}

// Get ride details
async function getRide(rideId) {
  const response = await axios.get(`${API_URL}/rides/${rideId}`);
  return response.data.data;
}

// Assign driver
async function assignDriver(rideId, driverId) {
  const response = await axios.post(
    `${API_URL}/rides/${rideId}/assign-driver`,
    { driverId }
  );
  return response.data;
}

// Update driver location
async function updateDriverLocation(rideId, driverId, lat, lng) {
  const response = await axios.post(
    `${API_URL}/rides/${rideId}/location`,
    {
      driverId,
      currentLocation: {
        lat,
        lng,
        address: '',
      },
    }
  );
  return response.data;
}

// Complete ride
async function completeRide(rideId, driverId) {
  const response = await axios.post(
    `${API_URL}/rides/${rideId}/complete`,
    { driverId }
  );
  return response.data;
}
```

### Python

```python
import requests
import json

API_URL = 'http://localhost:3009/api/v1'

def create_ride(booking_id, user_id, pickup, destination):
    response = requests.post(
        f'{API_URL}/rides',
        json={
            'bookingId': booking_id,
            'userId': user_id,
            'pickup': pickup,
            'destination': destination,
        }
    )
    return response.json()

def get_ride(ride_id):
    response = requests.get(f'{API_URL}/rides/{ride_id}')
    return response.json()

def assign_driver(ride_id, driver_id):
    response = requests.post(
        f'{API_URL}/rides/{ride_id}/assign-driver',
        json={'driverId': driver_id}
    )
    return response.json()

def update_location(ride_id, driver_id, lat, lng):
    response = requests.post(
        f'{API_URL}/rides/{ride_id}/location',
        json={
            'driverId': driver_id,
            'currentLocation': {
                'lat': lat,
                'lng': lng,
            }
        }
    )
    return response.json()
```

## WebSocket Real-time Tracking

### JavaScript Client (Web)

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3009');

// When connected
ws.addEventListener('open', () => {
  console.log('Connected to Ride Service');

  // Subscribe to ride updates
  ws.send(JSON.stringify({
    type: 'ride_subscribe',
    rideId: 'ride-123',
  }));
});

// Receive real-time updates
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'ride_update') {
    const { rideId, data } = message;
    console.log('Ride updated:', {
      status: data.status,
      location: data.currentLocation,
      eta: data.etaMinutes,
      updatedAt: data.updatedAt,
    });

    // Update UI with new location
    updateMapMarker(data.currentLocation);
    updateETADisplay(data.etaMinutes);
  }
});

// Handle disconnection
ws.addEventListener('close', () => {
  console.log('Disconnected from Ride Service');
});
```

### Driver App (Sending Location)

```javascript
const ws = new WebSocket('ws://localhost:3009');

ws.addEventListener('open', () => {
  // Register as driver
  ws.send(JSON.stringify({
    type: 'driver_register',
    driverId: 'driver-456',
  }));

  // Start sending GPS updates
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
      ws.send(JSON.stringify({
        type: 'driver_location',
        rideId: 'ride-123',
        driverId: 'driver-456',
        currentLocation: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: '',
        },
      }));
    }, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });
  }
});
```

## Booking Service Integration

```javascript
// In booking-service/index.js
const axios = require('axios');

const RIDE_SERVICE_URL = 'http://ride-service:3009/api/v1';

// When a booking is confirmed
async function handleBookingConfirmed(booking) {
  try {
    const rideResponse = await axios.post(
      `${RIDE_SERVICE_URL}/rides`,
      {
        bookingId: booking.id,
        userId: booking.userId,
        pickup: booking.pickup,
        destination: booking.destination,
      }
    );

    const rideId = rideResponse.data.data.rideId;

    // Save ride ID to booking
    await updateBookingWithRideId(booking.id, rideId);

    console.log(`Ride created: ${rideId} for booking ${booking.id}`);
  } catch (error) {
    console.error('Failed to create ride:', error.message);
    throw error;
  }
}
```

## Driver Service Integration

```javascript
// In driver-service/index.js
const axios = require('axios');

const RIDE_SERVICE_URL = 'http://ride-service:3009/api/v1';

// When driver accepts a ride
async function acceptRide(driverId, rideId) {
  try {
    const response = await axios.post(
      `${RIDE_SERVICE_URL}/rides/${rideId}/assign-driver`,
      { driverId }
    );

    console.log(`Driver ${driverId} assigned to ride ${rideId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to assign driver:', error.message);
    throw error;
  }
}

// When driver starts the ride
async function startRide(rideId, driverId) {
  try {
    const response = await axios.post(
      `${RIDE_SERVICE_URL}/rides/${rideId}/start`,
      { driverId }
    );

    console.log(`Ride ${rideId} started by driver ${driverId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to start ride:', error.message);
    throw error;
  }
}
```

## Event Handling

### Subscribe to Ride Events

```javascript
// In notification-service/index.js
const amqp = require('amqplib');

async function subscribeToRideEvents() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Create queue for ride events
  await channel.assertQueue('ride-events');

  // Subscribe to messages
  await channel.consume('ride-events', (msg) => {
    const event = JSON.parse(msg.content.toString());

    switch (event.eventType) {
      case 'ride.created':
        handleRideCreated(event.payload);
        break;
      case 'ride.driver_assigned':
        handleDriverAssigned(event.payload);
        break;
      case 'ride.started':
        handleRideStarted(event.payload);
        break;
      case 'ride.completed':
        handleRideCompleted(event.payload);
        break;
      case 'ride.cancelled':
        handleRideCancelled(event.payload);
        break;
    }

    channel.ack(msg);
  });
}

// Handle ride created event
async function handleRideCreated(payload) {
  const { rideId, userId, pickup, destination } = payload;

  // Send notification to customer
  await notifyUser(userId, {
    title: 'Ride Confirmed',
    message: 'Your ride has been created. Waiting for driver acceptance.',
  });
}

// Handle driver assigned event
async function handleDriverAssigned(payload) {
  const { rideId, driverId } = payload;

  // Get ride details
  const ride = await getRideDetails(rideId);

  // Notify customer that driver is coming
  await notifyUser(ride.userId, {
    title: 'Driver on the way',
    message: `Driver ${driverId} is on the way to pick you up.`,
  });
}

// Handle ride completed event
async function handleRideCompleted(payload) {
  const { rideId, userId, completedAt } = payload;

  // Send notification to customer
  await notifyUser(userId, {
    title: 'Ride Completed',
    message: 'Thank you for riding with us. Please leave a review.',
  });

  // Trigger payment processing
  await triggerPaymentProcessing(rideId);
}
```

## Testing

### Run Test Suite

```bash
# Terminal 1: Start the service
npm start

# Terminal 2: Run tests
npm test
```

### Manual Testing with curl

```bash
# Create a ride
curl -X POST http://localhost:3009/api/v1/rides \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking-123",
    "userId": "user-456",
    "pickup": {"lat": 10.762622, "lng": 106.660172, "address": "Quận 1"},
    "destination": {"lat": 10.776889, "lng": 106.700806, "address": "Bình Thạnh"}
  }'

# Get ride (replace RIDE_ID with actual ID)
curl http://localhost:3009/api/v1/rides/RIDE_ID

# Assign driver
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/assign-driver \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-789"}'

# Update location
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/location \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-789",
    "currentLocation": {"lat": 10.765, "lng": 106.665}
  }'

# Start ride
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/start \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-789"}'

# Complete ride
curl -X POST http://localhost:3009/api/v1/rides/RIDE_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-789"}'
```

## Docker Compose Integration

Add to `docker-compose.yml`:

```yaml
ride-service:
  build:
    context: ./services/ride-service
    dockerfile: Dockerfile
  container_name: ride-service
  ports:
    - "3009:3009"
  environment:
    - PORT=3009
    - LOG_LEVEL=info
    - NOTIFICATION_SERVICE_URL=http://notification-service:3010
    - PAYMENT_SERVICE_URL=http://payment-service:3012
  depends_on:
    - api-gateway
  networks:
    - cab-network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3009/health"]
    interval: 30s
    timeout: 3s
    retries: 3
```

## Performance Tips

1. **WebSocket Connections**: Use connection pooling
2. **Database Queries**: Add indexes on `userId` and `driverId`
3. **Redis Cache**: Cache active rides for quick lookups
4. **Message Queue**: Use async event processing
5. **Monitoring**: Set up metrics collection

## Troubleshooting

### Service won't start
```bash
# Check if port 3009 is already in use
lsof -i :3009

# Check logs
npm start 2>&1 | tee logs.txt
```

### WebSocket connection fails
- Ensure WebSocket URL is correct: `ws://localhost:3009`
- Check firewall settings
- Verify service is running: `curl http://localhost:3009/health`

### Location updates not working
- Verify driver is registered: Check WebSocket console logs
- Enable high accuracy GPS on mobile device
- Check location permissions in browser/app

## Support

For issues or questions, refer to:
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./README.md)
- Service logs: Check console output
