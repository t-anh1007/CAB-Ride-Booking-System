import { generateProviderRef } from '../utils/ids.js';

function buildResponse(status, providerRef, reason = null) {
  return {
    status,
    providerRef,
    reason
  };
}

function getMockOutcome(method, payload) {
  const desiredOutcome = String(payload?.outcome || 'success').trim().toLowerCase();
  const providerRef = payload?.providerRef || generateProviderRef(`MOCK-${method.toUpperCase()}`);

  return { desiredOutcome, providerRef };
}

export function resolveProvider(method) {
  const normalized = String(method).trim().toLowerCase();

  return {
    name: ['momo', 'vnpay'].includes(normalized) ? `${normalized}-mock` : 'internal-mock',
    async charge(payment, payload = {}, attempt = 1) {
      const { desiredOutcome, providerRef } = getMockOutcome(normalized, payload);

      if (desiredOutcome === 'success') {
        return buildResponse('COMPLETED', providerRef);
      }

      if (desiredOutcome === 'failed') {
        return buildResponse('FAILED', providerRef, payload.failureReason || 'Payment failed');
      }

      if (desiredOutcome === 'timeout_then_success') {
        const transientFailures = Number.isInteger(payload.transientFailures) && payload.transientFailures >= 0
          ? payload.transientFailures
          : 1;

        if (attempt <= transientFailures) {
          return buildResponse('TIMEOUT', providerRef, payload.failureReason || 'Gateway timeout');
        }

        return buildResponse('COMPLETED', providerRef);
      }

      if (desiredOutcome === 'timeout') {
        return buildResponse('TIMEOUT', providerRef, payload.failureReason || 'Gateway timeout');
      }

      if (desiredOutcome === 'refund_failed') {
        return buildResponse('FAILED', providerRef, payload.failureReason || 'Refund failed');
      }

      return buildResponse('COMPLETED', providerRef);
    },
    async refund(payment, payload = {}) {
      const desiredOutcome = String(payload?.outcome || 'success').trim().toLowerCase();
      const providerRef = payment.providerRef || payload?.providerRef || generateProviderRef(`MOCK-${normalized.toUpperCase()}`);

      if (desiredOutcome === 'failed' || desiredOutcome === 'refund_failed') {
        return buildResponse('FAILED', providerRef, payload.failureReason || 'Refund failed');
      }

      return buildResponse('REFUNDED', providerRef);
    }
  };
}
