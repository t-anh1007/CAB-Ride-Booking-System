import { serviceManifests } from "../../../platform/architecture/service-manifests.js";
import { httpSchemas } from "./validation-schemas.js";

const familyRoleMap = {
  "auth-service": ["Customer", "Driver", "Admin"],
  "user-service": ["Customer", "Driver", "Admin"],
  "driver-service": ["Driver", "Admin"],
  "booking-service": ["Customer", "Admin"],
  "ride-service": ["Customer", "Driver", "Admin"],
  "pricing-service": ["Customer", "Driver", "Admin"],
  "matching-service": ["Customer", "Driver", "Admin"],
  "payment-service": ["Customer", "Admin"],
  "notification-service": ["Customer", "Driver", "Admin"],
  "review-service": ["Customer", "Driver", "Admin"],
  "eta-service": ["Customer", "Driver", "Admin"]
};

export function createRouteRegistry({ env = process.env, upstreamTimeoutMs = 5000 } = {}) {
  const families = Object.values(serviceManifests)
    .filter((manifest) => manifest.exposeViaGateway !== false)
    .map((manifest) => ({
    familyKey: manifest.gatewayPath.replace("/api/v1/", ""),
    prefix: manifest.gatewayPath,
    serviceKey: manifest.key,
    upstreamUrl: env[buildTargetEnvName(manifest.key)] || `http://localhost:${manifest.port}`,
    authRequired: true,
    allowedRoles: familyRoleMap[manifest.key] || [],
    timeoutMs: upstreamTimeoutMs
  }));

  const authRatePolicy = createRatePolicy("auth", 100, 60_000, "ip");

  const policies = [
    {
      key: "auth-health",
      method: "GET",
      path: "/api/v1/auth/health",
      authRequired: false,
      rateLimit: null
    },
    {
      key: "auth-register",
      method: "POST",
      path: "/api/v1/auth/register",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authRegister
    },
    {
      key: "auth-login",
      method: "POST",
      path: "/api/v1/auth/login",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.login
    },
    {
      key: "auth-otp-request",
      method: "POST",
      path: "/api/v1/auth/login/otp/request",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authOtpRequest
    },
    {
      key: "auth-otp-verify",
      method: "POST",
      path: "/api/v1/auth/login/otp/verify",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authOtpVerify
    },
    {
      key: "auth-admin-login",
      method: "POST",
      path: "/api/v1/auth/login/admin",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authAdminLogin
    },
    {
      key: "auth-mfa-challenge",
      method: "POST",
      path: "/api/v1/auth/mfa/challenge",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authMfaChallenge
    },
    {
      key: "auth-refresh",
      method: "POST",
      path: "/api/v1/auth/refresh",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.refresh
    },
    {
      key: "auth-oauth-token",
      method: "POST",
      path: "/api/v1/auth/oauth/token",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authOauthToken
    },
    {
      key: "auth-logout",
      method: "POST",
      path: "/api/v1/auth/logout",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authLogout
    },
    {
      key: "auth-oauth-revoke",
      method: "POST",
      path: "/api/v1/auth/oauth/revoke",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authOauthRevoke
    },
    {
      key: "auth-logout-all",
      method: "POST",
      path: "/api/v1/auth/logout-all",
      authRequired: false,
      rateLimit: authRatePolicy,
      validationSchema: httpSchemas.authLogout
    },
    {
      key: "booking-create",
      method: "POST",
      path: "/api/v1/bookings",
      allowedRoles: ["Customer", "Admin"],
      rateLimit: createRatePolicy("booking-create", 10, 10_000, "user-or-ip"),
      quota: createQuotaPolicy("booking-create-daily", 100, 24 * 60 * 60_000, "user-or-ip"),
      validationSchema: httpSchemas.bookingCreate,
      idempotency: {
        required: true,
        ttlMs: 15 * 60_000
      }
    },
    {
      key: "user-list",
      method: "GET",
      path: "/api/v1/users",
      allowedRoles: ["Admin"],
      requiredScopes: ["admin:all"],
      rateLimit: createRatePolicy("user-list", 60, 60_000, "user-or-ip")
    },
    {
      key: "ride-create",
      method: "POST",
      path: "/api/v1/rides",
      allowedRoles: ["Customer", "Admin"],
      rateLimit: createRatePolicy("ride-create", 10, 10_000, "user-or-ip"),
      quota: createQuotaPolicy("ride-create-daily", 120, 24 * 60 * 60_000, "user-or-ip")
    },
    {
      key: "ride-stats",
      method: "GET",
      path: "/api/v1/rides/stats",
      allowedRoles: ["Admin"],
      requiredScopes: ["admin:all"],
      rateLimit: createRatePolicy("ride-stats", 30, 60_000, "user-or-ip")
    },
    {
      key: "ride-location-update",
      method: "POST",
      pathRegex: /^\/api\/v1\/rides\/[^/]+\/location$/,
      allowedRoles: ["Driver", "Admin"],
      requiredPermissions: ["location:update:assigned"],
      rateLimit: createRatePolicy("ride-location-update", 30, 10_000, "user-or-ip")
    },
    {
      key: "payment-create",
      method: "POST",
      path: "/api/v1/payments",
      allowedRoles: ["Customer", "Admin"],
      rateLimit: createRatePolicy("payment-create", 10, 10_000, "user-or-ip"),
      quota: createQuotaPolicy("payment-create-daily", 60, 24 * 60 * 60_000, "user-or-ip"),
      validationSchema: httpSchemas.paymentCreate,
      idempotency: {
        required: true,
        ttlMs: 24 * 60 * 60_000
      }
    }
  ];

  return {
    resolve(request) {
      const pathname = extractPathname(request.originalUrl || request.url || "/");
      const family = families.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
      const policy = findMatchingPolicy(policies, request.method, pathname);
      const isApiRoute = pathname.startsWith("/api/v1/");

      return {
        key: policy?.key || family?.familyKey || (isApiRoute ? "unmapped-api-route" : "public"),
        isApiRoute,
        pathname,
        serviceKey: family?.serviceKey || null,
        upstreamUrl: family?.upstreamUrl || null,
        authRequired: policy?.authRequired ?? family?.authRequired ?? false,
        allowedRoles: policy?.allowedRoles ?? family?.allowedRoles ?? [],
        requiredScopes: policy?.requiredScopes ?? [],
        requiredPermissions: policy?.requiredPermissions ?? [],
        rateLimit: policy?.rateLimit ?? (pathname.startsWith("/api/v1/auth/") ? authRatePolicy : null),
        quota: policy?.quota ?? null,
        validationSchema: policy?.validationSchema ?? null,
        idempotency: policy?.idempotency ?? null,
        timeoutMs: family?.timeoutMs || upstreamTimeoutMs
      };
    }
  };
}

function createRatePolicy(name, limit, windowMs, identity) {
  return {
    name,
    limit,
    windowMs,
    identity
  };
}

function createQuotaPolicy(name, limit, windowMs, identity) {
  return {
    name,
    limit,
    windowMs,
    identity
  };
}

function extractPathname(urlLike) {
  return new URL(urlLike, "http://gateway.local").pathname;
}

function findMatchingPolicy(policies, method, pathname) {
  return policies.find((item) => {
    if (item.method !== method) {
      return false;
    }

    if (item.path) {
      return item.path === pathname;
    }

    if (item.pathRegex) {
      return item.pathRegex.test(pathname);
    }

    return false;
  });
}

function buildTargetEnvName(serviceName) {
  return serviceName.toUpperCase().replace(/-/g, "_") + "_URL";
}
