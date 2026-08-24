import {
  ALLOWED_METHODS,
  DEFAULT_CURRENCY,
  PAYMENT_EVENTS,
  PAYMENT_SAGA_STATUSES,
  PAYMENT_STATUSES
} from '../config/constants.js';
import { PaymentModel } from '../models/paymentModel.js';
import { assertUuid } from '../utils/validation.js';
import { nowIso } from '../utils/time.js';
import {
  createPaymentDocument,
  findPaymentById,
  findPaymentByIdempotencyKey,
  updatePaymentDocument
} from '../repositories/paymentRepository.js';
import { appendTransaction } from '../repositories/transactionRepository.js';
import { resolveProvider } from '../providers/paymentProviders.js';
import { publishPaymentEvent } from '../events/eventPublisher.js';
import { generateId } from '../utils/ids.js';
import { runWithExponentialBackoff } from './retryEngine.js';

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function ensureRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createHttpError(400, `Field '${fieldName}' is required`);
  }
}

function ensurePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw createHttpError(400, `Field '${fieldName}' must be a positive integer`);
  }
}

function sanitizeMethod(method) {
  const normalized = String(method || '').trim().toLowerCase();

  if (!ALLOWED_METHODS.includes(normalized)) {
    throw createHttpError(400, 'Unsupported payment method', { allowedMethods: ALLOWED_METHODS });
  }

  return normalized;
}

function toPublicPayment(payment) {
  return {
    paymentId: payment.paymentId,
    rideId: payment.rideId,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    providerRef: payment.providerRef ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

async function recordTransaction(env, paymentId, type, status, payload = {}) {
  return appendTransaction(env, {
    transactionId: generateId(),
    paymentId,
    type,
    status,
    payload,
    createdAt: nowIso()
  });
}

async function publishSagaEvent(env, topic, payment, extra = {}) {
  return publishPaymentEvent(env, topic, {
    ...toPublicPayment(payment),
    ...extra,
    sagaStatus: payment.sagaStatus
  });
}

async function publishIntegrationEvents(env, eventNames, payment, extra = {}) {
  for (const topic of eventNames) {
    await publishPaymentEvent(env, topic, {
      ...toPublicPayment(payment),
      ...extra,
      sagaStatus: payment.sagaStatus
    });
  }
}

export async function createPayment(env, payload, idempotencyKey = null) {
  ensureRequiredString(payload?.rideId, 'rideId');
  ensureRequiredString(payload?.userId, 'userId');
  ensurePositiveInteger(payload?.amount, 'amount');

  const rideId = assertUuid(payload.rideId, 'rideId', createHttpError);
  const userId = assertUuid(payload.userId, 'userId', createHttpError);
  const method = sanitizeMethod(payload.method);

  if (idempotencyKey) {
    const existing = await findPaymentByIdempotencyKey(env, idempotencyKey);
    if (existing) {
      return { payment: toPublicPayment(existing), reused: true };
    }
  }

  const provider = resolveProvider(method);
  const payment = new PaymentModel({
    rideId,
    userId,
    amount: payload.amount,
    currency: payload.currency || env.defaultCurrency || DEFAULT_CURRENCY,
    method,
    provider: provider.name,
    idempotencyKey: idempotencyKey || undefined
  });

  await createPaymentDocument(env, payment);
  await recordTransaction(env, payment.paymentId, 'CREATE', PAYMENT_STATUSES.PENDING, {
    amount: payment.amount,
    method: payment.method,
    idempotencyKey: payment.idempotencyKey || null
  });
  await publishPaymentEvent(env, PAYMENT_EVENTS.CREATED, toPublicPayment(payment));
  return { payment: toPublicPayment(payment), reused: false };
}

export async function getPaymentById(env, paymentId) {
  const normalizedPaymentId = assertUuid(paymentId, 'paymentId', createHttpError);
  const payment = await findPaymentById(env, normalizedPaymentId);

  if (!payment) {
    throw createHttpError(404, 'Payment not found');
  }

  return toPublicPayment(payment);
}

export async function confirmPayment(env, paymentId, payload = {}) {
  const normalizedPaymentId = assertUuid(paymentId, 'paymentId', createHttpError);
  const payment = await findPaymentById(env, normalizedPaymentId);

  if (!payment) {
    throw createHttpError(404, 'Payment not found');
  }

  if ([PAYMENT_STATUSES.REFUNDED, PAYMENT_STATUSES.CANCELLED].includes(payment.status)) {
    throw createHttpError(409, `Cannot confirm payment in status '${payment.status}'`);
  }

  if (payment.status === PAYMENT_STATUSES.COMPLETED) {
    return toPublicPayment(payment);
  }

  const provider = resolveProvider(payment.method);
  const processingTimestamp = nowIso();
  const processing = await updatePaymentDocument(env, normalizedPaymentId, {
    status: PAYMENT_STATUSES.PROCESSING,
    sagaStatus: PAYMENT_SAGA_STATUSES.STARTED,
    lastAttemptAt: processingTimestamp,
    updatedAt: processingTimestamp
  });

  await recordTransaction(env, normalizedPaymentId, 'SAGA_START', PAYMENT_STATUSES.PROCESSING, {
    paymentGateway: provider.name
  });
  await publishSagaEvent(env, PAYMENT_EVENTS.SAGA_STARTED, processing, {
    stage: 'StartPaymentSaga'
  });
  await publishPaymentEvent(env, PAYMENT_EVENTS.PROCESSING_STARTED, {
    ...toPublicPayment(processing),
    stage: 'charge_requested'
  });

  const retry = await runWithExponentialBackoff(
    async (attempt) => {
      const attemptResult = await provider.charge(payment, payload, attempt);
      await recordTransaction(env, normalizedPaymentId, 'CHARGE_ATTEMPT', PAYMENT_STATUSES.PROCESSING, {
        attempt,
        result: attemptResult.status,
        providerRef: attemptResult.providerRef || null,
        reason: attemptResult.reason || null
      });
      return attemptResult;
    },
    {
      maxRetries: payload.maxRetries ?? env.retry.maxRetries,
      baseDelayMs: payload.baseDelayMs ?? env.retry.baseDelayMs,
      maxDelayMs: payload.maxDelayMs ?? env.retry.maxDelayMs
    }
  );

  const retryHistory = retry.history;
  const retryCount = retryHistory.length;
  const result = retry.result;
  const providerRef = result.providerRef || payment.providerRef || null;
  const updatedAt = nowIso();
  const nextRetryAt = retry.nextRetryAt;

  if (result.status === 'COMPLETED') {
    const updated = await updatePaymentDocument(env, normalizedPaymentId, {
      status: PAYMENT_STATUSES.COMPLETED,
      sagaStatus: PAYMENT_SAGA_STATUSES.COMPLETED,
      providerRef,
      failureReason: null,
      retryCount,
      retryHistory,
      nextRetryAt: null,
      confirmedAt: nowIso(),
      updatedAt
    });

    await recordTransaction(env, normalizedPaymentId, 'CONFIRM', PAYMENT_STATUSES.COMPLETED, {
      providerRef,
      retryCount,
      retryHistory,
      sagaStatus: PAYMENT_SAGA_STATUSES.COMPLETED
    });
    await publishPaymentEvent(env, PAYMENT_EVENTS.COMPLETED, toPublicPayment(updated));
    await publishSagaEvent(env, PAYMENT_EVENTS.SAGA_COMPLETED, updated, {
      stage: 'PaymentSagaCompleted'
    });
    await publishIntegrationEvents(env, [
      PAYMENT_EVENTS.RIDE_PAYMENT_COMPLETED,
      PAYMENT_EVENTS.NOTIFICATION_PAYMENT_COMPLETED,
      PAYMENT_EVENTS.WALLET_LEDGER_CAPTURE_REQUESTED
    ], updated, { stage: 'DownstreamIntegrationReady' });
    return toPublicPayment(updated);
  }

  const failureReason = result.reason || 'Payment failed';
  const failed = await updatePaymentDocument(env, normalizedPaymentId, {
    status: PAYMENT_STATUSES.FAILED,
    sagaStatus: PAYMENT_SAGA_STATUSES.FAILED,
    providerRef,
    failureReason,
    retryCount,
    retryHistory,
    nextRetryAt,
    updatedAt
  });

  await recordTransaction(env, normalizedPaymentId, 'CONFIRM', PAYMENT_STATUSES.FAILED, {
    providerRef,
    failureReason,
    retryCount,
    retryHistory,
    exhausted: retry.exhausted
  });

  if (retry.exhausted) {
    await publishPaymentEvent(env, PAYMENT_EVENTS.RETRY_EXHAUSTED, {
      ...toPublicPayment(failed),
      failureReason,
      retryCount
    });
  }

  await publishPaymentEvent(env, PAYMENT_EVENTS.FAILED, {
    ...toPublicPayment(failed),
    failureReason,
    retryCount
  });
  await publishSagaEvent(env, PAYMENT_EVENTS.SAGA_FAILED, failed, {
    stage: retry.exhausted ? 'PaymentRetryExhausted' : 'PaymentSagaFailed',
    failureReason,
    retryCount
  });
  await publishIntegrationEvents(env, [
    PAYMENT_EVENTS.RIDE_PAYMENT_FAILED,
    PAYMENT_EVENTS.NOTIFICATION_PAYMENT_FAILED
  ], failed, {
    failureReason,
    retryCount,
    stage: 'DownstreamIntegrationReady'
  });
  return toPublicPayment(failed);
}

export async function refundPayment(env, paymentId, payload = {}) {
  const normalizedPaymentId = assertUuid(paymentId, 'paymentId', createHttpError);
  const payment = await findPaymentById(env, normalizedPaymentId);

  if (!payment) {
    throw createHttpError(404, 'Payment not found');
  }

  if (payment.status !== PAYMENT_STATUSES.COMPLETED) {
    throw createHttpError(409, 'Only completed payments can be refunded');
  }

  const provider = resolveProvider(payment.method);
  const refundResult = await provider.refund(payment, payload);

  if (refundResult.status !== 'REFUNDED') {
    throw createHttpError(502, 'Refund provider request failed', {
      providerRef: refundResult.providerRef || payment.providerRef || null,
      reason: refundResult.reason || 'Refund failed'
    });
  }

  const updated = await updatePaymentDocument(env, normalizedPaymentId, {
    status: PAYMENT_STATUSES.REFUNDED,
    sagaStatus: PAYMENT_SAGA_STATUSES.COMPENSATED,
    providerRef: refundResult.providerRef || payment.providerRef || null,
    refundReason: payload.reason || 'Refund requested',
    refundedAt: nowIso(),
    updatedAt: nowIso()
  });

  await recordTransaction(env, normalizedPaymentId, 'REFUND', PAYMENT_STATUSES.REFUNDED, {
    providerRef: updated.providerRef,
    reason: payload.reason || 'Refund requested',
    compensation: true
  });
  await publishPaymentEvent(env, PAYMENT_EVENTS.REFUNDED, {
    ...toPublicPayment(updated),
    refundReason: payload.reason || 'Refund requested'
  });
  await publishSagaEvent(env, PAYMENT_EVENTS.SAGA_COMPENSATED, updated, {
    stage: 'PaymentSagaCompensated',
    refundReason: payload.reason || 'Refund requested'
  });
  await publishIntegrationEvents(env, [
    PAYMENT_EVENTS.RIDE_PAYMENT_REFUNDED,
    PAYMENT_EVENTS.NOTIFICATION_PAYMENT_REFUNDED,
    PAYMENT_EVENTS.WALLET_LEDGER_COMPENSATION_REQUESTED
  ], updated, {
    refundReason: payload.reason || 'Refund requested',
    stage: 'DownstreamIntegrationReady'
  });
  return toPublicPayment(updated);
}
