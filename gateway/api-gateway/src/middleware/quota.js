import { GatewayError } from "../errors.js";

export function createQuotaMiddleware({ store }) {
  return async function quotaMiddleware(request, response, next) {
    try {
      const policy = request.routeConfig?.quota;
      if (!request.routeConfig?.isApiRoute || !policy) {
        return next();
      }

      const identity = buildQuotaIdentity(request, policy.identity);
      const key = `quota:${policy.name}:${identity}`;
      const result = await store.incrementCounter(key, policy.windowMs);

      response.setHeader("x-quota-limit", String(policy.limit));
      response.setHeader("x-quota-remaining", String(Math.max(policy.limit - result.count, 0)));

      if (result.count > policy.limit) {
        const retryAfterSeconds = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
        response.setHeader("Retry-After", String(retryAfterSeconds));
        throw new GatewayError(429, "QUOTA_EXCEEDED", "Usage quota exceeded", {
          data: {
            retryAfterSeconds
          },
          headers: {
            "Retry-After": String(retryAfterSeconds)
          }
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function buildQuotaIdentity(request, identityType) {
  if (identityType === "user" || identityType === "user-or-ip") {
    return request.auth?.userId || request.context.clientIp;
  }

  return request.context.clientIp;
}
