import { normalizeGatewayResponse } from "../http-response.js";

export function createResponseNormalizationMiddleware({ store }) {
  return async function responseNormalizationMiddleware(request, response, next) {
    try {
      const gatewayResponse = response.locals.gatewayResponse;
      if (!gatewayResponse) {
        return next();
      }

      const normalizedBody = gatewayResponse.alreadyNormalized
        ? {
            ...gatewayResponse.body,
            meta: {
              ...(gatewayResponse.body.meta || {}),
              requestId: request.context.requestId,
              correlationId: request.context.correlationId,
              timestamp: new Date().toISOString()
            }
          }
        : normalizeGatewayResponse({
            status: gatewayResponse.status || 200,
            payload: gatewayResponse.body,
            context: request.context
          });

      if (request.idempotency && !request.idempotency.cacheHit && gatewayResponse.status >= 200 && gatewayResponse.status < 300) {
        await store.setValue(
          request.idempotency.cacheKey,
          {
            status: gatewayResponse.status,
            body: normalizedBody
          },
          request.idempotency.ttlMs
        );
      }

      response.status(gatewayResponse.status || 200).json(normalizedBody);
      return undefined;
    } catch (error) {
      return next(error);
    }
  };
}
