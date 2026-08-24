import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectMongo(env) {
  if (!client) {
    client = new MongoClient(env.mongoUri);
    await client.connect();
    db = client.db(env.mongoDbName);
    console.log(`[payment-service] MongoDB connected: ${env.mongoUri}/${env.mongoDbName}`);
  }

  return { client, db };
}

export function getDb() {
  if (!db) {
    throw new Error('MongoDB has not been connected yet');
  }

  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
