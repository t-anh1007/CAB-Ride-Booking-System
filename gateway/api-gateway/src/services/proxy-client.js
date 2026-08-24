import { setTimeout as delay } from "node:timers/promises";
import { GatewayError } from "../errors.js";
import { applyForwardedAuthHeaders, isForwardedAuthHeader } from "../security/internal-auth-headers.js";
import { createCircuitBreaker } from "./circuit-breaker.js";

export function createProxyClient({
  fetchImpl = globalThis.fetch,
  logger,
  gatewayKey = "api-gateway",
  defaultTimeoutMs = 5000,
  failureThreshold = 5,
  resetTimeoutMs = 30_000,
  retryCount = 2
} = {}) {
  const breakers = new Map();

  function getBreaker(serviceKey) {
    if (!breakers.has(serviceKey)) {
      breakers.set(
        serviceKey,
        createCircuitBreaker({
          failureThreshold,
          resetTimeoutMs
        })
      );
    }

    return breakers.get(serviceKey);
  }

  return {
    async forward({ request, routeConfig, context }) {
      const breaker = getBreaker(routeConfig.serviceKey);
      if (!breaker.canRequest()) {
        throw new GatewayError(503, "CIRCUIT_OPEN", `${routeConfig.serviceKey} is temporarily unavailable`);
      }

      const maxAttempts = isSafeMethod(request.method) ? retryCount + 1 : 1;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          if (attempt > 1 && !breaker.canRequest()) {
            break;
          }

          const upstreamResponse = await executeRequest({
            request,
            routeConfig,
            context,
            gatewayKey,
            fetchImpl,
            timeoutMs: routeConfig.timeoutMs || defaultTimeoutMs
          });

          breaker.onSuccess();
          return upstreamResponse;
        } catch (error) {
          lastError = error;
          breaker.onFailure();

          logger?.warn?.({
            event: "proxy.request_failed",
            service: routeConfig.serviceKey,
            attempt,
            requestId: context.requestId,
            message: error.message
          });

          if (!shouldRetry(error, request.method, attempt, maxAttempts)) {
            break;
          }

          await delay(50 * 2 ** (attempt - 1));
        }
      }

      throw mapProxyError(lastError, routeConfig.serviceKey);
    },
    getBreakerSnapshot(serviceKey) {
      return getBreaker(serviceKey).snapshot();
    }
  };
}

async function executeRequest({
  request,
  routeConfig,
  context,
  gatewayKey,
  fetchImpl,
  timeoutMs
}) {
  const targetUrl = new URL(request.originalUrl, routeConfig.upstreamUrl);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value !== "string") {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedKey) || isForwardedAuthHeader(normalizedKey)) {
      continue;
    }

    headers.set(key, value);
  }

  headers.set("x-request-id", context.requestId);
  headers.set("x-correlation-id", context.correlationId);
  headers.set("x-gateway-service", gatewayKey);
  headers.set("x-upstream-service", routeConfig.serviceKey);
  applyForwardedAuthHeaders(headers, request.auth);

  const canHaveBody = !["GET", "HEAD"].includes(request.method);
  let body;

  if (canHaveBody && request.body != null) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal
    });

    const rawBody = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const parsedBody = parseBody(rawBody, contentType);

    return {
      status: response.status,
      body: parsedBody,
      headers: Object.fromEntries(response.headers.entries())
    };
  } finally {
    clearTimeout(timeout);
  }
}

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function parseBody(rawBody, contentType) {
  if (!rawBody) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {
        rawBody
      };
    }
  }

  return rawBody;
}

function shouldRetry(error, method, attempt, maxAttempts) {
  return isSafeMethod(method) && attempt < maxAttempts && (error.name === "AbortError" || !error.statusCode || error.statusCode >= 502);
}

function isSafeMethod(method) {
  return ["GET", "HEAD"].includes(method);
}

function mapProxyError(error, serviceKey) {
  if (error instanceof GatewayError) {
    return error;
  }

  if (error?.name === "AbortError") {
    return new GatewayError(504, "UPSTREAM_TIMEOUT", `${serviceKey} timed out`, {
      cause: error
    });
  }

  return new GatewayError(502, "UPSTREAM_UNAVAILABLE", `${serviceKey} is unreachable`, {
    cause: error
  });
}
