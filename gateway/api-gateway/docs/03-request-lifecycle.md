# Request Lifecycle

## 1. Flow tổng thể

1. Client gửi request + JWT
2. Gateway nhận request
3. Validate JWT (Auth Service)
4. Check permission (RBAC/ABAC)
5. Rate limit
6. Validate request schema
7. Forward request đến service
8. Nhận response
9. Normalize response
10. Trả về client

## 2. Sequence chi tiết

Client → Gateway:
- Authorization header

Gateway → Auth Service:
- Validate token

Gateway:
- Check role
- Rate limit

Gateway → Service:
- Forward request

Service → Gateway:
- Response

Gateway → Client:
- Standard response format

## 3. Header xử lý

### Input:
- Authorization
- x-request-id
- x-correlation-id

### Gateway xử lý:
- Generate nếu thiếu
- Propagate xuống service

## 4. Response chuẩn

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {
    "requestId": "uuid",
    "correlationId": "uuid",
    "timestamp": "ISO"
  }
}

