import express from "express";
import { createErrorHandlerMiddleware } from "./middleware/error-handler.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createAuthorizationMiddleware } from "./middleware/authorization.js";
import { createIdempotencyMiddleware } from "./middleware/idempotency.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { createQuotaMiddleware } from "./middleware/quota.js";
import { createRequestContextMiddleware } from "./middleware/request-context.js";
import { createResponseNormalizationMiddleware } from "./middleware/response-normalization.js";
import { createRoutingMiddleware } from "./middleware/routing.js";
import { createValidationMiddleware } from "./middleware/validation.js";
import { sendNormalizedResponse } from "./http-response.js";
import { createLogger } from "./logger.js";
import { createGatewayMetrics } from "./metrics.js";
import { createRouteRegistry } from "./route-registry.js";
import { createJwtService } from "./security/jwt-service.js";
import mtlsClient from "../../../platform/node/mtls-client.cjs";
import { readSecret } from "./security/read-secret.js";
import { createProxyClient } from "./services/proxy-client.js";
import { createGatewayStore } from "./stores/index.js";

export async function createGatewayApp(options = {}) {
  const env = options.env || process.env;
  const { createMtlsFetch } = mtlsClient;
  const logger = options.logger || createLogger();
  const metrics = options.metrics || createGatewayMetrics();
  const realtimePublisher = options.realtimePublisher || { publish: () => 0 };
  const internalFetch = options.fetchImpl || createMtlsFetch({ env, prefix: "GATEWAY_INTERNAL_TLS" });
  const realtimeInternalKey = readSecret(env, "REALTIME_INTERNAL_KEY", "cab-realtime-internal-key").trim();
  const store = options.store || createGatewayStore({ env, mode: options.storeMode });
  const routeRegistry = options.routeRegistry || createRouteRegistry({
    env,
    upstreamTimeoutMs: Number(env.UPSTREAM_TIMEOUT_MS || 5000)
  });
  const jwtService = options.jwtService || createJwtService({
    authServiceUrl: env.AUTH_SERVICE_URL,
    jwksUrl: env.AUTH_JWKS_URL,
    authMeUrl: env.AUTH_ME_URL,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    fetchImpl: internalFetch,
    timeoutMs: Number(env.AUTH_VALIDATION_TIMEOUT_MS || env.UPSTREAM_TIMEOUT_MS || 5000)
  });
  const proxyClient =
    options.proxyClient ||
    createProxyClient({
      fetchImpl: internalFetch,
      logger,
      defaultTimeoutMs: Number(env.UPSTREAM_TIMEOUT_MS || 5000),
      failureThreshold: Number(env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 5),
      resetTimeoutMs: Number(env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS || 30_000)
    });

  const app = express();
  app.disable("x-powered-by");

  // Custom CORS Middleware
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Idempotency-Key");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(createRequestContextMiddleware({ routeRegistry, logger, metrics }));

  app.get("/health", (request, response) => {
    sendNormalizedResponse(
      response,
      200,
      {
        message: "Gateway is healthy",
        data: {
          service: "api-gateway",
          status: "ok"
        }
      },
      request.context
    );
  });

  app.get("/ready", async (request, response) => {
    const storeReady = await store.isReady();
    const ready = storeReady && jwtService.configured;

    sendNormalizedResponse(
      response,
      ready ? 200 : 503,
      {
        message: ready ? "Gateway is ready" : "Gateway is not ready",
        data: {
          status: ready ? "ready" : "degraded",
          dependencies: {
            jwtConfigured: jwtService.configured,
            store: store.mode,
            storeReady
          }
        }
      },
      request.context
    );
  });

  app.get("/metrics", async (_request, response) => {
    response.setHeader("content-type", metrics.registry.contentType);
    response.status(200).send(await metrics.registry.metrics());
  });

  app.post("/internal/realtime/publish", (request, response) => {
    if (!realtimeInternalKey) {
      response.status(503).json({
        success: false,
        message: "Realtime internal publishing is disabled"
      });
      return;
    }

    if (env.GATEWAY_INTERNAL_TLS_ENABLED && !request.mtlsClient?.authorized) {
      response.status(403).json({
        success: false,
        message: "Realtime internal publishing requires mTLS-authenticated service identity"
      });
      return;
    }

    const providedKey = String(request.headers["x-realtime-internal-key"] || "").trim();
    if (providedKey !== realtimeInternalKey) {
      response.status(403).json({
        success: false,
        message: "Invalid realtime internal key"
      });
      return;
    }

    const userIds = normalizeTargetUserIds(request.body?.userIds, request.body?.userId);
    const event = request.body?.event;

    if (userIds.length === 0 || !event || typeof event !== "object" || Array.isArray(event)) {
      response.status(400).json({
        success: false,
        message: "userIds and event are required"
      });
      return;
    }

    const deliveredCount = realtimePublisher.publish(userIds, event);

    response.status(202).json({
      success: true,
      message: "Realtime event accepted",
      data: {
        deliveredCount,
        targetCount: userIds.length
      }
    });
  });

  const apiPipeline = [
    createAuthMiddleware({ jwtService }),
    createAuthorizationMiddleware(),
    createRateLimitMiddleware({ store }),
    createQuotaMiddleware({ store }),
    createIdempotencyMiddleware({ store }),
    createValidationMiddleware(),
    createRoutingMiddleware({ proxyClient }),
    createResponseNormalizationMiddleware({ store })
  ];

  app.use(apiPipeline);

  app.use((request, response, next) => {
    if (response.headersSent) {
      return next();
    }

    return sendNormalizedResponse(
      response,
      404,
      {
        error: "NOT_FOUND",
        message: "Route not found"
      },
      request.context
    );
  });

  app.use(createErrorHandlerMiddleware({ logger }));

  return {
    app,
    dependencies: {
      env,
      logger,
      metrics,
      store,
      routeRegistry,
      jwtService,
      fetchImpl: internalFetch,
      proxyClient,
      realtimePublisher
    },
    async close() {
      await store.disconnect();
    }
  };
}

function normalizeTargetUserIds(userIds, singleUserId) {
  const values = [];

  if (Array.isArray(userIds)) {
    values.push(...userIds);
  }

  if (singleUserId) {
    values.push(singleUserId);
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}
