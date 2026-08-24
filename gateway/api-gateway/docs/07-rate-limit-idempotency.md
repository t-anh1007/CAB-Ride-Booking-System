# WebSocket Handling

## 1. Use cases
- GPS update (Driver)
- Ride tracking (Customer)
- Matching real-time

## 2. Kiến trúc

Client → WebSocket Gateway → Ride Service

## 3. Flow

Driver:
- Send GPS via WS

Gateway:
- Forward event

Ride Service:
- Update Redis Geo

Event:
- Publish Kafka

## 4. Yêu cầu Gateway

- Connection management
- Auth handshake (JWT)
- Rate limit WS

## 5. Fallback
- Polling nếu WS fail
