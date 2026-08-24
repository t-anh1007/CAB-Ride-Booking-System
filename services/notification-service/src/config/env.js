export function getEnv() {
  return {
    port: Number.parseInt(process.env.PORT || '3108', 10),
    serviceName: 'notification-service',
    kafkaEnabled: String(process.env.KAFKA_ENABLED || 'false').toLowerCase() === 'true',
    kafkaClientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
    kafkaGroupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
    kafkaBrokers: String(process.env.KAFKA_BROKERS || '').split(',').map((item) => item.trim()).filter(Boolean),
    paymentTopic: process.env.KAFKA_PAYMENT_TOPIC || 'payment-events'
  };
}
