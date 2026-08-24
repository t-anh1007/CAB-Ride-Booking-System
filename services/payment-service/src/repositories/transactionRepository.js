import { getDb } from '../db/mongoClient.js';

function collection(env) {
  return getDb().collection(env.transactionsCollection);
}

export async function ensureTransactionIndexes(env) {
  await collection(env).createIndex({ transactionId: 1 }, { unique: true, name: 'transactionId_1' });
  await collection(env).createIndex({ paymentId: 1, createdAt: -1 }, { name: 'paymentId_1_createdAt_-1' });
}

export async function appendTransaction(env, transaction) {
  await collection(env).insertOne(transaction);
  return transaction;
}
