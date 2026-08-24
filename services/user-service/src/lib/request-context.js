import { randomUUID } from "node:crypto";

export function requestContextMiddleware(request, response, next) {
  const requestId = request.get("x-request-id") || randomUUID();
  const correlationId = request.get("x-correlation-id") || requestId;

  request.context = {
    requestId,
    correlationId
  };

  response.setHeader("x-request-id", requestId);
  response.setHeader("x-correlation-id", correlationId);

  next();
}
