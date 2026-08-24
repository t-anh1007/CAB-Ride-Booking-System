export function requestMeta(request, _response, next) {
  request.requestMeta = {
    requestId: String(request.header('x-request-id') || 'uuid').trim(),
    correlationId: String(request.header('x-correlation-id') || 'uuid').trim(),
    idempotencyKey: request.header('Idempotency-Key') || request.header('idempotency-key') || null
  };

  next();
}
