export const resilienceTopology = {
  scope: "Scaling and Fault Tolerance",
  globalUsers: [
    "Users Region A",
    "Users Region B"
  ],
  globalEdge: {
    component: "Global Load Balancer",
    routing: [
      "Region A",
      "Region B"
    ]
  },
  regions: {
    "region-a": {
      displayName: "Region A",
      platform: "Docker Swarm Cluster A",
      scaling: {
        requestedPattern: "Horizontal Pod Autoscaling (HPA)",
        swarmMapping: "replica auto scaling policy",
        runtimeUnit: "service replicas"
      },
      workload: "Service Pods"
    },
    "region-b": {
      displayName: "Region B",
      platform: "Docker Swarm Cluster B",
      scaling: {
        requestedPattern: "Horizontal Pod Autoscaling (HPA)",
        swarmMapping: "replica auto scaling policy",
        runtimeUnit: "service replicas"
      },
      workload: "Service Pods"
    }
  },
  resiliencePatterns: {
    circuitBreaker: {
      enabled: true,
      placement: [
        "gateway-to-service",
        "service-to-service"
      ]
    },
    retryTimeout: {
      enabled: true,
      controls: [
        "retry",
        "timeout"
      ]
    },
    gracefulDegradation: {
      enabled: true,
      fallbackModes: [
        "cached response",
        "partial response",
        "queue for async handling"
      ]
    }
  },
  asyncBackPressure: {
    broker: "Kafka",
    patterns: [
      "eventual consistency",
      "async buffering",
      "back-pressure handling"
    ]
  },
  connections: [
    {
      source: "Users Region A",
      target: "Global Load Balancer",
      label: "global traffic"
    },
    {
      source: "Users Region B",
      target: "Global Load Balancer",
      label: "global traffic"
    },
    {
      source: "Global Load Balancer",
      target: "Region A",
      label: "regional routing"
    },
    {
      source: "Global Load Balancer",
      target: "Region B",
      label: "regional routing"
    },
    {
      source: "Region A",
      target: "Resilience Patterns",
      label: "circuit breaker / retry / graceful fallback"
    },
    {
      source: "Region B",
      target: "Resilience Patterns",
      label: "circuit breaker / retry / graceful fallback"
    },
    {
      source: "Region A",
      target: "Async & Back-pressure",
      label: "event-driven buffering"
    },
    {
      source: "Region B",
      target: "Async & Back-pressure",
      label: "event-driven buffering"
    }
  ]
};

export function getGatewayResilienceProfile() {
  return {
    globalEdge: resilienceTopology.globalEdge,
    patterns: resilienceTopology.resiliencePatterns,
    asyncBackPressure: resilienceTopology.asyncBackPressure
  };
}

export function getResilienceProfileForService(serviceKey) {
  return {
    service: serviceKey,
    scaling: {
      requestedPattern: "Horizontal Pod Autoscaling (HPA)",
      swarmMapping: "replica auto scaling policy"
    },
    patterns: resilienceTopology.resiliencePatterns,
    asyncBackPressure: resilienceTopology.asyncBackPressure
  };
}
