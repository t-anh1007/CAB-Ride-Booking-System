import { randomUUID } from "node:crypto";
import { mapDomainEventToNotificationCommand } from "./event-mapper.js";

const DEFAULT_CHANNEL = "push";
const SUPPORTED_CHANNELS = new Set(["push", "email", "sms"]);
const SUPPORTED_STATUSES = new Set(["PENDING", "SENT", "FAILED"]);

export class NotificationValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "NotificationValidationError";
    this.details = details;
  }
}

export class NotificationService {
  constructor({
    repository,
    dispatcher,
    logger = console,
    clock = () => new Date(),
    maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 3),
    baseRetryDelayMs = Number(process.env.NOTIFICATION_RETRY_BASE_MS || 200),
    dedupeWindowMs = Number(process.env.NOTIFICATION_DEDUPE_WINDOW_MS || 5 * 60_000)
  }) {
    this.repository = repository;
    this.dispatcher = dispatcher;
    this.logger = logger;
    this.clock = clock;
    this.maxAttempts = Math.max(maxAttempts, 1);
    this.baseRetryDelayMs = Math.max(baseRetryDelayMs, 10);
    this.dedupeWindowMs = Math.max(dedupeWindowMs, 0);
    this.timers = new Map();
  }

  async submitNotification(input, { source = "internal-api" } = {}) {
    const normalized = normalizeNotificationInput(input);
    const now = this.clock().toISOString();
    const idempotencyKey = normalized.idempotencyKey || buildDerivedDedupeKey(normalized);
    const duplicate = await this.findActiveDuplicate(idempotencyKey, now);

    if (duplicate) {
      return {
        notification: duplicate,
        duplicate: true
      };
    }

    const notification = await this.repository.create({
      id: randomUUID(),
      userId: normalized.userId,
      type: normalized.type,
      title: normalized.title,
      message: normalized.message,
      channel: normalized.channel,
      status: "PENDING",
      source,
      relatedEntityType: normalized.relatedEntityType,
      relatedEntityId: normalized.relatedEntityId,
      destination: normalized.destination,
      metadata: normalized.metadata,
      idempotencyKey,
      attemptCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      nextRetryAt: null,
      delivery: null
    });

    this.scheduleDelivery(notification.id, 0);

    return {
      notification,
      duplicate: false
    };
  }

  async listNotifications(filters) {
    const userId = String(filters?.userId || "").trim();

    if (!userId) {
      throw new NotificationValidationError("userId is required");
    }

    const normalizedFilters = {
      userId,
      status: normalizeOptionalStatus(filters?.status),
      channel: normalizeOptionalChannel(filters?.channel),
      type: normalizeOptionalString(filters?.type),
      limit: filters?.limit
    };

    return this.repository.list(normalizedFilters);
  }

  async processDomainEvent(envelope) {
    this.logger.log?.(`💎 [NotificationService] Processing event: ${JSON.stringify(envelope)}`);
    const command = mapDomainEventToNotificationCommand(envelope);

    if (!command) {
      return {
        accepted: false,
        reason: "unsupported-event"
      };
    }

    let result;

    try {
      result = await this.submitNotification(command, {
        source: envelope?.topic || envelope?.type || "domain-event"
      });
    } catch (error) {
      if (error instanceof NotificationValidationError) {
        this.logger.warn?.(`[notification-service] ignored invalid domain event: ${error.message}`);

        return {
          accepted: false,
          reason: "invalid-event-payload"
        };
      }

      throw error;
    }

    return {
      accepted: true,
      duplicate: result.duplicate,
      notification: result.notification
    };
  }

  async stop() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  scheduleDelivery(notificationId, delayMs) {
    const existingTimer = this.timers.get(notificationId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.timers.delete(notificationId);

      try {
        await this.deliverNotification(notificationId);
      } catch (error) {
        this.logger.error?.(`[notification-service] failed to process ${notificationId}: ${error.message}`);
      }
    }, delayMs);

    this.timers.set(notificationId, timer);
  }

  async deliverNotification(notificationId) {
    const notification = await this.repository.getById(notificationId);

    if (!notification || notification.status === "SENT") {
      return notification;
    }

    const nextAttempt = notification.attemptCount + 1;

    try {
      const delivery = await this.dispatcher.dispatch(notification);

      return this.repository.update(notificationId, {
        status: "SENT",
        attemptCount: nextAttempt,
        lastError: null,
        nextRetryAt: null,
        delivery,
        sentAt: this.clock().toISOString()
      });
    } catch (error) {
      const shouldRetry = nextAttempt < this.maxAttempts;
      const nextRetryAt = shouldRetry ? new Date(this.clock().getTime() + this.getRetryDelayMs(nextAttempt)).toISOString() : null;
      const status = shouldRetry ? "PENDING" : "FAILED";

      const updated = await this.repository.update(notificationId, {
        status,
        attemptCount: nextAttempt,
        lastError: error.message,
        nextRetryAt
      });

      if (shouldRetry) {
        this.scheduleDelivery(notificationId, this.getRetryDelayMs(nextAttempt));
      }

      return updated;
    }
  }

  getRetryDelayMs(attemptNumber) {
    return this.baseRetryDelayMs * Math.pow(2, Math.max(attemptNumber - 1, 0));
  }

  async findActiveDuplicate(idempotencyKey, nowIsoString) {
    if (!idempotencyKey) {
      return null;
    }

    const existing = await this.repository.getByIdempotencyKey(idempotencyKey);

    if (!existing) {
      return null;
    }

    const ageMs = new Date(nowIsoString).getTime() - new Date(existing.createdAt).getTime();

    if (ageMs > this.dedupeWindowMs) {
      return null;
    }

    if (existing.status === "FAILED") {
      return null;
    }

    return existing;
  }
}

function normalizeNotificationInput(input) {
  const payload = input && typeof input === "object" ? input : {};
  const userId = normalizeRequiredString(payload.userId, "userId");
  const channel = normalizeChannel(payload.channel || DEFAULT_CHANNEL);
  const title = normalizeRequiredString(payload.title, "title");
  const message = normalizeRequiredString(payload.message, "message");
  const type = normalizeRequiredString(payload.type, "type").toUpperCase();
  const relatedEntityType = normalizeOptionalString(payload.relatedEntityType)?.toUpperCase() || null;
  const relatedEntityId = normalizeOptionalString(payload.relatedEntityId) || null;
  const idempotencyKey = normalizeOptionalString(payload.idempotencyKey) || null;
  const metadata = sanitizeObject(payload.metadata);
  const destination = sanitizeObject(payload.destination);

  if (channel === "email" && !destination.email) {
    throw new NotificationValidationError("destination.email is required for email notifications");
  }

  if (channel === "sms" && !destination.phoneNumber) {
    throw new NotificationValidationError("destination.phoneNumber is required for sms notifications");
  }

  return {
    userId,
    type,
    title,
    message,
    channel,
    relatedEntityType,
    relatedEntityId,
    idempotencyKey,
    metadata,
    destination
  };
}

function normalizeRequiredString(value, fieldName) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new NotificationValidationError(`${fieldName} is required`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  const normalized = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return normalized || null;
}

function normalizeChannel(value) {
  const normalized = String(value || DEFAULT_CHANNEL).trim().toLowerCase();

  if (!SUPPORTED_CHANNELS.has(normalized)) {
    throw new NotificationValidationError(`channel must be one of ${Array.from(SUPPORTED_CHANNELS).join(", ")}`);
  }

  return normalized;
}

function normalizeOptionalChannel(value) {
  if (!value) {
    return null;
  }

  return normalizeChannel(value);
}

function normalizeOptionalStatus(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();

  if (!SUPPORTED_STATUSES.has(normalized)) {
    throw new NotificationValidationError(`status must be one of ${Array.from(SUPPORTED_STATUSES).join(", ")}`);
  }

  return normalized;
}

function sanitizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function buildDerivedDedupeKey(input) {
  const parts = [
    input.userId,
    input.type,
    input.channel,
    input.relatedEntityType || "NONE",
    input.relatedEntityId || input.message
  ];

  return parts.join(":");
}
