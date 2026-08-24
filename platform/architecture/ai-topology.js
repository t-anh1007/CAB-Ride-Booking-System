export const aiTopology = {
  scope: "AI and Machine Learning",
  useCases: [
    "AI Driver Matching",
    "Surge Pricing",
    "ETA Prediction"
  ],
  clientApps: {
    "driver-app": {
      displayName: "Driver App"
    },
    "customer-app": {
      displayName: "Customer App"
    }
  },
  coreServices: {
    "driver-service": {
      displayName: "Driver Service"
    },
    "booking-service": {
      displayName: "Booking Service"
    },
    "pricing-service": {
      displayName: "Pricing Service"
    }
  },
  dataSources: {
    gpsLocationData: {
      displayName: "GPS / Location Data"
    },
    tripHistory: {
      displayName: "Trip History"
    },
    ratingsFeedback: {
      displayName: "Ratings & Feedback"
    }
  },
  mlPlatform: {
    displayName: "ML Platform",
    featureStore: "Feature Store",
    modelTraining: "Model Training",
    modelServingApi: "Model Serving API"
  },
  aiLayer: {
    matchingService: {
      displayName: "Matching Service",
      purpose: "AI Driver Matching",
      inputs: [
        "GPS / Location Data",
        "Trip History",
        "Ratings & Feedback",
        "Driver Service",
        "Booking Service"
      ],
      output: "Best Driver"
    },
    etaPredictionModel: {
      displayName: "ETA Prediction Model",
      purpose: "ETA Prediction",
      inputs: [
        "GPS / Location Data",
        "Trip History",
        "Driver Service",
        "Booking Service"
      ],
      output: "ETA Result"
    },
    surgePricingService: {
      displayName: "Surge Pricing Service",
      purpose: "Dynamic Fare",
      inputs: [
        "Trip History",
        "Booking Service",
        "Pricing Service",
        "Driver Service"
      ],
      output: "Dynamic Fare"
    }
  },
  connections: [
    {
      source: "driver-app",
      target: "driver-service",
      label: "driver operations"
    },
    {
      source: "customer-app",
      target: "booking-service",
      label: "booking request"
    },
    {
      source: "booking-service",
      target: "pricing-service",
      label: "pricing request"
    },
    {
      source: "gpsLocationData",
      target: "matchingService",
      label: "location features"
    },
    {
      source: "tripHistory",
      target: "matchingService",
      label: "trip features"
    },
    {
      source: "ratingsFeedback",
      target: "matchingService",
      label: "behavior signals"
    },
    {
      source: "gpsLocationData",
      target: "etaPredictionModel",
      label: "location features"
    },
    {
      source: "tripHistory",
      target: "etaPredictionModel",
      label: "historical features"
    },
    {
      source: "tripHistory",
      target: "surgePricingService",
      label: "historical demand"
    },
    {
      source: "driver-service",
      target: "matchingService",
      label: "driver context"
    },
    {
      source: "booking-service",
      target: "matchingService",
      label: "ride request"
    },
    {
      source: "driver-service",
      target: "etaPredictionModel",
      label: "driver state"
    },
    {
      source: "booking-service",
      target: "etaPredictionModel",
      label: "ride context"
    },
    {
      source: "pricing-service",
      target: "surgePricingService",
      label: "pricing context"
    },
    {
      source: "booking-service",
      target: "surgePricingService",
      label: "demand context"
    },
    {
      source: "driver-service",
      target: "surgePricingService",
      label: "supply context"
    },
    {
      source: "gpsLocationData",
      target: "featureStore",
      label: "feature ingestion"
    },
    {
      source: "tripHistory",
      target: "featureStore",
      label: "feature ingestion"
    },
    {
      source: "ratingsFeedback",
      target: "featureStore",
      label: "feature ingestion"
    },
    {
      source: "featureStore",
      target: "modelTraining",
      label: "training features"
    },
    {
      source: "modelTraining",
      target: "modelServingApi",
      label: "trained models"
    },
    {
      source: "modelServingApi",
      target: "matchingService",
      label: "serving inference"
    },
    {
      source: "modelServingApi",
      target: "etaPredictionModel",
      label: "serving inference"
    },
    {
      source: "modelServingApi",
      target: "surgePricingService",
      label: "serving inference"
    },
    {
      source: "matchingService",
      target: "booking-service",
      label: "Best Driver"
    },
    {
      source: "surgePricingService",
      target: "pricing-service",
      label: "Dynamic Fare"
    },
    {
      source: "etaPredictionModel",
      target: "customer-app",
      label: "ETA Result"
    }
  ]
};

export function getAiGatewayProfile() {
  return {
    scope: aiTopology.scope,
    useCases: aiTopology.useCases,
    aiLayer: aiTopology.aiLayer,
    mlPlatform: aiTopology.mlPlatform
  };
}

export function getAiProfileForService(serviceKey) {
  if (serviceKey === "driver-service") {
    return {
      service: serviceKey,
      role: "AI feature provider",
      integrations: [
        "Matching Service",
        "ETA Prediction Model"
      ]
    };
  }

  if (serviceKey === "booking-service") {
    return {
      service: serviceKey,
      role: "AI orchestration entry point",
      integrations: [
        "Matching Service",
        "ETA Prediction Model",
        "Surge Pricing Service"
      ]
    };
  }

  if (serviceKey === "pricing-service") {
    return {
      service: serviceKey,
      role: "AI pricing consumer",
      integrations: [
        "Surge Pricing Service"
      ]
    };
  }

  return {
    service: serviceKey,
    role: "No direct AI integration in current architecture",
    integrations: []
  };
}
