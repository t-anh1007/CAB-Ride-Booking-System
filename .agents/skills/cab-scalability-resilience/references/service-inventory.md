# Service Inventory (v1 Scope)

Dưới đây là danh sách các dịch vụ hợp lệ trong phạm vi v1 của skill review. Nếu hệ thống hoặc quy trình mà bạn định test thuộc các services NGOÀI danh sách này (e.g. notifications, pricing, user), hãy báo cho user là "Not supported in v1".

| Service | Dependencies chính | Runtime evidence đang có (tại repo code/ Swarm) | Nhóm / Vai trò trong v1 |
| --- | --- | --- | --- |
| `gateway/api-gateway` | downstream services, auth, in-memory/redis store | proxy client, circuit breaker, idempotency middleware | `gateway-auth` |
| `services/auth-service` | Postgres, Redis | refresh rotation, replay detection, revoke marker logic | `gateway-auth` |
| `services/payment-service` | MongoDB, outbox, Kafka option, provider simulation | retry engine, flow mapping, payment events, saga-friendly state | `payment` |
| `services/booking-service` | MongoDB, Redis quote, Kafka | idempotency key, booking uniqueness, booking publish path | `booking-ride-driver` |
| `services/ride-service` | Kafka, Redis, MongoDB | event topology references, ride lifecycle expectations | `booking-ride-driver` |
| `services/driver-service` | MongoDB, Redis, Kafka | location update API, Kafka publish path | `booking-ride-driver` |
| `services/notification-service` | Kafka, Redis, 3rd Party APIs | Retry queue, FCM/Twilio webhook logs, DLQ logs | `auxiliary-services` |
| `services/pricing-service` | Redis, MongoDB | Rule evaluation logs, surge rule config states | `auxiliary-services` |
| `services/user-service` | Postgres, Redis | Profile update traces, DB transaction states | `auxiliary-services` |
| `services/review-service` | MongoDB | Async post-ride review logs | `auxiliary-services` |
| `AI-ML/*` | Kafka, Models API, Spark | Model timeout configs, rule-based fallback evidence | `ai-services` |
