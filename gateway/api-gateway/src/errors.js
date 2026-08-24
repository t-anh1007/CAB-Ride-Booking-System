export class GatewayError extends Error {
  constructor(statusCode, code, message, options = {}) {
    super(message);
    this.name = "GatewayError";
    this.statusCode = statusCode;
    this.code = code;
    this.data = options.data ?? null;
    this.headers = options.headers ?? {};
    this.cause = options.cause;
    this.expose = options.expose ?? (statusCode < 500 || [502, 503, 504].includes(statusCode));
  }
}

export function isGatewayError(error) {
  return error instanceof GatewayError;
}
