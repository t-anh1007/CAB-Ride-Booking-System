# Architecture (CAB Level)

## 1. Tổng thể

Client
 ↓ HTTPS
WAF
 ↓
API Gateway (HTTP + WS)
 ↓
Microservices
 ↓
Kafka / Redis

## 2. Layer trong Gateway

### 2.1 HTTP Layer
- REST API handling
- Middleware pipeline

### 2.2 WebSocket Layer
- Real-time connection
- Event push

### 2.3 Security Layer
- JWT validation
- RBAC / ABAC

### 2.4 Integration Layer
- Auth service
- Service routing
- Kafka bridge (indirect)

## 3. Data flow

HTTP:
Client → Gateway → Service

Realtime:
Driver → WS → Gateway → Service → Kafka → Gateway → Passenger

## 4. Deployment
- Kubernetes (stateless)
- Horizontal scaling
- Load balancer (L7)
