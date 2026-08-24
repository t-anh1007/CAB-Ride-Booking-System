export const securityTopology = {
  model: "Zero Trust",
  principles: [
    "Never trust, always verify",
    "Every request must be authenticated and authorized",
    "No implicit trust for internal network traffic"
  ],
  trustPath: [
    "client",
    "edge",
    "api-gateway",
    "microservices",
    "data"
  ],
  clientAndEdge: {
    transport: "HTTPS/TLS 1.3",
    controls: {
      waf: [
        "SQL Injection",
        "XSS",
        "DDoS layer 7"
      ],
      rateLimiting: [
        "IP",
        "user",
        "device"
      ],
      deviceFingerprinting: "optional"
    }
  },
  gateway: {
    role: "Policy Enforcement Point",
    authn: [
      "JWT",
      "OAuth2"
    ],
    authzChecks: [
      "scope",
      "role",
      "permission"
    ],
    controls: [
      "rate limit",
      "quota",
      "schema validation",
      "abnormal request blocking"
    ]
  },
  serviceToService: {
    transportSecurity: "mTLS",
    serviceIdentity: "per-service identity",
    enforcementPlane: "Service Mesh",
    meshOptions: [
      "Istio",
      "Linkerd"
    ],
    outcomes: [
      "prevent lateral movement",
      "mutual authentication",
      "encrypted internal traffic"
    ]
  },
  authorization: {
    models: [
      "RBAC",
      "ABAC"
    ],
    rbacRoles: [
      "Customer",
      "Driver",
      "Admin"
    ],
    abacAttributes: [
      "time",
      "location",
      "ride status"
    ],
    example: "Driver can update GPS only when ride status is ACTIVE"
  },
  iam: {
    authority: "auth-service",
    tokens: {
      accessToken: "short-lived JWT",
      refreshToken: true,
      rotation: true,
      revocation: "Redis blacklist"
    },
    admin: {
      mfa: true
    }
  },
  secrets: {
    hardCodedSecrets: false,
    managers: [
      "HashiCorp Vault",
      "Cloud Secret Manager"
    ],
    keyRotation: "periodic",
    sensitiveDomains: [
      "PII",
      "payment"
    ]
  },
  dataSecurity: {
    encryption: [
      "at-rest",
      "in-transit"
    ],
    masking: true,
    databasePerService: true,
    compliance: [
      "GDPR",
      "PDPA"
    ]
  },
  auditAndDetection: {
    auditEvents: [
      "login",
      "payment",
      "permission change"
    ],
    centralizedLogging: [
      "ELK",
      "OpenSearch"
    ],
    siem: true,
    realTimeAlerts: true
  },
  failureScenarioMapping: [
    {
      risk: "Token leakage",
      controls: [
        "token rotation",
        "token revocation"
      ]
    },
    {
      risk: "Service compromise",
      controls: [
        "mTLS",
        "service isolation"
      ]
    },
    {
      risk: "Lateral movement",
      controls: [
        "service identity"
      ]
    },
    {
      risk: "Insider threat",
      controls: [
        "audit",
        "SIEM"
      ]
    },
    {
      risk: "DDoS",
      controls: [
        "WAF",
        "rate limit"
      ]
    }
  ]
};

export function getGatewaySecurityProfile() {
  return {
    model: securityTopology.model,
    role: securityTopology.gateway.role,
    authn: securityTopology.gateway.authn,
    authzChecks: securityTopology.gateway.authzChecks,
    controls: securityTopology.gateway.controls
  };
}

export function getSecurityProfileForService(serviceKey) {
  const baseProfile = {
    model: securityTopology.model,
    internalTransportSecurity: securityTopology.serviceToService.transportSecurity,
    serviceIdentity: securityTopology.serviceToService.serviceIdentity,
    authorizationModels: securityTopology.authorization.models,
    secretsManagement: securityTopology.secrets.managers,
    dataProtection: securityTopology.dataSecurity.encryption
  };

  if (serviceKey === "auth-service") {
    return {
      ...baseProfile,
      capabilities: [
        "central auth authority",
        "short-lived JWT",
        "refresh token",
        "token rotation",
        "token revocation",
        "admin MFA"
      ]
    };
  }

  if (serviceKey === "driver-service") {
    return {
      ...baseProfile,
      abacExample: securityTopology.authorization.example
    };
  }

  return baseProfile;
}
