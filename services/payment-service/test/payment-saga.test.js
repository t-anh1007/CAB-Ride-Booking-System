import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';

const payments = new Map();
const transactions = [];
const outboxEvents = [];
const env = {
  defaultCurrency: 'VND',
  paymentsCollection: 'payments',
  transactionsCollection: 'transactions',
  outboxCollection: 'payment_outbox',
  kafkaEnabled: false,
  kafkaBrokers: [],
  kafkaClientId: 'payment-service-test',
  paymentTopic: 'payment-events',
  retry: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1 }
};

const collections = {
  payments: {
    async insertOne(payment) {
      payments.set(payment.paymentId, payment);
      return { acknowledged: true, insertedId: payment.paymentId };
    },
    async findOne(query) {
      if (query.paymentId) return payments.get(query.paymentId) ?? null;
      if (query.idempotencyKey) {
        return [...payments.values()].find((payment) => payment.idempotencyKey === query.idempotencyKey) ?? null;
      }
      return null;
    },
    async updateOne({ paymentId }, { $set }) {
      const payment = payments.get(paymentId);
      if (payment) Object.assign(payment, $set);
      return { acknowledged: true, matchedCount: payment ? 1 : 0, modifiedCount: payment ? 1 : 0 };
    }
  },
  transactions: {
    async insertOne(transaction) {
      transactions.push(transaction);
      return { acknowledged: true, insertedId: transaction.transactionId };
    }
  },
  payment_outbox: {
    async insertOne(event) {
      outboxEvents.push(event);
      return { acknowledged: true, insertedId: event.eventId };
    }
  }
};

let confirmPayment;
let createPayment;
let refundPayment;

before(async () => {
  mock.module('../src/db/mongoClient.js', {
    namedExports: {
      getDb: () => ({
        collection(name) {
          const collection = collections[name];
          if (!collection) throw new Error(`Unknown test collection: ${name}`);
          return collection;
        }
      })
    }
  });
  ({ confirmPayment, createPayment, refundPayment } = await import('../src/services/paymentService.js'));
});

beforeEach(() => {
  payments.clear();
  transactions.length = 0;
  outboxEvents.length = 0;
});

const createPayload = (method = 'card') => ({
  rideId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  amount: 125000,
  currency: 'VND',
  method
});

test('[TC36] create is PENDING and successful confirmation is COMPLETED with completion events', async () => {
  const created = await createPayment(env, createPayload(), 'idem-payment-success');
  assert.equal(created.payment.status, 'PENDING');

  const confirmed = await confirmPayment(env, created.payment.paymentId, {
    outcome: 'success',
    providerRef: 'PROVIDER-SUCCESS'
  });

  assert.equal(confirmed.status, 'COMPLETED');
  assert.equal(payments.get(created.payment.paymentId).sagaStatus, 'COMPLETED');
  assert.ok(outboxEvents.some((event) => event.topic === 'payment.completed'));
  assert.ok(outboxEvents.some((event) => event.topic === 'payment.saga.completed'));
});

test('[TC37] provider failure persists FAILED saga state and failure events', async () => {
  const created = await createPayment(env, createPayload('momo'), 'idem-payment-failed');
  const failed = await confirmPayment(env, created.payment.paymentId, {
    outcome: 'failed',
    failureReason: 'Provider declined'
  });

  assert.equal(failed.status, 'FAILED');
  assert.equal(payments.get(created.payment.paymentId).sagaStatus, 'FAILED');
  assert.ok(outboxEvents.some((event) => event.topic === 'payment.failed'));
  assert.ok(outboxEvents.some((event) => event.topic === 'payment.saga.failed'));
  assert.ok(outboxEvents.some((event) => event.topic === 'ride.payment.failed'));
});

test('[TC37] refund compensates a completed payment and emits refund events', async () => {
  const created = await createPayment(env, createPayload('wallet'), 'idem-payment-refund');
  await confirmPayment(env, created.payment.paymentId, { outcome: 'success' });
  const refunded = await refundPayment(env, created.payment.paymentId, {
    outcome: 'success',
    reason: 'Ride cancelled'
  });

  assert.equal(refunded.status, 'REFUNDED');
  assert.equal(payments.get(created.payment.paymentId).sagaStatus, 'COMPENSATED');
  assert.ok(outboxEvents.some((event) => event.topic === 'payment.refunded'));
  assert.ok(outboxEvents.some((event) => event.topic === 'payment.saga.compensated'));
  assert.ok(outboxEvents.some((event) => event.topic === 'wallet.ledger.compensation.requested'));
});

test('[TC34, TC86] repeated confirmation does not mutate or publish after completion', async () => {
  const created = await createPayment(env, createPayload(), 'idem-payment-repeat');
  const first = await confirmPayment(env, created.payment.paymentId, { outcome: 'success' });
  const outboxCount = outboxEvents.length;
  const transactionCount = transactions.length;
  const updatedAt = payments.get(created.payment.paymentId).updatedAt;

  const second = await confirmPayment(env, created.payment.paymentId, { outcome: 'failed' });

  assert.deepEqual(second, first);
  assert.equal(outboxEvents.length, outboxCount);
  assert.equal(transactions.length, transactionCount);
  assert.equal(payments.get(created.payment.paymentId).updatedAt, updatedAt);
});

test('[TC14] invalid payment method is rejected before persistence or provider work', async () => {
  await assert.rejects(
    createPayment(env, createPayload('invalid_card'), 'idem-payment-invalid'),
    (error) => error.statusCode === 400 && /unsupported payment method/i.test(error.message)
  );
  assert.equal(payments.size, 0);
  assert.equal(transactions.length, 0);
  assert.equal(outboxEvents.length, 0);
});
