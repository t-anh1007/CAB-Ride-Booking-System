
---

# 📄 04-routing.md

```md
# Routing & Service Mapping

## 1. Nguyên tắc
- Path-based routing
- Versioning: /api/v1/*
- Không hardcode business logic

## 2. Danh sách route

| Route | Service |
|------|--------|
| /api/v1/auth/* | Auth Service |
| /api/v1/users/* | User Service |
| /api/v1/drivers/* | Driver Service |
| /api/v1/bookings/* | Booking Service |
| /api/v1/rides/* | Ride Service |
| /api/v1/pricing/* | Pricing Service |
| /api/v1/payments/* | Payment Service |
| /api/v1/notifications/* | Notification Service |
| /api/v1/reviews/* | Review Service |

## 3. Ví dụ routing

POST /api/v1/bookings → booking-service

## 4. Load balancing
- Round robin
- Service discovery (Kubernetes DNS)

## 5. Timeout
- Default: 3–5s
- Retry cho service quan trọng
