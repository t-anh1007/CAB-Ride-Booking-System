import { Kafka } from 'kafkajs';
import mongoose from 'mongoose';

function normalizePayload(payload) {
    return JSON.parse(JSON.stringify(payload));
}

export class MessageBroker {
    constructor({ producer = null, outboxCollection = null, now = () => new Date().toISOString(), autoReplay = false } = {}) {
        const brokers = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092'];
        this.kafka = producer ? null : new Kafka({
            clientId: 'booking-service',
            brokers,
            retry: { initialRetryTime: 100, retries: 8 }
        });
        this.producer = producer || this.kafka.producer();
        this.outboxCollection = outboxCollection;
        this.now = now;
        this.autoReplay = autoReplay;
        this.replayTimer = null;
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
        }, 10000);
        this.replayTimer.unref?.();
    }

    async getOutboxCollection() {
        if (this.outboxCollection) return this.outboxCollection;
        if (!mongoose.connection?.db) return null;
        this.outboxCollection = mongoose.connection.db.collection('outbox_events');
        return this.outboxCollection;
    }

    async publish(topic, payload) {
        try {
            await this.producer.send({ topic, messages: [{ value: JSON.stringify(payload) }] });
            return { published: true, buffered: false };
        } catch (error) {
            const outbox = await this.getOutboxCollection();
            if (!outbox) {
                console.error('Booking Kafka publish failed without outbox:', error.message);
                return { published: false, buffered: false };
            }
            await outbox.insertOne({ topic, payload: normalizePayload(payload), createdAt: this.now() });
            return { published: false, buffered: true };
        }
    }

    async flushOutbox() {
        const outbox = await this.getOutboxCollection();
        if (!outbox) return { published: 0 };
        const records = await outbox.find({}).sort({ createdAt: 1, _id: 1 }).toArray();
        let published = 0;
        for (const record of records) {
            try {
                await this.producer.send({ topic: record.topic, messages: [{ value: JSON.stringify(record.payload) }] });
                const deletion = await outbox.deleteOne({ _id: record._id });
                if (deletion.deletedCount === 1) published += 1;
            } catch (error) {
                break;
            }
        }
        return { published };
    }

    async close() {
        if (this.replayTimer) clearInterval(this.replayTimer);
        this.replayTimer = null;
        await this.producer.disconnect?.();
    }
}

export default new MessageBroker({ autoReplay: true });
