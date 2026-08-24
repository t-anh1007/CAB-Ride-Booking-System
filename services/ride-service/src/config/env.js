export function getEnv() {
  return {
    port: Number.parseInt(process.env.PORT || '3105', 10),
    serviceName: 'ride-service',
    kafkaEnabled: String(process.env.KAFKA_ENABLED || 'false').toLowerCase() === 'true',
    kafkaClientId: process.env.KAFKA_CLIENT_ID || 'ride-service',
    kafkaGroupId: process.env.KAFKA_GROUP_ID || 'ride-service-group',
    kafkaBrokers: String(process.env.KAFKA_BROKERS || '').split(',').map((item) => item.trim()).filter(Boolean),
    paymentTopic: process.env.KAFKA_PAYMENT_TOPIC || 'payment-events'
  };
}
