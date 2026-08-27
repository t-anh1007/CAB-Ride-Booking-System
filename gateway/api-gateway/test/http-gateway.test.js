import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test from "node:test";
import request from "supertest";
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createGatewayApp } from "../src/app.js";

const ISSUER = "cab-auth-service";
const AUDIENCE = "cab-api";
const VALID_BOOKING_PAYLOAD = {
  userId: "11111111-1111-4111-8111-111111111111",
  pickup: {
    lat: 10.762622,
    lng: 106.660172,
    address: "District 1"
  },
  destination: {
    lat: 10.77653,
    lng: 106.700981,
    address: "District 2"
  },
  vehicleType: "car",
  priceSnapshot: {
    amount: 125000,
    currency: "VND",
    surgeMultiplier: 1
  }
};

test("gateway returns an explicit allowed origin for credentialed browser requests", async (t) => {
  const runtime = await createGatewayApp({
    env: createEnv({
      CORS_ALLOWED_ORIGINS: "http://localhost:5174"
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const response = await request(runtime.app)
    .options("/api/v1/auth/login/otp/request")
    .set("Origin", "http://localhost:5174")
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "content-type")
    .expect(204);

  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5174");
  assert.equal(response.headers["access-control-allow-credentials"], "true");
  assert.match(response.headers.vary, /Origin/);
});

test("gateway does not grant credentialed CORS access to an unlisted origin", async (t) => {
  const runtime = await createGatewayApp({
    env: createEnv({
      CORS_ALLOWED_ORIGINS: "http://localhost:5174"
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const response = await request(runtime.app)
    .options("/api/v1/auth/login/otp/request")
    .set("Origin", "https://untrusted.example")
    .set("Access-Control-Request-Method", "POST")
    .expect(204);

  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(response.headers["access-control-allow-credentials"], undefined);
});

test("gateway verifies RS256 token via Auth JWKS, validates /me, then proxies protected request", async (t) => {
  const auth = await createAuthServer();
  const upstream = await createUpstreamServer(({ req, json, sendJson }) => {
    sendJson(200, {
      receivedHeaders: req.headers,
      query: Object.fromEntries(new URL(req.url, "http://upstream.local").searchParams.entries()),
      body: json
    });
  });
  t.after(async () => {
    await upstream.close();
    await auth.close();
  });

  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url,
      USER_SERVICE_URL: upstream.url
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const token = await auth.signToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const response = await request(runtime.app)
    .get("/api/v1/users/profile?view=full")
    .set("Authorization", `Bearer ${token}`)
    .set("x-correlation-id", "corr-123")
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.meta.correlationId, "corr-123");
  assert.ok(response.body.meta.requestId);
  assert.equal(response.body.data.query.view, "full");
  assert.equal(response.body.data.receivedHeaders["x-correlation-id"], "corr-123");
  assert.equal(response.body.data.receivedHeaders["x-request-id"], response.body.meta.requestId);
  assert.equal(response.body.data.receivedHeaders["x-auth-user-id"], "customer-1");
  assert.equal(response.body.data.receivedHeaders["x-auth-role"], "Customer");
  assert.equal(response.body.data.receivedHeaders["x-auth-context-source"], "api-gateway");
  assert.equal(auth.meCalls.length, 1);
  assert.equal(auth.meCalls[0].headers["x-correlation-id"], "corr-123");
});

test("protected routes reject missing bearer token", async (t) => {
  const runtime = await createGatewayApp({
    env: createEnv(),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const response = await request(runtime.app).get("/api/v1/users/profile").expect(401);

  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Bearer token is required");
});

test("gateway rejects invalid RS256 signature before calling auth /me", async (t) => {
  const auth = await createAuthServer();
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  const token = await createUntrustedToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const response = await request(runtime.app)
    .get("/api/v1/users/profile")
    .set("Authorization", `Bearer ${token}`)
    .expect(401);

  assert.equal(response.body.message, "Access token is invalid");
  assert.equal(auth.meCalls.length, 0);
});

test("gateway rejects expired RS256 access token", async (t) => {
  const auth = await createAuthServer();
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  const token = await auth.signToken(
    {
      sub: "customer-1",
      role: "customer",
      roles: ["customer"]
    },
    {
      expirationTime: Math.floor(Date.now() / 1000) - 10
    }
  );

  const response = await request(runtime.app)
    .get("/api/v1/users/profile")
    .set("Authorization", `Bearer ${token}`)
    .expect(401);

  assert.equal(response.body.message, "Access token has expired");
  assert.equal(auth.meCalls.length, 0);
});

test("gateway returns 401 when auth /me rejects token", async (t) => {
  const auth = await createAuthServer({
    meStatus: 401,
    meBody: {
      success: false,
      message: "Access token is invalid or expired"
    }
  });
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  const token = await auth.signToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const response = await request(runtime.app)
    .get("/api/v1/users/profile")
    .set("Authorization", `Bearer ${token}`)
    .expect(401);

  assert.equal(response.body.message, "Access token is invalid or expired");
});

test("gateway fails closed with 503 when auth /me is unavailable", async (t) => {
  const auth = await createAuthServer({
    meStatus: 500,
    meBody: {
      success: false,
      message: "Auth service error"
    }
  });
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  const token = await auth.signToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const response = await request(runtime.app)
    .get("/api/v1/users/profile")
    .set("Authorization", `Bearer ${token}`)
    .expect(503);

  assert.equal(response.body.message, "Auth service failed to validate access token");
});

test("RBAC blocks drivers from creating bookings after auth /me context is resolved", async (t) => {
  const auth = await createAuthServer();
  const upstream = await createUpstreamServer(({ sendJson }) => {
    sendJson(201, {
      bookingId: "booking-1"
    });
  });
  t.after(async () => {
    await upstream.close();
    await auth.close();
  });

  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url,
      BOOKING_SERVICE_URL: upstream.url
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const token = await auth.signToken({
    sub: "driver-1",
    role: "driver",
    roles: ["driver"]
  });

  const response = await request(runtime.app)
    .post("/api/v1/bookings")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "booking-key-1")
    .send(VALID_BOOKING_PAYLOAD)
    .expect(403);

  assert.equal(response.body.message, "You do not have permission to access this resource");
});

test("gateway enforces admin scope for listing users", async (t) => {
  const auth = await createAuthServer();
  const upstream = await createUpstreamServer(({ sendJson }) => {
    sendJson(200, {
      ok: true
    });
  });
  t.after(async () => {
    await upstream.close();
    await auth.close();
  });

  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url,
      USER_SERVICE_URL: upstream.url
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const missingScopeToken = await auth.signToken({
    sub: "admin-1",
    role: "admin",
    roles: ["admin"]
  });

  const forbidden = await request(runtime.app)
    .get("/api/v1/users")
    .set("Authorization", `Bearer ${missingScopeToken}`)
    .expect(403);

  assert.equal(forbidden.body.message, "Missing required scope for this resource");

  const adminToken = await auth.signToken({
    sub: "admin-1",
    role: "admin",
    roles: ["admin"],
    scope: "admin:all"
  });

  await request(runtime.app)
    .get("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
});

test("gateway enforces location:update:assigned permission on ride location updates", async (t) => {
  const auth = await createAuthServer();
  const upstream = await createUpstreamServer(({ req, sendJson }) => {
    sendJson(200, {
      ok: true,
      receivedHeaders: req.headers
    });
  });
  t.after(async () => {
    await upstream.close();
    await auth.close();
  });

  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url,
      RIDE_SERVICE_URL: upstream.url
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const missingPermissionToken = await auth.signToken({
    sub: "driver-1",
    role: "driver",
    roles: ["driver"]
  });

  const forbidden = await request(runtime.app)
    .post("/api/v1/rides/ride-1/location")
    .set("Authorization", `Bearer ${missingPermissionToken}`)
    .send({
      driverId: "driver-1",
      currentLocation: {
        lat: 10.77,
        lng: 106.7
      }
    })
    .expect(403);

  assert.equal(forbidden.body.message, "Missing required permission for this resource");

  const permittedToken = await auth.signToken({
    sub: "driver-1",
    role: "driver",
    roles: ["driver"],
    permissions: ["location:update:assigned"]
  });

  const allowed = await request(runtime.app)
    .post("/api/v1/rides/ride-1/location")
    .set("Authorization", `Bearer ${permittedToken}`)
    .send({
      driverId: "driver-1",
      currentLocation: {
        lat: 10.77,
        lng: 106.7
      }
    })
    .expect(200);

  assert.equal(allowed.body.data.receivedHeaders["x-auth-permissions"], "location:update:assigned");
});

test("auth lifecycle routes remain public and proxy to auth-service", async (t) => {
  const auth = await createAuthServer();
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  const response = await request(runtime.app)
    .post("/api/v1/auth/login/otp/request")
    .send({
      destination: "customer@example.com",
      role: "customer",
      channel: "email"
    })
    .expect(202);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.authRoute, "/api/v1/auth/login/otp/request");
  assert.equal(auth.meCalls.length, 0);
});

test("auth endpoints are rate limited at 100 requests per minute", async (t) => {
  const auth = await createAuthServer();
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  for (let attempt = 1; attempt <= 100; attempt += 1) {
    await request(runtime.app)
      .post("/api/v1/auth/login/otp/request")
      .send({
        destination: "demo@example.com",
        role: "customer"
      })
      .expect(202);
  }

  const blocked = await request(runtime.app)
    .post("/api/v1/auth/login/otp/request")
    .send({
      destination: "demo@example.com",
      role: "customer"
    })
    .expect(429);

  assert.equal(blocked.body.success, false);
  assert.equal(typeof blocked.body.data.retryAfterSeconds, "number");
  assert.ok(blocked.body.data.retryAfterSeconds > 0);
  assert.ok(blocked.body.meta.requestId);
  assert.ok(blocked.body.meta.correlationId);
  assert.ok(blocked.body.meta.timestamp);
  assert.equal(blocked.body.message, "Rate limit exceeded");
  assert.ok(blocked.headers["retry-after"]);
});

test("booking creation requires Idempotency-Key and valid schema", async (t) => {
  const auth = await createAuthServer();
  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url
    }),
    storeMode: "memory"
  });
  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  const token = await auth.signToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const invalidSchemaResponse = await request(runtime.app)
    .post("/api/v1/bookings")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "booking-key-2")
    .send({
      userId: "not-a-uuid"
    })
    .expect(400);

  assert.equal(invalidSchemaResponse.body.message, "Request validation failed");

  const missingIdempotencyResponse = await request(runtime.app)
    .post("/api/v1/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send(VALID_BOOKING_PAYLOAD)
    .expect(400);

  assert.equal(missingIdempotencyResponse.body.message, "Idempotency-Key header is required");
});

test("booking idempotency returns cached response and avoids duplicate upstream calls", async (t) => {
  let callCount = 0;
  const auth = await createAuthServer();
  const upstream = await createUpstreamServer(({ sendJson }) => {
    callCount += 1;
    sendJson(201, {
      bookingId: "booking-1",
      sequence: callCount
    });
  });
  t.after(async () => {
    await upstream.close();
    await auth.close();
  });

  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url,
      BOOKING_SERVICE_URL: upstream.url
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const token = await auth.signToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const first = await request(runtime.app)
    .post("/api/v1/bookings")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "booking-key-3")
    .send(VALID_BOOKING_PAYLOAD)
    .expect(201);

  const second = await request(runtime.app)
    .post("/api/v1/bookings")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "booking-key-3")
    .send(VALID_BOOKING_PAYLOAD)
    .expect(201);

  assert.equal(callCount, 1);
  assert.equal(first.body.data.sequence, 1);
  assert.equal(second.body.data.sequence, 1);
});

test("gateway returns timeout then opens circuit breaker for the upstream", async (t) => {
  let attempts = 0;
  const auth = await createAuthServer();
  const upstream = await createUpstreamServer(async ({ sendJson }) => {
    attempts += 1;
    await sleep(40);
    sendJson(200, {
      ok: true
    });
  });
  t.after(async () => {
    await upstream.close();
    await auth.close();
  });

  const runtime = await createGatewayApp({
    env: createEnv({
      AUTH_SERVICE_URL: auth.url,
      USER_SERVICE_URL: upstream.url,
      UPSTREAM_TIMEOUT_MS: "10",
      CIRCUIT_BREAKER_FAILURE_THRESHOLD: "1",
      CIRCUIT_BREAKER_RESET_TIMEOUT_MS: "5000"
    }),
    storeMode: "memory"
  });
  t.after(async () => runtime.close());

  const token = await auth.signToken({
    sub: "customer-1",
    role: "customer",
    roles: ["customer"]
  });

  const first = await request(runtime.app)
    .get("/api/v1/users/slow")
    .set("Authorization", `Bearer ${token}`)
    .expect(504);

  const second = await request(runtime.app)
    .get("/api/v1/users/slow")
    .set("Authorization", `Bearer ${token}`)
    .expect(503);

  assert.equal(first.body.message, "user-service timed out");
  assert.equal(second.body.message, "user-service is temporarily unavailable");
  assert.equal(attempts, 1);
});

function createEnv(overrides = {}) {
  return {
    JWT_ISSUER: ISSUER,
    JWT_AUDIENCE: AUDIENCE,
    AUTH_VALIDATION_TIMEOUT_MS: "5000",
    UPSTREAM_TIMEOUT_MS: "5000",
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: "5",
    CIRCUIT_BREAKER_RESET_TIMEOUT_MS: "30000",
    ...overrides
  };
}

async function createAuthServer({ meStatus = 200, meBody } = {}) {
  const keyPair = await generateKeyPair("RS256");
  const kid = "auth-test-key";
  const publicJwk = await exportJWK(keyPair.publicKey);
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const meCalls = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://auth.local");

    if (url.pathname === "/.well-known/jwks.json") {
      return sendJson(res, 200, {
        keys: [publicJwk]
      });
    }

    if (url.pathname === "/api/v1/auth/me") {
      meCalls.push({
        headers: req.headers
      });

      if (meStatus !== 200) {
        return sendJson(res, meStatus, meBody || { message: "Auth context failed" });
      }

      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const payload = token ? decodeJwt(token) : {};
      return sendJson(res, 200, {
        success: true,
        data: {
          subjectId: payload.sub,
          accountId: payload.aid || "account-1",
          sessionId: payload.sid || "session-1",
          role: payload.role,
          roles: payload.roles || (payload.role ? [payload.role] : []),
          scopes: payload.scope ? String(payload.scope).split(/\s+/).filter(Boolean) : [],
          permissions: payload.permissions || []
        },
        meta: {
          requestId: req.headers["x-request-id"] || null
        }
      });
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const json = rawBody ? JSON.parse(rawBody) : null;

    return sendJson(res, req.method === "POST" ? 202 : 200, {
      success: true,
      data: {
        authRoute: url.pathname,
        body: json
      }
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  return {
    url: `http://127.0.0.1:${address.port}`,
    meCalls,
    signToken(claims, options = {}) {
      return new SignJWT({
        typ: "access",
        ...claims
      })
        .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime(options.expirationTime ?? "15m")
        .sign(keyPair.privateKey);
    },
    close() {
      return closeServer(server);
    }
  };
}

async function createUntrustedToken(claims) {
  const keyPair = await generateKeyPair("RS256");
  return new SignJWT({
    typ: "access",
    ...claims
  })
    .setProtectedHeader({ alg: "RS256", kid: "auth-test-key", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keyPair.privateKey);
}

async function createUpstreamServer(handler) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    const json = rawBody ? JSON.parse(rawBody) : null;

    await handler({
      req,
      rawBody,
      json,
      sendJson(status, payload) {
        sendJson(res, status, payload);
      }
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  return {
    url: `http://127.0.0.1:${address.port}`,
    close() {
      return closeServer(server);
    }
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json"
  });
  res.end(JSON.stringify(payload));
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
