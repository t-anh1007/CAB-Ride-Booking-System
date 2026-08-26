import { aiTopology } from "./ai-topology.js";
import { brokerTopology } from "./event-contracts.js";
import { realtimeTopology } from "./realtime-topology.js";
import { resilienceTopology } from "./resilience-topology.js";
import { securityTopology } from "./security-topology.js";
import { serviceManifests } from "./service-manifests.js";
import { systemRequirements } from "./system-requirements.js";

export const topology = {
  requirements: systemRequirements,
  clients: {
    "admin-dashboard": {
      framework: "ReactJS",
      protocols: ["HTTPS"],
      gateway: "api-gateway"
    },
    "customer-app": {
      framework: "ReactJS",
      protocols: ["HTTPS", "WebSocket"],
      gateway: "api-gateway"
    },
    "driver-app": {
      framework: "ReactJS",
      protocols: ["HTTPS", "WebSocket"],
      gateway: "api-gateway"
    }
  },
  gateway: {
    key: "api-gateway",
    runtime: "Node.js",
    protocols: {
      external: ["REST", "WebSocket"],
      internal: ["REST"]
    },
    aiLayerScope: aiTopology.scope,
    securityRole: securityTopology.gateway.role,
    resilienceScope: resilienceTopology.scope,
    realtimeLayer: realtimeTopology.layer.key,
    upstreams: Object.values(serviceManifests).map((service) => ({
      service: service.key,
      path: service.gatewayPath,
      target: `http://localhost:${service.port}`
    }))
  },
  services: serviceManifests,
  ai: aiTopology,
  realtime: realtimeTopology,
  resilience: resilienceTopology,
  security: securityTopology,
  dataLayer: {
    postgresql: ["pricing-service", "payment-service", "auth-service", "user-service", "driver-service"],
    mongodb: ["booking-service", "review-service", "notification-service", "ride-service"],
    redis: ["driver-service", "ride-service"]
  },
  broker: brokerTopology
};
