export const systemRequirements = {
  architectureStyle: "Microservice + Event-driven",
  frontend: "ReactJS",
  backend: "Node.js",
  deployment: "Docker Swarm on VirtualBox",
  ciCd: "GitHub",
  communication: {
    external: ["REST"],
    internal: ["REST", "Kafka"]
  },
  security: {
    model: "Zero Trust",
    gatewayRole: "Policy Enforcement Point",
    internalTransport: "mTLS",
    iam: "Central Auth Service"
  },
  resilience: {
    scaling: "Horizontal Pod Autoscaling (HPA)",
    patterns: [
      "Circuit Breaker",
      "Retry / Timeout",
      "Graceful Degradation",
      "Eventual Consistency"
    ],
    asyncBackPressure: "Kafka"
  },
  ai: {
    applications: [
      "AI Driver Matching",
      "Surge Pricing",
      "ETA Prediction"
    ],
    platform: [
      "Feature Store",
      "Model Training",
      "Model Serving API"
    ]
  },
  principles: [
    "Database per service",
    "Stateless services",
    "Async-first (Event-driven)",
    "Zero trust security",
    "Observability by design"
  ]
};
