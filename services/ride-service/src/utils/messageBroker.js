import { Kafka } from 'kafkajs';

class MessageBroker {
    constructor() {
        const brokers = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092'];

        this.kafka = new Kafka({
            clientId: 'ride-service',
            brokers: brokers,
            retry: { initialRetryTime: 100, retries: 8 }
        });
        this.producer = this.kafka.producer();
    }

    async connect() {
        try {
            await this.producer.connect();
            console.log(`✅ [Kafka] Đã kết nối thành công tới ${process.env.KAFKA_BROKERS || 'kafka:9092'}`);
        } catch (error) {
            console.error('❌ [Kafka] Lỗi kết nối:', error.message);
        }
    }

    async publish(topic, message) {
        try {
            await this.producer.send({
                topic: topic,
                messages: [
                    { value: JSON.stringify(message) }
                ]
            });
            console.log(`📤 [Kafka] Đã bắn event [${message.event_type || 'unknown'}] tới topic [${topic}]`);
        } catch (error) {
            console.error(`❌ [Kafka] Lỗi publish event:`, error.message);
        }
    }
}

export default new MessageBroker();
