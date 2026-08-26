export const serviceManifests = {
  "pricing-service": {
    key: "pricing-service",
    displayName: "Pricing Service",
    port: 3101,
    gatewayPath: "/api/v1/pricing",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb", "redis"],
    publishes: [],
    consumes: []
  },
  "payment-service": {
    key: "payment-service",
    displayName: "Payment Service",
    port: 3102,
    gatewayPath: "/api/v1/payments",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb"],
    publishes: ["PaymentSuccess"],
    consumes: []
  },
  "booking-service": {
    key: "booking-service",
    displayName: "Booking Service",
    port: 3103,
    gatewayPath: "/api/v1/bookings",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb"],
    publishes: ["RideCreated"],
    consumes: []
  },
  "auth-service": {
    key: "auth-service",
    displayName: "Auth Service",
    port: 3104,
    gatewayPath: "/api/v1/auth",
    protocols: ["REST", "Kafka"],
    dataStores: ["postgresql"],
    publishes: [],
    consumes: []
  },
  "user-service": {
    key: "user-service",
    displayName: "User Service",
    port: 3105,
    gatewayPath: "/api/v1/users",
    protocols: ["REST", "Kafka"],
    dataStores: ["postgresql"],
    publishes: [],
    consumes: []
  },
  "review-service": {
    key: "review-service",
    displayName: "Review Service",
    port: 3106,
    gatewayPath: "/api/v1/reviews",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb"],
    publishes: ["ReviewCreated"],
    consumes: []
  },
  "driver-service": {
    key: "driver-service",
    displayName: "Driver Service",
    port: 3107,
    gatewayPath: "/api/v1/drivers",
    protocols: ["REST", "Kafka"],
    dataStores: ["postgresql", "redis"],
    publishes: ["DriverAssigned", "DriverLocationUpdated"],
    consumes: []
  },
  "matching-service": {
    key: "matching-service",
    displayName: "Matching Service",
    port: 8000,
    gatewayPath: "/api/v1/matching",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb", "redis"],
    publishes: ["DriverAssigned"],
    consumes: []
  },
  "surge-pricing-service": {
    key: "surge-pricing-service",
    displayName: "Surge Pricing Service",
    port: 8001,
    gatewayPath: "/internal/surge-pricing",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb", "redis"],
    publishes: ["SurgePriceUpdated"],
    consumes: ["DriverLocationUpdated"],
    exposeViaGateway: false
  },
  "notification-service": {
    key: "notification-service",
    displayName: "Notification Service",
    port: 3108,
    gatewayPath: "/api/v1/notifications",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb"],
    publishes: [],
    consumes: ["PaymentSuccess", "RideStatusChanged"]
  },
  "ride-service": {
    key: "ride-service",
    displayName: "Ride Service",
    port: 3109,
    gatewayPath: "/api/v1/rides",
    protocols: ["REST", "Kafka"],
    dataStores: ["mongodb", "redis"],
    publishes: ["RideStatusChanged"],
    consumes: ["RideCreated", "PaymentSuccess"]
  },
  "eta-service": {
    key: "eta-service",
    displayName: "ETA Service",
    port: 3110,
    gatewayPath: "/api/v1/eta",
    protocols: ["REST", "Kafka"],
    dataStores: ["redis"],
    publishes: ["EtaResult"],
    consumes: ["DriverLocationUpdated"]
  }
};

export function getServiceManifest(serviceKey) {
  return serviceManifests[serviceKey];
}
