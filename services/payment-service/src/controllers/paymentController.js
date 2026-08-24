import {
  confirmPayment,
  createPayment,
  getPaymentById,
  refundPayment
} from '../services/paymentService.js';
import { recordAuditEvent } from '../utils/audit.js';
import { sendError, sendSuccess } from '../utils/response.js';

export function healthCheck(request, response) {
  return sendSuccess(response, request, 'Payment service is healthy', {
    service: 'payment-service',
    status: 'ok'
  });
}

export function architectureInfo(request, response) {
  return sendSuccess(response, request, 'Payment service architecture', {
    service: 'payment-service',
    responsibility: 'Thanh toán, retry + exponential backoff, idempotency, outbox events, MongoDB source of truth',
    endpoints: [
      'POST /api/v1/payments',
      'GET /api/v1/payments/:paymentId',
      'POST /api/v1/payments/:paymentId/confirm',
      'POST /api/v1/payments/:paymentId/refund'
    ],
    notes: [
      'Response public bám sát spec Word',
      'Lưu MongoDB riêng cho payment-service',
      'Có provider abstraction dạng mock cho momo/vnpay/internal',
      'Có outbox event cho payment.created/completed/failed/refunded',
      'Có retry + exponential backoff thật trong confirm flow'
    ]
  });
}

export async function createPaymentHandler(request, response, next) {
  try {
    setAuditEvent(request, {
      action: 'payment.create',
      targetType: 'payment',
      targetId: request.body?.rideId || null,
      metadata: {
        rideId: request.body?.rideId || null,
        userId: request.body?.userId || null,
        amount: request.body?.amount || null,
        method: request.body?.method || null,
        idempotencyKey: request.requestMeta?.idempotencyKey || null
      }
    });
    const result = await createPayment(request.app.locals.env, request.body, request.requestMeta?.idempotencyKey || null);
    const message = result.reused ? 'Payment returned from idempotency cache' : 'Payment created';
    const statusCode = result.reused ? 200 : 201;
    auditSuccess(request, {
      targetId: result.payment.paymentId,
      metadata: {
        reused: result.reused,
        status: result.payment.status,
        amount: result.payment.amount
      }
    });
    return sendSuccess(response, request, message, result.payment, statusCode);
  } catch (error) {
    return next(error);
  }
}

export async function getPaymentHandler(request, response, next) {
  try {
    setAuditEvent(request, {
      action: 'payment.read',
      targetType: 'payment',
      targetId: request.params.paymentId
    });
    const payment = await getPaymentById(request.app.locals.env, request.params.paymentId);
    auditSuccess(request, {
      targetId: payment.paymentId,
      metadata: {
        rideId: payment.rideId,
        status: payment.status
      }
    });
    return sendSuccess(response, request, 'Payment fetched', payment);
  } catch (error) {
    return next(error);
  }
}

export async function confirmPaymentHandler(request, response, next) {
  try {
    setAuditEvent(request, {
      action: 'payment.confirm',
      targetType: 'payment',
      targetId: request.params.paymentId,
      metadata: {
        requestedOutcome: request.body?.outcome || null
      }
    });
    const payment = await confirmPayment(request.app.locals.env, request.params.paymentId, request.body || {});
    auditSuccess(request, {
      targetId: payment.paymentId,
      metadata: {
        status: payment.status,
        providerRef: payment.providerRef || null
      }
    });
    return sendSuccess(response, request, 'Payment confirmed', payment);
  } catch (error) {
    return next(error);
  }
}

export async function refundPaymentHandler(request, response, next) {
  try {
    setAuditEvent(request, {
      action: 'payment.refund',
      targetType: 'payment',
      targetId: request.params.paymentId,
      metadata: {
        refundReason: request.body?.reason || null
      }
    });
    const payment = await refundPayment(request.app.locals.env, request.params.paymentId, request.body || {});
    auditSuccess(request, {
      targetId: payment.paymentId,
      metadata: {
        status: payment.status,
        refundReason: request.body?.reason || null
      }
    });
    return sendSuccess(response, request, 'Payment refunded', payment);
  } catch (error) {
    return next(error);
  }
}

export function routeNotAllowed(request, response) {
  return sendError(response, request, 'Method not allowed', 405);
}

function setAuditEvent(request, event) {
  request.auditEvent = event;
  request.auditLogged = false;
}

function auditSuccess(request, details = {}) {
  recordAuditEvent(request, {
    ...request.auditEvent,
    ...details,
    outcome: 'success',
    metadata: {
      ...(request.auditEvent?.metadata || {}),
      ...(details.metadata || {})
    }
  });
  request.auditLogged = true;
}
