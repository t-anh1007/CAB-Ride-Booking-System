import { GatewayError } from "../errors.js";

export function createRateLimitMiddleware({ store }) {
  return async function rateLimitMiddleware(request, response, next) {
    try {
      const policy = request.routeConfig?.rateLimit;
      if (!request.routeConfig?.isApiRoute || !policy) {
        return next();
      }

      const identity = buildRateLimitIdentity(request, policy.identity);
      const key = `ratelimit:${policy.name}:${identity}`;
      const result = await store.incrementCounter(key, policy.windowMs);

      response.setHeader("x-rate-limit-limit", String(policy.limit));
      response.setHeader("x-rate-limit-remaining", String(Math.max(policy.limit - result.count, 0)));

      if (result.count > policy.limit) {
        const retryAfterSeconds = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
        response.setHeader("Retry-After", String(retryAfterSeconds));

        throw new GatewayError(429, "RATE_LIMITED", "Rate limit exceeded", {
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

function buildRateLimitIdentity(request, identityType) {
  if (identityType === "user-or-ip") {
    return request.auth?.userId || request.context.clientIp;
  }

  return request.context.clientIp;
}
