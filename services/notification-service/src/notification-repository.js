import { MongoClient } from "mongodb";
import { readSecret } from "./config/read-secret.js";

const DEFAULT_DB_NAME = "cab_booking";
const DEFAULT_COLLECTION_NAME = "notifications";

export class InMemoryNotificationRepository {
  constructor() {
    this.notifications = new Map();
    this.notificationOrder = [];
    this.idempotencyIndex = new Map();
  }

  async create(notification) {
    this.notifications.set(notification.id, notification);
    this.notificationOrder.unshift(notification.id);

    if (notification.idempotencyKey) {
      this.idempotencyIndex.set(notification.idempotencyKey, notification.id);
    }

    return notification;
  }

  async update(notificationId, patch) {
    const current = this.notifications.get(notificationId);

    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt || new Date().toISOString()
    };

    this.notifications.set(notificationId, updated);

    if (updated.idempotencyKey) {
      this.idempotencyIndex.set(updated.idempotencyKey, updated.id);
    }

    return updated;
  }

  async getById(notificationId) {
    return this.notifications.get(notificationId) || null;
  }

  async getByIdempotencyKey(idempotencyKey) {
    const notificationId = this.idempotencyIndex.get(idempotencyKey);

    if (!notificationId) {
      return null;
    }

    return this.getById(notificationId);
  }

  async list(filters = {}) {
    const {
      userId,
      status,
      channel,
      type,
      limit = 50
    } = filters;

    const normalizedLimit = Math.max(Number(limit) || 50, 1);
    const notifications = [];

    for (const notificationId of this.notificationOrder) {
      const notification = this.notifications.get(notificationId);

      if (!notification) {
        continue;
      }

      if (userId && notification.userId !== userId) {
        continue;
      }

      if (status && notification.status !== status) {
        continue;
      }

      if (channel && notification.channel !== channel) {
        continue;
      }

      if (type && notification.type !== type) {
        continue;
      }

      notifications.push(notification);

      if (notifications.length >= normalizedLimit) {
        break;
      }
    }

    return notifications;
  }

  async close() {
    return true;
  }
}

export class MongoNotificationRepository {
  constructor({ client, dbName, collectionName }) {
    this.client = client;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.collection = client.db(dbName).collection(collectionName);
  }

  async initialize() {
    await this.collection.createIndexes([
      {
        key: { id: 1 },
        name: "notification_id_unique",
        unique: true
      },
      {
        key: { userId: 1, createdAt: -1 },
        name: "user_notifications_lookup"
      },
      {
        key: { idempotencyKey: 1, createdAt: -1 },
        name: "idempotency_lookup"
      },
      {
        key: { status: 1, createdAt: -1 },
        name: "status_lookup"
      }
    ]);
  }

  async create(notification) {
    await this.collection.insertOne(notification);
    return notification;
  }

  async update(notificationId, patch) {
    const updatedAt = patch.updatedAt || new Date().toISOString();
    const result = await this.collection.findOneAndUpdate(
      { id: notificationId },
      {
        $set: {
          ...patch,
          updatedAt
        }
      },
      {
        returnDocument: "after"
      }
    );

    return serializeNotification(result);
  }

  async getById(notificationId) {
    return serializeNotification(await this.collection.findOne({ id: notificationId }));
  }

  async getByIdempotencyKey(idempotencyKey) {
    return serializeNotification(
      await this.collection.findOne(
        { idempotencyKey },
        {
          sort: { createdAt: -1 }
        }
      )
    );
  }

  async list(filters = {}) {
    const {
      userId,
      status,
      channel,
      type,
      limit = 50
    } = filters;

    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (status) {
      query.status = status;
    }

    if (channel) {
      query.channel = channel;
    }

    if (type) {
      query.type = type;
    }

    const normalizedLimit = Math.max(Number(limit) || 50, 1);
    const results = await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(normalizedLimit)
      .toArray();

    return results.map(serializeNotification);
  }

  async close() {
    await this.client.close();
  }
}

export async function createNotificationRepository({
  repository,
  logger = console,
  mongoUri = readSecret("NOTIFICATION_MONGODB_URI", ""),
  dbName = process.env.NOTIFICATION_MONGODB_DB || DEFAULT_DB_NAME,
  collectionName = process.env.NOTIFICATION_MONGODB_COLLECTION || DEFAULT_COLLECTION_NAME,
  required = String(process.env.NOTIFICATION_MONGODB_REQUIRED || "").trim().toLowerCase() === "true"
} = {}) {
  if (repository) {
    return {
      repository,
      persistence: {
        mode: "custom",
        database: null,
        collection: null,
        connected: true
      },
      async close() {
        if (typeof repository.close === "function") {
          await repository.close();
        }
      }
    };
  }

  if (!mongoUri) {
    return createMemoryRuntime("NOTIFICATION_MONGODB_URI is not configured");
  }

  try {
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5_000
    });
    await client.connect();
    await client.db(dbName).command({ ping: 1 });

    const mongoRepository = new MongoNotificationRepository({
      client,
      dbName,
      collectionName
    });
    await mongoRepository.initialize();

    return {
      repository: mongoRepository,
      persistence: {
        mode: "mongodb",
        database: dbName,
        collection: collectionName,
        connected: true
      },
      async close() {
        await mongoRepository.close();
      }
    };
  } catch (error) {
    if (required) {
      throw error;
    }

    logger.warn?.(`[notification-service] MongoDB unavailable, falling back to in-memory storage: ${error.message}`);
    return createMemoryRuntime(error.message);
  }
}

function createMemoryRuntime(reason) {
  return {
    repository: new InMemoryNotificationRepository(),
    persistence: {
      mode: "memory",
      database: null,
      collection: null,
      connected: false,
      reason
    },
    async close() {
      return true;
    }
  };
}

function serializeNotification(document) {
  if (!document) {
    return null;
  }

  const { _id, ...notification } = document;
  return notification;
}
