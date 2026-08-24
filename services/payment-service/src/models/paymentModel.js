import { DEFAULT_CURRENCY, PAYMENT_SAGA_STATUSES, PAYMENT_STATUSES } from '../config/constants.js';
import { generateId } from '../utils/ids.js';
import { nowIso } from '../utils/time.js';

export class PaymentModel {
  constructor({ rideId, userId, amount, currency = DEFAULT_CURRENCY, method, provider, idempotencyKey = null }) {
    const timestamp = nowIso();

    this.paymentId = generateId();
    this.rideId = rideId;
    this.userId = userId;
    this.amount = amount;
    this.currency = currency;
    this.method = method;
    this.provider = provider;
    this.status = PAYMENT_STATUSES.PENDING;
    this.sagaStatus = PAYMENT_SAGA_STATUSES.NOT_STARTED;
    this.providerRef = null;
    this.failureReason = null;
    this.refundReason = null;
    this.retryCount = 0;
    this.retryHistory = [];
    this.nextRetryAt = null;
    this.lastAttemptAt = null;
    this.confirmedAt = null;
    this.refundedAt = null;
    this.transactionCount = 0;
    this.idempotencyKey = idempotencyKey || undefined;
    this.createdAt = timestamp;
    this.updatedAt = timestamp;
  }
}
