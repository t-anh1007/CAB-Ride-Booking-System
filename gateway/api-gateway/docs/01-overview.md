# API Gateway – Overview (CAB Booking)

## 1. Mục tiêu
API Gateway là entry point duy nhất cho toàn bộ hệ thống CAB Booking, đảm nhiệm:
- Nhận request từ Client (Customer / Driver / Admin)
- Thực thi Zero Trust security
- Điều phối request đến microservices
- Quản lý real-time (WebSocket)
- Chuẩn hóa dữ liệu & response

## 2. Vai trò trong CAB System
Gateway đóng vai trò:
- Policy Enforcement Point (PEP)
- Traffic Router
- Security Layer
- Real-time Gateway

Client → Gateway → Services → Kafka → Gateway → Client

## 3. Nguyên tắc
- Stateless
- Không chứa business logic
- Async-first compatible
- Zero Trust enforced
- Observability by design

## 4. Scope
- HTTP routing
- WebSocket connection
- Auth / RBAC / ABAC
- Rate limit / Idempotency
- Schema validation
- Response normalization
- Distributed tracing

## 5. Out of scope
- Business logic
- Database
- Event processing (consumer)