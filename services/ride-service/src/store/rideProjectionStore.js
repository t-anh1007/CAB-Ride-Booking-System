const rides = new Map();

function nowIso() {
  return new Date().toISOString();
}

function mapRideStatus(topic, paymentStatus) {
  switch (topic) {
    case 'payment.completed':
    case 'ride.payment.completed':
      return 'PAYMENT_CONFIRMED';
    case 'payment.failed':
    case 'ride.payment.failed':
      return 'PAYMENT_FAILED';
    case 'payment.refunded':
    case 'ride.payment.refunded':
      return 'PAYMENT_REFUNDED';
    default:
      return paymentStatus || 'UNKNOWN';
  }
}

export function applyPaymentEvent(event) {
  const rideId = event.rideId || 'unknown-ride';
  const existing = rides.get(rideId) || {
    rideId,
    userId: event.userId || null,
    paymentId: event.paymentId || null,
    amount: event.amount || null,
    currency: event.currency || null,
    method: event.method || null,
    paymentStatus: 'PENDING',
    rideStatus: 'PAYMENT_PENDING',
    sagaStatus: 'NOT_STARTED',
    lastEventTopic: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    timeline: []
  };

  const updated = {
    ...existing,
    userId: event.userId ?? existing.userId,
    paymentId: event.paymentId ?? existing.paymentId,
    amount: event.amount ?? existing.amount,
    currency: event.currency ?? existing.currency,
    method: event.method ?? existing.method,
    paymentStatus: event.status ?? existing.paymentStatus,
    rideStatus: mapRideStatus(event.topic, event.status ?? existing.paymentStatus),
    sagaStatus: event.sagaStatus ?? existing.sagaStatus,
    lastEventTopic: event.topic,
    updatedAt: nowIso(),
    timeline: [
      ...existing.timeline,
      {
        topic: event.topic,
        status: event.status ?? null,
        sagaStatus: event.sagaStatus ?? null,
        timestamp: event.timestamp || nowIso()
      }
    ]
  };

  rides.set(rideId, updated);
  return updated;
}

export function listRideProjections() {
  return Array.from(rides.values());
}

export function getRideProjection(rideId) {
  return rides.get(rideId) || null;
}
