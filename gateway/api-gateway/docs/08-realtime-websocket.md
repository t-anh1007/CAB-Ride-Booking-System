# Error Handling & Resilience

## 1. Nguyên tắc
- Fail fast
- Graceful degradation

## 2. Common errors

| Scenario | Handling |
|--------|---------|
| Auth service down | 503 |
| Token invalid | 401 |
| Forbidden | 403 |
| Service timeout | retry |

## 3. Circuit breaker

- Ngắt service khi lỗi nhiều
- Tránh cascade failure

## 4. Retry

- Exponential backoff
- Giới hạn số lần retry

## 5. Idempotency

- Tránh duplicate request
