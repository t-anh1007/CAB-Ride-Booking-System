# Ride Service - API Specification

## Overview

The Ride Service provides RESTful APIs and WebSocket support for managing ride lifecycle, real-time GPS tracking, and ride status updates.

**Base URL:** `http://localhost:3009`
**WebSocket URL:** `ws://localhost:3009`

## Response Format

All responses follow a consistent envelope format:

```json
{
  "success": true/false,
  "message": "Description of the operation",
  "data": {},
  "meta": {
    "requestId": "uuid",
    "correlationId": "uuid",
    "timestamp": "2026-04-08T10:15:30Z"
  }
}
```

## Data Types

### Coordinates
```typescript
{
  lat: number,        // Latitude (-90 to 90)
  lng: number,        // Longitude (-180 to 180)
  address?: string    // Optional address string
}
```

### Ride
```typescript
{
  rideId: string,
  bookingId: string,
  userId: string,
  driverId: string | null,
  status: RideStatus,
  pickup: Coordinates,
  destination: Coordinates,
  currentLocation: Coordinates | null,
  etaMinutes: number | null,
  startedAt: string (ISO8601) | null,
  completedAt: string (ISO8601) | null,
  updatedAt: string (ISO8601)
}
```

### RideStatus
```typescript
enum RideStatus {
  SEARCHING = "SEARCHING",
  DRIVER_ASSIGNED = "DRIVER_ASSIGNED",
  DRIVER_ARRIVING = "DRIVER_ARRIVING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}
```

## Health Check

### GET /health

Get service health status.

**Response (200):**
```json
{
  "success": true,
  "service": "ride-service",
  "status": "ok",
  "timestamp": "2026-04-08T10:15:30Z"
}
```

---

## Ride Endpoints

### POST /api/v1/rides

Create a new ride.

**Request:**
```json
{
  "bookingId": "string (uuid)",
  "userId": "string (uuid)",
  "driverId": "string (uuid, optional)",
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

**Validation Rules:**
- `bookingId`: Required, must be valid UUID
- `userId`: Required, must be valid UUID
- `driverId`: Optional, must be valid UUID if provided
- `pickup`: Required, must have `lat` and `lng`
- `destination`: Required, must have `lat` and `lng`

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
    "updatedAt": "2026-04-08T10:15:30Z"
  },
  "meta": {...}
}
```

**Error Responses:**
- 400: Missing required fields
- 500: Server error

---

### GET /api/v1/rides/:rideId

Retrieve a specific ride.

**Path Parameters:**
- `rideId`: string (uuid) - The ride ID

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
      "address": "En route"
    },
    "etaMinutes": 5,
    "startedAt": null,
    "completedAt": null,
    "updatedAt": "2026-04-08T10:15:35Z"
  },
  "meta": {...}
}
```

**Error Responses:**
- 404: Ride not found
- 500: Server error

---

### GET /api/v1/users/:userId/rides

Retrieve all rides for a user.

**Path Parameters:**
- `userId`: string (uuid) - The user ID

**Query Parameters:**
- `status`: string (optional) - Filter by ride status (SEARCHING, COMPLETED, etc.)
- `limit`: number (optional) - Maximum results (default: 50)
- `offset`: number (optional) - Pagination offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "message": "User rides fetched",
  "data": [
    {
      "rideId": "uuid",
      ...
    },
    {
      "rideId": "uuid",
      ...
    }
  ],
  "meta": {...}
}
```

**Error Responses:**
- 500: Server error

---

### POST /api/v1/rides/:rideId/assign-driver

Assign a driver to a ride.

**Path Parameters:**
- `rideId`: string (uuid) - The ride ID

**Request:**
```json
{
  "driverId": "string (uuid)"
}
```

**Validation Rules:**
- `driverId`: Required, must be valid UUID
- Ride must exist
- Ride status must be SEARCHING or DRIVER_ASSIGNED

**Response (200):**
```json
{
  "success": true,
  "message": "Driver assigned to ride",
  "data": {
    "rideId": "uuid",
    "status": "DRIVER_ASSIGNED",
    "driverId": "uuid",
    ...
  },
  "meta": {...}
}
```

**Events Published:**
- `ride.driver_assigned`: { rideId, driverId }

**Error Responses:**
- 400: Missing driverId
- 404: Ride not found
- 500: Server error

---

### POST /api/v1/rides/:rideId/start

Start a ride (driver picks up customer).

**Path Parameters:**
- `rideId`: string (uuid) - The ride ID

**Request:**
```json
{
  "driverId": "string (uuid)"
}
```

**Validation Rules:**
- `driverId`: Required
- Ride must exist
- Ride `driverId` must match provided `driverId`
- Ride status must be DRIVER_ASSIGNED or DRIVER_ARRIVING

**Response (200):**
```json
{
  "success": true,
  "message": "Ride started",
  "data": {
    "rideId": "uuid",
    "status": "IN_PROGRESS",
    "startedAt": "2026-04-08T10:15:40Z",
    ...
  },
  "meta": {...}
}
```

**Events Published:**
- `ride.started`: { rideId, driverId, userId, startedAt }

**Error Responses:**
- 403: Driver ID mismatch
- 404: Ride not found
- 500: Server error

---

### POST /api/v1/rides/:rideId/complete

Complete a ride (destination reached).

**Path Parameters:**
- `rideId`: string (uuid) - The ride ID

**Request:**
```json
{
  "driverId": "string (uuid)"
}
```

**Validation Rules:**
- `driverId`: Required
- Ride must exist
- Ride `driverId` must match provided `driverId`
- Ride status must be IN_PROGRESS

**Response (200):**
```json
{
  "success": true,
  "message": "Ride completed",
  "data": {
    "rideId": "uuid",
    "status": "COMPLETED",
    "completedAt": "2026-04-08T10:20:30Z",
    ...
  },
  "meta": {...}
}
```

**Events Published:**
- `ride.completed`: { rideId, driverId, userId, completedAt }

**Error Responses:**
- 403: Driver ID mismatch
- 404: Ride not found
- 500: Server error

---

### POST /api/v1/rides/:rideId/cancel

Cancel a ride.

**Path Parameters:**
- `rideId`: string (uuid) - The ride ID

**Request:**
```json
{
  "userId": "string (uuid, optional)",
  "driverId": "string (uuid, optional)",
  "reason": "string (optional)"
}
```

**Authorization Rules:**
- At least one of `userId` or `driverId` must be provided
- Provided ID must match the ride's userId or driverId
- Either user or driver can initiate cancellation

**Validation Rules:**
- Ride must exist
- Ride must not already be COMPLETED or CANCELLED

**Response (200):**
```json
{
  "success": true,
  "message": "Ride cancelled",
  "data": {
    "rideId": "uuid",
    "status": "CANCELLED",
    ...
  },
  "meta": {...}
}
```

**Events Published:**
- `ride.cancelled`: { rideId, userId, driverId, reason }

**Error Responses:**
- 400: Missing userId or driverId
- 403: Unauthorized (ID doesn't match)
- 404: Ride not found
- 500: Server error

---

### POST /api/v1/rides/:rideId/location

Update driver's current location.

**Path Parameters:**
- `rideId`: string (uuid) - The ride ID

**Request:**
```json
{
  "driverId": "string (uuid)",
  "currentLocation": {
    "lat": 10.765,
    "lng": 106.665,
    "address": "Current street address (optional)"
  }
}
```

**Validation Rules:**
- `driverId`: Required
- `currentLocation`: Required, must have `lat` and `lng`
- Latitude: -90 to 90
- Longitude: -180 to 180
- Ride must exist
- Ride `driverId` must match provided `driverId`

**Response (200):**
```json
{
  "success": true,
  "message": "Location updated",
  "data": {
    "rideId": "uuid",
    "currentLocation": {
      "lat": 10.765,
      "lng": 106.665,
      "address": ""
    },
    "etaMinutes": 5,
    "updatedAt": "2026-04-08T10:15:45Z",
    ...
  },
  "meta": {...}
}
```

**Calculation:**
- ETA is automatically recalculated using Haversine formula
- ETA assumes average speed of 30 km/h (configurable)
- Minimum ETA: 1 minute

**Events Published:**
- `driver.location.updated`: { rideId, driverId, location }

**WebSocket Broadcast:**
- All connected clients receive: `{ type: 'ride_update', rideId, data }`

**Error Responses:**
- 400: Invalid location or missing fields
- 403: Driver ID mismatch
- 404: Ride not found
- 500: Server error

---

## WebSocket API

### Connection

```
ws://localhost:3009
```

### Messages

#### Driver Registration
**Send (Client → Server):**
```json
{
  "type": "driver_register",
  "driverId": "uuid"
}
```

**Purpose:** Register device as a driver to enable location tracking

---

#### Driver Location Update
**Send (Client → Server):**
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

**Purpose:** Send real-time GPS update for active ride

**Trigger:**
- `ride_update` broadcast to all connected clients

---

#### Ride Update Broadcast
**Receive (Server → Client):**
```json
{
  "type": "ride_update",
  "rideId": "uuid",
  "data": {
    "rideId": "uuid",
    "status": "DRIVER_ARRIVING",
    "currentLocation": {
      "lat": 10.765,
      "lng": 106.665
    },
    "etaMinutes": 5,
    "updatedAt": "2026-04-08T10:15:45Z",
    ...
  }
}
```

**Purpose:** Real-time ride status and location update for all subscribers

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid input, missing required fields |
| 403 | Forbidden | Unauthorized (wrong driver/user) |
| 404 | Not Found | Ride does not exist |
| 500 | Server Error | Internal server error |

## Rate Limiting

Currently not enforced. Recommended limits for production:

| Endpoint | Limit |
|----------|-------|
| Create Ride | 100/minute per user |
| Update Location | 1000/minute per driver |
| Get Ride | 500/minute per user |

## Pagination

For endpoints returning multiple results:

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `limit` | number | 50 | 200 |
| `offset` | number | 0 | N/A |

---

## Examples

### Complete Ride Lifecycle

```bash
# 1. Create ride
curl -X POST http://localhost:3009/api/v1/rides \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking-1",
    "userId": "user-1",
    "pickup": {"lat": 10.7, "lng": 106.6, "address": "Start"},
    "destination": {"lat": 10.8, "lng": 106.7, "address": "End"}
  }'

# 2. Assign driver
curl -X POST http://localhost:3009/api/v1/rides/{rideId}/assign-driver \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-1"}'

# 3. Update location (multiple times)
curl -X POST http://localhost:3009/api/v1/rides/{rideId}/location \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-1",
    "currentLocation": {"lat": 10.75, "lng": 106.65}
  }'

# 4. Start ride
curl -X POST http://localhost:3009/api/v1/rides/{rideId}/start \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-1"}'

# 5. Complete ride
curl -X POST http://localhost:3009/api/v1/rides/{rideId}/complete \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver-1"}'
```

---

## Fields Reference

### Ride Fields

| Field | Type | Mutable | Description |
|-------|------|---------|-------------|
| rideId | UUID | ✗ | Unique identifier |
| bookingId | UUID | ✗ | Link to booking |
| userId | UUID | ✗ | Customer ID |
| driverId | UUID | ✓ | Assigned driver |
| status | Enum | ✓ | Current status |
| pickup | Object | ✗ | Pickup coordinates |
| destination | Object | ✗ | Destination coordinates |
| currentLocation | Object | ✓ | Current GPS location |
| etaMinutes | Number | ✓ | Calculated ETA |
| startedAt | ISO8601 | ✓ | Start timestamp |
| completedAt | ISO8601 | ✓ | Completion timestamp |
| updatedAt | ISO8601 | ✓ | Last update timestamp |

---

## Best Practices

1. **Always include request/correlation IDs** for tracing
2. **Use WebSocket for real-time updates** instead of polling
3. **Validate coordinates** before sending location updates
4. **Handle connection drops** gracefully in WebSocket clients
5. **Implement exponential backoff** for retries
6. **Cache ride data** client-side to reduce API calls
7. **Monitor ETA accuracy** and adjust speed assumptions

---

## Versioning

Current API Version: **v1**

Future versions may be available at:
- `/api/v2/rides`
- `/api/v3/rides`

---

## Support

For issues or questions:
- Check [README.md](./README.md) for overview
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
- See [INTEGRATION.md](./INTEGRATION.md) for integration examples
- Run [test.js](./test.js) for verification
