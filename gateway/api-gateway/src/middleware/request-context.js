import { randomUUID } from "node:crypto";

export function createRequestContextMiddleware({ routeRegistry, logger, metrics }) {
  return function requestContextMiddleware(request, response, next) {
    const requestId = request.headers["x-request-id"] || randomUUID();
    const correlationId = request.headers["x-correlation-id"] || randomUUID();
    const routeConfig = routeRegistry.resolve(request);
    const startedAt = Date.now();

    request.context = {
      requestId,
      correlationId,
      clientIp: extractClientIp(request),
      startedAt
    };
    request.routeConfig = routeConfig;

    response.setHeader("x-request-id", requestId);
    response.setHeader("x-correlation-id", correlationId);

    response.on("finish", () => {
      const routeLabel = request.routeConfig?.key || "unknown";
      const durationMs = Date.now() - startedAt;

      metrics.recordHttpRequest({
        method: request.method,
        route: routeLabel,
        status: response.statusCode,
        durationMs
      });

      logger.info({
        event: "http.request.completed",
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs,
        requestId,
        correlationId,
        route: routeLabel
      });
    });

    next();
  };
}

function extractClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }

  return request.socket.remoteAddress || "unknown";
}
