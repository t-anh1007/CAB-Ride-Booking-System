# WebSocket (Real-time)

## 1. Use cases
- Driver GPS update
- Ride tracking
- Matching update

## 2. Connection flow

Client → Gateway (WS handshake + JWT)

## 3. Driver flow

Driver → WS → Gateway → Ride Service → Redis → Kafka

## 4. Passenger flow

Kafka → Gateway → WS → Passenger

## 5. Gateway responsibilities

- Auth WS (JWT)
- Manage connection
- Push event real-time
- Rate limit WS

## 6. Fallback
- Polling nếu WS fail