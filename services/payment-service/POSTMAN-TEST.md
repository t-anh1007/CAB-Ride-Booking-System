# Payment Service Postman Test

## 1. Create payment
POST http://localhost:3102/api/v1/payments

Body:
```json
{
  "rideId": "uuid",
  "userId": "uuid",
  "amount": 45000,
  "currency": "VND",
  "method": "cash"
}
```

## 2. Get payment
GET http://localhost:3102/api/v1/payments/{paymentId}

## 3. Confirm payment
POST http://localhost:3102/api/v1/payments/{paymentId}/confirm

Optional body for retry demo:
```json
{
  "outcome": "timeout_then_success",
  "transientFailures": 1,
  "maxRetries": 3,
  "baseDelayMs": 200
}
```

## 4. Refund payment
POST http://localhost:3102/api/v1/payments/{paymentId}/refund

Optional body:
```json
{
  "reason": "Refund requested"
}
```
