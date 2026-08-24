import { getDb } from '../db/mongoClient.js';

function collection(env) {
  return getDb().collection(env.outboxCollection);
}

export async function ensureOutboxIndexes(env) {
  await collection(env).createIndex({ eventId: 1 }, { unique: true, name: 'eventId_1' });
  await collection(env).createIndex({ topic: 1, createdAt: -1 }, { name: 'topic_1_createdAt_-1' });
}

export async function appendOutboxEvent(env, event) {
  await collection(env).insertOne(event);
  return event;
}
