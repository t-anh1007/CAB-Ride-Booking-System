export const realtimeTopology = {
  layer: {
    key: "realtime-layer",
    displayName: "Real-time Layer",
    transport: "WebSocket / Socket.IO",
    gatewayEndpoint: "/realtime"
  },
  broker: {
    key: "kafka",
    displayName: "Event Broker",
    provider: "Kafka"
  },
  geoStore: {
    key: "redis-geo",
    displayName: "In-memory & Geo",
    provider: "Redis Geo"
  },
  clientApps: {
    "customer-app": {
      displayName: "Customer App",
      receives: ["RideUpdateEvent"]
    },
    "driver-app": {
      displayName: "Driver App",
      receives: ["RideUpdateEvent"],
      streams: ["GPSLocationStream"]
    }
  },
  serviceFlows: {
    "notification-service": {
      inbound: [],
      outbound: [
        {
          label: "RideUpdateEvent",
          target: "realtime-layer",
          channel: "WebSocket / Socket.IO"
        }
      ]
    },
    "driver-service": {
      inbound: [],
      outbound: [
        {
          label: "DriverAssigned",
          target: "kafka",
          channel: "Kafka"
        },
        {
          label: "DriverLocationUpdated",
          target: "kafka",
          channel: "Kafka"
        }
      ]
    },
    "ride-service": {
      inbound: [
        {
          label: "GPSLocationStream",
          source: "driver-app",
          channel: "WebSocket / Socket.IO"
        }
      ],
      outbound: [
        {
          label: "RideStatusChanged",
          target: "kafka",
          channel: "Kafka"
        },
        {
          label: "UpdateGeo",
          target: "redis-geo",
          channel: "Redis Geo"
        }
      ]
    }
  },
  connections: [
    {
      source: "notification-service",
      target: "realtime-layer",
      label: "RideUpdateEvent",
      type: "realtime-event"
    },
    {
      source: "driver-service",
      target: "kafka",
      label: "DriverAssigned",
      type: "broker-event"
    },
    {
      source: "driver-service",
      target: "kafka",
      label: "DriverLocationUpdated",
      type: "broker-event"
    },
    {
      source: "ride-service",
      target: "kafka",
      label: "RideStatusChanged",
      type: "broker-event"
    },
    {
      source: "ride-service",
      target: "redis-geo",
      label: "UpdateGeo",
      type: "geo-update"
    },
    {
      source: "driver-app",
      target: "ride-service",
      label: "GPSLocationStream",
      type: "client-stream"
    },
    {
      source: "realtime-layer",
      target: "customer-app",
      label: "RideUpdateEvent",
      type: "push-channel"
    },
    {
      source: "realtime-layer",
      target: "driver-app",
      label: "RideUpdateEvent",
      type: "push-channel"
    }
  ]
};

export function getRealtimeFlowsForService(serviceKey) {
  return realtimeTopology.serviceFlows[serviceKey] || {
    inbound: [],
    outbound: []
  };
}

export function getRealtimeCapabilitiesForClient(clientKey) {
  return realtimeTopology.clientApps[clientKey] || {
    receives: [],
    streams: []
  };
}
