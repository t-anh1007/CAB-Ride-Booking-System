import { GatewayError } from "../errors.js";

export function createIdempotencyMiddleware({ store }) {
  return async function idempotencyMiddleware(request, response, next) {
    try {
      const policy = request.routeConfig?.idempotency;
      if (!request.routeConfig?.isApiRoute || !policy) {
        return next();
      }

      const idempotencyKey = request.headers["idempotency-key"];
      if (!idempotencyKey) {
        throw new GatewayError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
      }

      const scopedKey = [
        "idempotency",
        request.routeConfig.key,
        request.auth?.userId || request.context.clientIp,
        idempotencyKey
      ].join(":");

      const cached = await store.getValue(scopedKey);
      if (cached) {
        request.idempotency = {
          cacheKey: scopedKey,
          ttlMs: policy.ttlMs,
          cacheHit: true
        };

        response.locals.gatewayResponse = {
          status: cached.status,
          body: cached.body,
          alreadyNormalized: true
        };
        return next();
      }

      request.idempotency = {
        cacheKey: scopedKey,
        ttlMs: policy.ttlMs,
        cacheHit: false
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
