# Payment Service flow mapping

This payment-service is aligned to the two payment diagrams in the project PDF while remaining self-contained inside `services/payment-service`.

## 9.5 Payment Failure & Retry

Implemented inside `confirmPayment` + `retryEngine`:

- payment enters `PROCESSING`
- provider charge attempts are recorded as transaction rows
- timeout failures trigger retry with exponential backoff
- retry metadata is persisted in:
  - `retryCount`
  - `retryHistory`
  - `nextRetryAt`
- outbox events are published for:
  - `payment.processing.started`
  - `payment.completed`
  - `payment.failed`
  - `payment.retry.exhausted`

## 9.5.1 Saga Pattern for Payment

Implemented as a choreography-friendly internal saga model:

- `payment.saga.started`
- `payment.saga.completed`
- `payment.saga.failed`
- `payment.saga.compensated`

Supporting persistence collections:

- `payments`
- `payment_transactions`
- `payment_outbox`

This keeps Payment Service as the source of truth for payment state, while providing an outbox that can later be connected to Kafka or another broker without changing the API contract.


## Integration-ready downstream events

To bridge the current gap where `ride-service` and `notification-service` are not yet consuming a full choreography flow, Payment Service now emits integration-friendly outbox topics that those services can subscribe to later without changing the API:

- `ride.payment.completed`
- `ride.payment.failed`
- `ride.payment.refunded`
- `notification.payment.completed`
- `notification.payment.failed`
- `notification.payment.refunded`
- `wallet.ledger.capture.requested`
- `wallet.ledger.compensation.requested`

These events keep the implementation inside `services/payment-service` only, while making the service more ready for the architecture described in 9.5 and 9.5.1.


## Cross-service choreography status (updated)
- `payment-service` now publishes choreography events that can be consumed by `ride-service` and `notification-service` through Kafka when `KAFKA_ENABLED=true`.
- `ride-service` consumes `payment.completed`, `payment.failed`, `payment.refunded` (and `ride.payment.*`) to update ride payment projections.
- `notification-service` consumes `payment.completed`, `payment.failed`, `payment.refunded` (and `notification.payment.*`) to build user-facing notifications.
- `wallet/ledger-service` is still represented as integration-ready events (`wallet.ledger.capture.requested`, `wallet.ledger.compensation.requested`) because a dedicated service is not present in the current repo.
