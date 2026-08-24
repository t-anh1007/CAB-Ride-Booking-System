# Failure Handling

## 1. Auth service down
→ trả 503 + circuit breaker

## 2. Token invalid
→ 401

## 3. Service timeout
→ retry + fallback

## 4. WS disconnect
→ reconnect

## 5. Kafka lag
→ delay WS push

## 6. Pattern

- Circuit breaker
- Retry + backoff
- Graceful degradation