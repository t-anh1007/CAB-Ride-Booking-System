class PaymentStore {
  constructor() {
    this.payments = new Map();
    this.idempotencyIndex = new Map();
  }

  create(payment, idempotencyKey = null) {
    this.payments.set(payment.paymentId, payment);

    if (idempotencyKey) {
      this.idempotencyIndex.set(idempotencyKey, payment.paymentId);
    }

    return payment;
  }

  findById(paymentId) {
    return this.payments.get(paymentId) || null;
  }

  findByIdempotencyKey(idempotencyKey) {
    const paymentId = this.idempotencyIndex.get(idempotencyKey);
    return paymentId ? this.findById(paymentId) : null;
  }

  update(payment) {
    this.payments.set(payment.paymentId, payment);
    return payment;
  }
}

export const paymentStore = new PaymentStore();
