# Ride Service - Architecture Document

## Overview

The Ride Service is a critical component of the CAB booking system responsible for managing the entire ride lifecycle, from creation through completion or cancellation. It provides real-time GPS tracking capabilities and maintains ride state throughout the journey.

## Architecture

### Service Context

```
┌──────────────────────────────────────────────────────────────────┐
│                      CAB Booking System                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ Booking Service│  │ Driver Service │  │ User Service   │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│           │                 │                     │              │
│           └─────────────────┼─────────────────────┘              │
│                             │                                  │
│           ┌─────────────────▼─────────────────┐              │
│           │     API Gateway (Router)           │              │
│           └─────────────────┬─────────────────┘              │
│                             │                                  │
│           ┌─────────────────▼──────────────────┐             │
│           │    🚖 RIDE SERVICE (THIS)           │             │
│           │  ├─ REST API Endpoints              │             │
│           │  ├─ WebSocket Real-time Tracking   │             │
│           │  ├─ Ride State Management          │             │
│           │  └─ Event Publishing                │             │
│           └─────────────────┬──────────────────┘             │
│                             │                                  │
│           ┌─────────────────┼─────────────────┐              │
│           │                 │                 │                │
│  ┌────────▼────────┐  ┌─────▼──────────┐  ┌──▼──────────────┐ │
│  │Notification Svc │  │Payment Service│  │ Review Service  │ │
│  └─────────────────┘  └────────────────┘  └─────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Ride Lifecycle Management

The service manages rides through a well-defined state machine:

```
SEARCHING
    ↓
DRIVER_ASSIGNED
    ↓
DRIVER_ARRIVING
    ↓
IN_PROGRESS
    ↓
COMPLETED (success) or CANCELLED (failure)
```

**Transitions:**
- `SEARCHING` → `DRIVER_ASSIGNED`: When driver accepts/is assigned
- `DRIVER_ASSIGNED` → `DRIVER_ARRIVING`: When driver begins journey
- `DRIVER_ARRIVING` → `IN_PROGRESS`: When pickup happens
- `IN_PROGRESS` → `COMPLETED`: When destination reached
- Any state → `CANCELLED`: User or driver cancellation

### 2. Real-time GPS Tracking

#### WebSocket Integration
- Bidirectional real-time communication channel
- Drivers send GPS coordinates as they update
- Clients (web/mobile) receive live location updates
- Broadcast to all connected clients for multi-passenger scenarios

#### Location Update Flow
```
Driver App (GPS enabled)
    ↓
WebSocket Message: { type: 'driver_location', ... }
    ↓
Ride Service (Updates in-memory storage)
    ↓
Broadcast to all connected clients
    ↓
Publish event to message broker
    ↓
Customer receives real-time location
```

### 3. ETA Calculation

The service automatically calculates estimated time of arrival using:
- **Haversine formula** for great-circle distance between coordinates
- **Average speed** assumption (configurable, default 30 km/h)
- **Recalculation** on each location update

Formula:
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
distance = R × c  (where R = 6371 km)
etaMinutes = ceil((distance / avgSpeed) × 60)
```

## Data Model

### Ride Document

```javascript
{
  rideId: UUID,
  bookingId: UUID,              // Link to booking
  userId: UUID,                 // Customer ID
  driverId: UUID,               // Assigned driver

  status: RIDE_STATUS,          // Current state

  pickup: {
    lat: Number,
    lng: Number,
    address: String
  },

  destination: {
    lat: Number,
    lng: Number,
    address: String
  },

  currentLocation: {            // Updated via WebSocket
    lat: Number,
    lng: Number,
    address: String (optional)
  },

  etaMinutes: Number,           // Calculated at each update

  startedAt: ISO8601,           // When ride started (picked up customer)
  completedAt: ISO8601,         // When ride ended
  updatedAt: ISO8601            // Last status/location update
}
```

## API Contract

### Request/Response Format

All responses follow a consistent envelope:

```javascript
{
  success: Boolean,
  message: String,
  data: Object | Array,
  meta: {
    requestId: UUID,
    correlationId: UUID,
    timestamp: ISO8601
  }
}
```

### Error Handling

| Status | Scenario |
|--------|----------|
| 201 | Ride created |
| 200 | Operation successful |
| 400 | Invalid input (missing fields) |
| 403 | Forbidden (wrong driver/user) |
| 404 | Ride not found |
| 500 | Server error |

## Event-Driven Architecture

### Published Events

The service publishes events for other services to consume:

```
Event: ride.created
├─ When: Booking service creates ride
├─ Payload: { rideId, bookingId, userId, pickup, destination }
└─ Consumers: Driver matching service, notification service

Event: ride.driver_assigned
├─ When: Driver accepted/assigned to ride
├─ Payload: { rideId, driverId }
└─ Consumers: Driver service, notification service

Event: ride.started
├─ When: Driver picks up customer
├─ Payload: { rideId, driverId, userId, startedAt }
└─ Consumers: Notification service, pricing service

Event: driver.location.updated
├─ When: Driver sends new GPS coordinate
├─ Payload: { rideId, driverId, location }
└─ Consumers: Real-time tracking (WebSocket broadcast)

Event: ride.completed
├─ When: Ride completes
├─ Payload: { rideId, driverId, userId, completedAt, duration }
└─ Consumers: Payment service, review service, rating service

Event: ride.cancelled
├─ When: Ride cancelled
├─ Payload: { rideId, userId, driverId, reason }
└─ Consumers: Booking service, driver service, notification service
```

## Integration Points

### 1. API Gateway
- Routes requests to ride service
- Handles authentication/authorization
- Rate limiting and throttling

### 2. Booking Service
- Triggers ride creation on successful booking
- Cancels ride if booking is modified

### 3. Driver Service
- Validates driver existence
- Provides driver availability
- Tracks driver location (alternative to WebSocket)

### 4. Notification Service
- Subscribes to ride events
- Sends real-time notifications to users and drivers
- Email/SMS for ride completion

### 5. Payment Service
- Listens to `ride.completed` events
- Calculates fare and processes payment
- Updates billing records

Accepts location updates from ride service

### 6. Review Service
- Listens to `ride.completed` events
- Enables customer review/rating submission

## Storage Strategy

### Current (Development)
- **In-memory Map**: Fast, suitable for testing
- **Limitations**: Data lost on restart, not scalable

### Recommended (Production)
- **MongoDB**: Flexible schema, good for ride documents
- **Redis**: Cache active rides, subsecond lookups
- **Elasticsearch**: Historical ride analytics

### Migration Path
```javascript
// Replace:
rides.set(rideId, rideData);

// With:
await Ride.create(rideData);
```

## WebSocket Implementation

### Connection Lifecycle

```
1. Client connects: ws://ride-service:3009
2. Client sends: { type: 'driver_register', driverId: '...' }
3. Service stores connection reference
4. Client sends location updates
5. Service broadcasts to all subscribers
6. Client disconnects → cleanup connection
```

### Message Types

**Incoming:**
- `driver_register`: Register driver connection
- `driver_location`: Send GPS update

**Outgoing:**
- `ride_update`: Broadcast ride status/location change

## Scalability Considerations

### Current Bottlenecks
1. **In-memory storage**: Limited to single instance
2. **WebSocket connections**: Horizontal scaling requires pub/sub
3. **No persistence**: Data loss on restart

### Horizontal Scaling Strategy

```
┌────────────┐  ┌────────────────┐
│ Ride Svc 1 │  │ Redis Adapter  │
├────────────┤  ├────────────────┤
│ WebSocket  │  │ Shared cache   │
│ Handler    │──│ + PubSub       │
└────────────┘  └────────────────┘
                       │
┌────────────┐         │         ┌────────────┐
│ Ride Svc 2 │─────────┼─────────│ Ride Svc N │
├────────────┤         │         ├────────────┤
│ WebSocket  │         │         │ WebSocket  │
│ Handler    │         │         │ Handler    │
└────────────┘         │         └────────────┘
                       │
                ┌──────▼───────┐
                │  Message Bus │
                │  (Kafka/AMQP)│
                └───────────────┘
```

## Performance Optimization

### Caching Strategy
```javascript
// Cache frequently accessed rides
const rideCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

// Auto-invalidate on updates
this.cache.delete(rideId);
```

### Connection Pooling
```javascript
// Pool WebSocket connections by ride ID
const rideSubscribers = new Map(); // rideId → Set<WebSocket>
```

### Batch Operations
```javascript
// Group location updates
const updateBatch = [];
// Send in batch to database
```

## Testing Strategy

### Unit Tests
- Ride state transitions
- ETA calculations
- Payload validation

### Integration Tests
- REST API endpoints
- WebSocket messaging
- Event publishing

### Load Tests
- 1000+ concurrent WebSocket connections
- Real-time location updates under load
- Database query performance

## Deployment

### Docker
```bash
docker build -t ride-service:latest .
docker run -p 3009:3009 \
  -e PORT=3009 \
  -e LOG_LEVEL=info \
  ride-service:latest
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ride-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ride-service
  template:
    metadata:
      labels:
        app: ride-service
    spec:
      containers:
      - name: ride-service
        image: ride-service:latest
        ports:
        - containerPort: 3009
        livenessProbe:
          httpGet:
            path: /health
            port: 3009
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Monitoring & Logging

### Key Metrics
- Active rides
- WebSocket connections
- Location updates/sec
- Average ETA error
- API response times
- Event publish latency

### Logging
```javascript
// Structure logs
{
  timestamp: ISO8601,
  level: 'info|warn|error|debug',
  service: 'ride-service',
  rideId: UUID,
  driverId: UUID,
  action: 'ride.created|ride.started|...',
  duration: ms,
  error: String
}
```

## Future Enhancements

1. **Database Persistence**: MongoDB integration
2. **Caching Layer**: Redis for performance
3. **Message Queue**: RabbitMQ/Kafka for event streaming
4. **Route Optimization**: Real route instead of distance
5. **Multi-leg Rides**: Support ride sharing
6. **Surge Pricing Integration**: Dynamic pricing
7. **Advanced Analytics**: ML-based ETA improvement
8. **Fraud Detection**: Anomaly detection for rides
