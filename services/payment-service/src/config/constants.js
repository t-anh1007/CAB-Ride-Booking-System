export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED'
};

export const PAYMENT_EVENTS = {
  CREATED: 'payment.created',
  PROCESSING_STARTED: 'payment.processing.started',
  COMPLETED: 'payment.completed',
  FAILED: 'payment.failed',
  RETRY_EXHAUSTED: 'payment.retry.exhausted',
  REFUNDED: 'payment.refunded',
  SAGA_STARTED: 'payment.saga.started',
  SAGA_COMPLETED: 'payment.saga.completed',
  SAGA_FAILED: 'payment.saga.failed',
  SAGA_COMPENSATED: 'payment.saga.compensated',
  RIDE_PAYMENT_COMPLETED: 'ride.payment.completed',
  RIDE_PAYMENT_FAILED: 'ride.payment.failed',
  RIDE_PAYMENT_REFUNDED: 'ride.payment.refunded',
  NOTIFICATION_PAYMENT_COMPLETED: 'notification.payment.completed',
  NOTIFICATION_PAYMENT_FAILED: 'notification.payment.failed',
  NOTIFICATION_PAYMENT_REFUNDED: 'notification.payment.refunded',
  WALLET_LEDGER_CAPTURE_REQUESTED: 'wallet.ledger.capture.requested',
  WALLET_LEDGER_COMPENSATION_REQUESTED: 'wallet.ledger.compensation.requested'
};

export const PAYMENT_SAGA_STATUSES = {
  NOT_STARTED: 'NOT_STARTED',
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  COMPENSATED: 'COMPENSATED'
};

export const ALLOWED_METHODS = ['cash', 'card', 'wallet', 'momo', 'vnpay'];
export const DEFAULT_CURRENCY = 'VND';
export const SERVICE_NAME = 'payment-service';
export const DEFAULT_PORT = 3102;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_BASE_DELAY_MS = 200;
export const MAX_BACKOFF_DELAY_MS = 2000;
