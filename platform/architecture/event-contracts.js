export const brokerTopology = {
  provider: "Kafka",
  brokersEnv: "KAFKA_BROKERS",
  events: {
    PaymentSuccess: {
      topic: "payment.success",
      producer: "payment-service"
    },
    RideCreated: {
      topic: "ride.created",
      producer: "booking-service"
    },
    DriverAssigned: {
      topic: "driver.assigned",
      producer: "driver-service"
    },
    DriverLocationUpdated: {
      topic: "driver.location.updated",
      producer: "driver-service"
    },
    RideStatusChanged: {
      topic: "ride.status.changed",
      producer: "ride-service"
    }
  }
};
