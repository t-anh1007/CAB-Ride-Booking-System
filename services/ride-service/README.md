# Ride Service

The Ride Service manages ride lifecycle, real-time GPS tracking, and ride status updates for the CAB booking system.

## Features

- **Ride Management**: Create, retrieve, update, and cancel rides
- **Real-time GPS Tracking**: WebSocket-based driver location updates
- **Ride Status Management**: Track ride through SEARCHING → DRIVER_ASSIGNED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED/CANCELLED
- **Event Publishing**: Publishes events for integration with other services
- **ETA Calculation**: Automatically calculates estimated arrival time based on driver location

## Ride Statuses

- `SEARCHING`: Ride created, waiting for driver assignment
- `DRIVER_ASSIGNED`: Driver has been assigned to the ride
- `DRIVER_ARRIVING`: Driver is on the way to pickup location
- `IN_PROGRESS`: Ride has started, driver is heading to destination
- `COMPLETED`: Ride completed successfully
- `CANCELLED`: Ride was cancelled

## API Endpoints

### 1. Create Ride
**POST** `/api/v1/rides`

Creates a new ride request.

**Request Body:**
```json
{
  "bookingId": "uuid",
  "userId": "uuid",
  "driverId": "uuid (optional)",
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
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Ride created",
  "data": {
    "rideId": "uuid",
    "bookingId": "uuid",
    "userId": "uuid",
    "driverId": null,
    "status": "SEARCHING",
    "pickup": {...},
    "destination": {...},
    "currentLocation": null,
    "etaMinutes": null,
    "startedAt": null,
    "completedAt": null,
    "updatedAt": "2026-04-07T10:15:30Z"
  },
  "meta": {
    "requestId": "uuid",
    "correlationId": "uuid",
    "timestamp": "2026-04-07T10:15:30Z"
  }
}
```

### 2. Get Ride
**GET** `/api/v1/rides/:rideId`

Retrieves details of a specific ride.

**Response (200):**
```json
{
  "success": true,
  "message": "Ride fetched",
  "data": {
    "rideId": "uuid",
    "bookingId": "uuid",
    "userId": "uuid",
    "driverId": "uuid",
    "status": "DRIVER_ARRIVING",
    "pickup": {...},
    "destination": {...},
    "currentLocation": {
      "lat": 10.765,
      "lng": 106.665,
      "address": ""
    },
    "etaMinutes": 5,
    "startedAt": null,
    "completedAt": null,
    "updatedAt": "2026-04-07T10:15:30Z"
  },
  "meta": {...}
}
```

### 3. Assign Driver
**POST** `/api/v1/rides/:rideId/assign-driver`

Assigns a driver to the ride.

**Request Body:**
```json
{
  "driverId": "uuid"
}
```

**Response (200):**
Status changes to `DRIVER_ASSIGNED`

### 4. Start Ride
**POST** `/api/v1/rides/:rideId/start`

Marks the ride as started (in progress).

**Request Body:**
```json
{
  "driverId": "uuid"
}
```

**Response (200):**
Status changes to `IN_PROGRESS`, `startedAt` timestamp is set.

### 5. Complete Ride
**POST** `/api/v1/rides/:rideId/complete`

Marks the ride as completed.

**Request Body:**
```json
{
  "driverId": "uuid"
}
```

**Response (200):**
Status changes to `COMPLETED`, `completedAt` timestamp is set.

### 6. Cancel Ride
**POST** `/api/v1/rides/:rideId/cancel`

Cancels the ride (can be initiated by customer or driver).

**Request Body:**
```json
{
  "userId": "uuid (optional)",
  "driverId": "uuid (optional)",
  "reason": "string (optional)"
}
```

**Response (200):**
Status changes to `CANCELLED`.

### 7. Update Location
**POST** `/api/v1/rides/:rideId/location`

Updates driver's current location (REST endpoint, primarily for testing).

**Request Body:**
```json
{
  "driverId": "uuid",
  "currentLocation": {
    "lat": 10.765,
    "lng": 106.665,
    "address": ""
  }
}
```

**Response (200):**
Location is updated, ETA is recalculated.

### 8. Get User Rides
**GET** `/api/v1/users/:userId/rides`

Retrieves all rides for a specific user.

**Response (200):**
```json
{
  "success": true,
  "message": "User rides fetched",
  "data": [
    {
      "rideId": "uuid",
      ...
    }
  ],
  "meta": {...}
}
```

## WebSocket Real-time GPS Updates

The service includes WebSocket support for real-time GPS tracking without polling.

### Connection
```
ws://localhost:3009
```

### Register Driver
After connecting, drivers should register themselves:
```json
{
  "type": "driver_register",
  "driverId": "uuid"
}
```

### Send Location Update
Drivers send location updates:
```json
{
  "type": "driver_location",
  "rideId": "uuid",
  "driverId": "uuid",
  "currentLocation": {
    "lat": 10.765,
    "lng": 106.665,
    "address": ""
  }
}
```

### Receive Ride Updates
Clients receive real-time ride updates:
```json
{
  "type": "ride_update",
  "rideId": "uuid",
  "data": {
    "rideId": "uuid",
    "status": "DRIVER_ARRIVING",
    "currentLocation": {...},
    "etaMinutes": 5,
    ...
  }
}
```

## Events Published

The service publishes the following events (for message broker integration):

- `ride.created`: Ride has been created
- `ride.driver_assigned`: Driver has been assigned to ride
- `ride.started`: Ride has been started
- `ride.completed`: Ride has been completed
- `ride.cancelled`: Ride has been cancelled
- `driver.location.updated`: Driver location has been updated

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the service:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

The service will start on port 3009 (or `PORT` environment variable).

## Database Integration

Currently, the service uses in-memory storage. For production, integrate with a database:

```javascript
// Replace in-memory storage with database queries
const rideData = await Ride.findById(rideId);
await Ride.updateOne({ _id: rideId }, updatedData);
```

## Message Broker Integration

To publish events to other services, integrate with a message broker (RabbitMQ, Kafka, etc.):

```javascript
// Replace console.log in publishEvent() with:
await messageQueue.publish('rides-topic', event);
```

## Integration with Other Services

- **Booking Service**: Listens to `ride.created` events
- **Notification Service**: Listens to ride status changes to notify users
- **Driver Service**: Provides driver information for ride assignment
- **Payment Service**: Listens to `ride.completed` to process payments
