# Event-driven Integration

## 1. Gateway không consume Kafka trực tiếp
- Gateway nhận event từ service layer (push)

## 2. Flow

Service → Kafka → Service → Gateway → Client

## 3. Use case

- driver.location.updated
- ride.assigned
- payment.completed

## 4. Vai trò Gateway

- Bridge event → WebSocket
- Không xử lý business event
