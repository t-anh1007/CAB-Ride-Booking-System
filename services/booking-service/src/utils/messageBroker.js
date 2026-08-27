import { Kafka } from 'kafkajs';
import mongoose from 'mongoose';

function normalizePayload(payload) {
    return JSON.parse(JSON.stringify(payload));
}

const PUBLISH_TIMEOUT_MS = 500;
const DISPATCH_BATCH_SIZE = 100;
const DISPATCH_CAPACITY = 1000;
const DISPATCH_DELAY_MS = 5;
const CIRCUIT_OPEN_MS = 2000;
const REPLAY_INTERVAL_MS = 10000;

export class MessageBroker {
    constructor({
        producer = null,
        outboxCollection = null,
        now = () => new Date().toISOString(),
        clock = () => Date.now(),
        autoReplay = false,
        publishTimeoutMs = PUBLISH_TIMEOUT_MS,
        dispatchBatchSize = DISPATCH_BATCH_SIZE,
        dispatchCapacity = DISPATCH_CAPACITY,
        dispatchDelayMs = DISPATCH_DELAY_MS,
        circuitOpenMs = CIRCUIT_OPEN_MS,
        replayIntervalMs = REPLAY_INTERVAL_MS
    } = {}) {
        const brokers = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092'];
        this.kafka = producer ? null : new Kafka({
            clientId: 'booking-service',
            brokers,
            connectionTimeout: 300,
            requestTimeout: 300,
            retry: { initialRetryTime: 100, retries: 0 }
        });
        this.producer = producer || this.kafka.producer();
        this.outboxCollection = outboxCollection;
        this.now = now;
        this.clock = clock;
        this.autoReplay = autoReplay;
        this.publishTimeoutMs = positiveNumber(publishTimeoutMs, PUBLISH_TIMEOUT_MS);
        this.dispatchBatchSize = positiveInteger(dispatchBatchSize, DISPATCH_BATCH_SIZE);
        this.dispatchCapacity = positiveInteger(dispatchCapacity, DISPATCH_CAPACITY);
        this.dispatchDelayMs = nonNegativeNumber(dispatchDelayMs, DISPATCH_DELAY_MS);
        this.circuitOpenMs = positiveNumber(circuitOpenMs, CIRCUIT_OPEN_MS);
        this.replayIntervalMs = positiveNumber(replayIntervalMs, REPLAY_INTERVAL_MS);
        this.queue = [];
        this.inFlightCount = 0;
        this.circuitOpenUntil = 0;
        this.dispatchTimer = null;
        this.replayTimer = null;
        this.dispatchPromise = null;
        this.flushPromise = null;
        this.closed = false;
    }

    async connect() {
        try {
            await this.producer.connect();
        } catch (error) {
            console.error('Booking Kafka connect failed:', error.message);
        } finally {
            this.startAutoReplay();
        }
    }

    startAutoReplay() {
        if (!this.autoReplay || this.replayTimer) return;
        this.replayTimer = setInterval(() => {
            this.flushOutbox().catch((error) => console.error('Booking outbox replay failed:', error.message));
        }, this.replayIntervalMs);
        this.replayTimer.unref?.();
    }

    createEntry(topic, payload) {
        return { topic, payload: normalizePayload(payload), createdAt: this.now() };
    }

    publish(topic, payload) {
        const entry = this.createEntry(topic, payload);
        if (this.closed || this.isCircuitOpen() || this.queue.length + this.inFlightCount >= this.dispatchCapacity) {
            return this.persistEntries([entry]).then(() => ({ published: false, buffered: true, queued: false }));
        }

        this.queue.push(entry);
        this.scheduleDrain();
        return { published: false, buffered: false, queued: true };
    }

    scheduleDrain() {
        if (this.closed || this.dispatchTimer || this.dispatchPromise) return;
        const delayMs = this.isCircuitOpen()
            ? Math.max(this.dispatchDelayMs, this.circuitOpenUntil - this.clock())
            : this.dispatchDelayMs;
        this.dispatchTimer = setTimeout(() => {
            this.dispatchTimer = null;
            this.drainQueue().catch((error) => console.error('Booking dispatcher drain failed:', error.message));
        }, delayMs);
        this.dispatchTimer.unref?.();
    }

    async drainQueue() {
        if (this.dispatchPromise) return this.dispatchPromise;
        this.dispatchPromise = (async () => {
            if (this.flushPromise) await this.flushPromise;
            return this.processQueue();
        })();
        try {
            return await this.dispatchPromise;
        } finally {
            this.dispatchPromise = null;
            if (this.queue.length > 0 && !this.closed) this.scheduleDrain();
        }
    }

    async processQueue() {
        const result = { published: 0, buffered: 0 };
        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.dispatchBatchSize);
            this.inFlightCount = batch.length;
            try {
                if (this.isCircuitOpen()) {
                    await this.persistOrRequeue(batch);
                    result.buffered += batch.length;
                    continue;
                }

                const groups = groupByTopic(batch);
                for (let index = 0; index < groups.length; index += 1) {
                    const group = groups[index];
                    if (this.isCircuitOpen()) {
                        const remaining = groups.slice(index).flatMap((item) => item.entries);
                        await this.persistOrRequeue(remaining);
                        result.buffered += remaining.length;
                        break;
                    }

                    try {
                        await this.sendWithBudget({
                            topic: group.topic,
                            messages: group.entries.map((entry) => ({
                                ...(entry.payload?.eventId ? { key: String(entry.payload.eventId) } : {}),
                                value: JSON.stringify(entry.payload)
                            }))
                        });
                        result.published += group.entries.length;
                    } catch (error) {
                        this.openCircuit();
                        const remaining = groups.slice(index).flatMap((item) => item.entries);
                        await this.persistOrRequeue(remaining);
                        result.buffered += remaining.length;
                        break;
                    }
                }
            } finally {
                this.inFlightCount = 0;
            }
        }
        return result;
    }

    async persistOrRequeue(entries) {
        let persisted = 0;
        try {
            for (const entry of entries) {
                await this.persistEntries([entry]);
                persisted += 1;
            }
        } catch (error) {
            this.queue.unshift(...entries.slice(persisted));
            throw error;
        }
    }

    async persistEntries(entries) {
        if (entries.length === 0) return;
        const outbox = await this.getOutboxCollection();
        if (!outbox) throw new Error('Booking dispatcher cannot spill without an outbox collection');
        const records = entries.map((entry) => ({
            topic: entry.topic,
            payload: normalizePayload(entry.payload),
            createdAt: entry.createdAt
        }));
        for (const record of records) await outbox.insertOne(record);
    }

    isCircuitOpen() {
        return this.clock() < this.circuitOpenUntil;
    }

    openCircuit() {
        this.circuitOpenUntil = this.clock() + this.circuitOpenMs;
    }

    async getOutboxCollection() {
        if (this.outboxCollection) return this.outboxCollection;
        if (!mongoose.connection?.db) return null;
        this.outboxCollection = mongoose.connection.db.collection('outbox_events');
        return this.outboxCollection;
    }

    async sendWithBudget(batch) {
        let timeout;
        try {
            return await Promise.race([
                this.producer.send(batch),
                new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new Error(`Booking Kafka publish exceeded ${this.publishTimeoutMs}ms`)), this.publishTimeoutMs);
                })
            ]);
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }

    async flushOutbox() {
        if (this.flushPromise) return this.flushPromise;
        this.flushPromise = (async () => {
            if (this.dispatchPromise) await this.dispatchPromise;
            if (this.isCircuitOpen()) return { published: 0 };
            return this.replayOutbox();
        })();
        try {
            return await this.flushPromise;
        } finally {
            this.flushPromise = null;
        }
    }

    async replayOutbox() {
        const outbox = await this.getOutboxCollection();
        if (!outbox) return { published: 0 };
        let published = 0;
        while (true) {
            let cursor = outbox.find({}).sort({ createdAt: 1, _id: 1 });
            if (typeof cursor.limit === 'function') cursor = cursor.limit(this.dispatchBatchSize);
            const records = (await cursor.toArray()).slice(0, this.dispatchBatchSize);
            if (records.length === 0) break;

            for (const group of groupByTopic(records)) {
                try {
                    await this.sendWithBudget({
                        topic: group.topic,
                        messages: group.entries.map((record) => ({
                            ...(record.payload?.eventId ? { key: String(record.payload.eventId) } : {}),
                            value: JSON.stringify(record.payload)
                        }))
                    });
                    published += await this.deletePublished(outbox, group.entries);
                } catch (error) {
                    this.openCircuit();
                    return { published };
                }
            }
        }
        return { published };
    }

    async deletePublished(outbox, records) {
        const ids = records.map((record) => record._id);
        if (typeof outbox.deleteMany === 'function') {
            const deletion = await outbox.deleteMany({ _id: { $in: ids } });
            return deletion.deletedCount || 0;
        }
        let deleted = 0;
        for (const id of ids) {
            const deletion = await outbox.deleteOne({ _id: id });
            deleted += deletion.deletedCount || 0;
        }
        return deleted;
    }

    async close() {
        this.closed = true;
        if (this.dispatchTimer) clearTimeout(this.dispatchTimer);
        if (this.replayTimer) clearInterval(this.replayTimer);
        this.dispatchTimer = null;
        this.replayTimer = null;
        if (this.queue.length > 0) await this.drainQueue();
        await this.dispatchPromise?.catch(() => {});
        await this.flushPromise?.catch(() => {});
        if (this.queue.length > 0 || this.inFlightCount > 0) {
            throw new Error('Booking dispatcher closed with unspilled events');
        }
        await this.producer.disconnect?.();
    }
}

function groupByTopic(entries) {
    const groups = new Map();
    for (const entry of entries) {
        const values = groups.get(entry.topic) || [];
        values.push(entry);
        groups.set(entry.topic, values);
    }
    return [...groups].map(([topic, groupedEntries]) => ({ topic, entries: groupedEntries }));
}

function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function positiveNumber(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export default new MessageBroker({ autoReplay: true });
