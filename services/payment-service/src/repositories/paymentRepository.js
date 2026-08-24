import { getDb } from '../db/mongoClient.js';

function collection(env) {
  return getDb().collection(env.paymentsCollection);
}

export async function ensurePaymentIndexes(env) {
  const payments = collection(env);

  await payments.createIndex({ paymentId: 1 }, { unique: true, name: 'paymentId_1' });
  await payments.createIndex(
    { idempotencyKey: 1 },
    {
      unique: true,
      name: 'idempotencyKey_1',
      partialFilterExpression: {
        idempotencyKey: { $exists: true, $type: 'string' }
      }
    }
  );
  await payments.createIndex({ rideId: 1 }, { name: 'rideId_1' });
  await payments.createIndex({ userId: 1 }, { name: 'userId_1' });
}

export async function createPaymentDocument(env, payment) {
  await collection(env).insertOne(payment);
  return payment;
}

export async function findPaymentById(env, paymentId) {
  return collection(env).findOne({ paymentId });
}

export async function findPaymentByIdempotencyKey(env, idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  return collection(env).findOne({ idempotencyKey });
}

export async function updatePaymentDocument(env, paymentId, patch) {
  await collection(env).updateOne({ paymentId }, { $set: patch });
  return findPaymentById(env, paymentId);
}
