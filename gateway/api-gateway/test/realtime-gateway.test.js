import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test from "node:test";
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from "jose";
import WebSocket from "ws";
import { createGatewayServer } from "../src/server.js";

const ISSUER = "cab-auth-service";
const AUDIENCE = "cab-api";
const CUSTOMER_1_ID = "11111111-1111-4111-8111-111111111111";
const DRIVER_1_ID = "22222222-2222-4222-8222-222222222222";
const DRIVER_2_ID = "33333333-3333-4333-8333-333333333333";

test("websocket handshake rejects missing token", async (t) => {
  const runtime = await startRuntime(t);

  await assert.rejects(
    connectWebSocket(`${runtime.wsUrl}/realtime`),
    /Unexpected server response: 401/
  );
});

test("websocket authenticates through Auth JWKS plus /me and supports outbound publish hook", async (t) => {
  const runtime = await startRuntime(t);
  const token = await runtime.auth.signToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "driver",
    roles: ["driver"],
    permissions: ["location:update:assigned"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());

  const connectedMessage = await socket.nextMessage();
  assert.equal(connectedMessage.type, "realtime.connected");
  assert.equal(connectedMessage.role, "Driver");
  assert.equal(runtime.realtimeHub.getConnectionSummary().totalConnections, 1);
  assert.equal(runtime.auth.meCalls.length, 1);

  const publishedCount = runtime.realtimeHub.publishToUser("22222222-2222-4222-8222-222222222222", {
    type: "ride.assigned",
    payload: {
      rideId: "ride-1"
    }
  });
  assert.equal(publishedCount, 1);

  const pushedMessage = await socket.nextMessage();
  assert.equal(pushedMessage.type, "ride.assigned");

  socket.client.close();
  await once(socket.client, "close");
  await waitFor(() => runtime.realtimeHub.getConnectionSummary().totalConnections === 0);
  assert.equal(runtime.realtimeHub.getConnectionSummary().totalConnections, 0);
  assert.equal(connectedMessage.userId, "22222222-2222-4222-8222-222222222222");
});

test("websocket rejects GPS updates from non-driver actors", async (t) => {
  const runtime = await startRuntime(t);
  const token = await runtime.auth.signToken({
    sub: "11111111-1111-4111-8111-111111111111",
    role: "customer",
    roles: ["customer"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());
  await socket.nextMessage();

  socket.client.send(JSON.stringify(buildDriverLocationUpdate()));

  const errorMessage = await socket.nextMessage();
  assert.equal(errorMessage.type, "error");
  assert.match(errorMessage.message, /Only drivers can publish GPS updates/);
});

test("websocket rate limits driver location updates", async (t) => {
  const runtime = await startRuntime(t);
  const token = await runtime.auth.signToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "driver",
    roles: ["driver"],
    permissions: ["location:update:assigned"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());
  await socket.nextMessage();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    socket.client.send(JSON.stringify(buildDriverLocationUpdate()));
    const ack = await socket.nextMessage();
    assert.equal(ack.type, "ack");
    assert.equal(ack.accepted, true);
  }

  socket.client.send(JSON.stringify(buildDriverLocationUpdate()));
  const limited = await socket.nextMessage();
  assert.equal(limited.type, "error");
  assert.match(limited.message, /WebSocket rate limit exceeded/);
});

test("websocket forwards GPS updates to ride-service bridge", async (t) => {
  const forwardedPayloads = [];
  const runtime = await startRuntime(t, {
    forwardDriverLocationUpdate: async (payload) => {
      forwardedPayloads.push(payload);
      return { skipped: false };
    }
  });
  const token = await runtime.auth.signToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "driver",
    roles: ["driver"],
    permissions: ["location:update:assigned"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());
  await socket.nextMessage();

  const message = buildDriverLocationUpdate();
  socket.client.send(JSON.stringify(message));

  const ack = await socket.nextMessage();
  assert.equal(ack.type, "ack");
  assert.equal(ack.accepted, true);
  assert.equal(ack.forwarded, true);
  assert.equal(forwardedPayloads.length, 1);
  assert.deepEqual(forwardedPayloads[0], message.payload);
});

test("websocket rejects GPS updates when authoritative ride state is not active", async (t) => {
  const runtime = await startRuntime(t, {
    resolveRideAccessContext: async () => ({
      rideId: "ride-1",
      driverId: "22222222-2222-4222-8222-222222222222",
      status: "CANCELLED"
    })
  });
  const token = await runtime.auth.signToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "driver",
    roles: ["driver"],
    permissions: ["location:update:assigned"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());
  await socket.nextMessage();

  socket.client.send(JSON.stringify(buildDriverLocationUpdate({
    driverId: "22222222-2222-4222-8222-222222222222"
  })));

  const errorMessage = await socket.nextMessage();
  assert.equal(errorMessage.type, "error");
  assert.match(errorMessage.message, /not allowed while ride is CANCELLED/);
});

test("websocket rejects GPS updates when authenticated driver is not assigned driver", async (t) => {
  const runtime = await startRuntime(t, {
    resolveRideAccessContext: async () => ({
      rideId: "ride-1",
      driverId: "33333333-3333-4333-8333-333333333333",
      status: "ACTIVE"
    })
  });
  const token = await runtime.auth.signToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "driver",
    roles: ["driver"],
    permissions: ["location:update:assigned"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());
  await socket.nextMessage();

  socket.client.send(JSON.stringify(buildDriverLocationUpdate({
    driverId: "22222222-2222-4222-8222-222222222222"
  })));

  const errorMessage = await socket.nextMessage();
  assert.equal(errorMessage.type, "error");
  assert.match(errorMessage.message, /not the assigned driver/);
});

test("internal realtime publish endpoint pushes event to connected users", async (t) => {
  const runtime = await startRuntime(t);
  const token = await runtime.auth.signToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "driver",
    roles: ["driver"]
  });

  const socket = await connectWebSocket(`${runtime.wsUrl}/realtime?token=${token}`);
  t.after(() => socket.client.close());
  await socket.nextMessage();

  const response = await fetch(`${runtime.baseUrl}/internal/realtime/publish`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-realtime-internal-key": runtime.realtimeInternalKey
    },
    body: JSON.stringify({
      userIds: ["22222222-2222-4222-8222-222222222222"],
      event: {
        type: "driver.location.updated",
        payload: {
          rideId: "ride-1"
        }
      }
    })
  });

  assert.equal(response.status, 202);

  const pushedMessage = await socket.nextMessage();
  assert.equal(pushedMessage.type, "driver.location.updated");
  assert.equal(pushedMessage.payload.rideId, "ride-1");
});

async function startRuntime(t, options = {}) {
  const auth = await createAuthServer();
  const realtimeInternalKey = "test-realtime-key";
  const runtime = await createGatewayServer({
    env: {
      AUTH_SERVICE_URL: auth.url,
      JWT_ISSUER: ISSUER,
      JWT_AUDIENCE: AUDIENCE,
      REALTIME_INTERNAL_KEY: realtimeInternalKey
    },
    storeMode: "memory",
    forwardDriverLocationUpdate: options.forwardDriverLocationUpdate,
    resolveRideAccessContext: options.resolveRideAccessContext
  });

  runtime.server.listen(0);
  await once(runtime.server, "listening");
  const address = runtime.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await runtime.close();
    await auth.close();
  });

  return {
    ...runtime,
    auth,
    baseUrl,
    realtimeInternalKey,
    wsUrl: baseUrl.replace("http://", "ws://")
  };
}

async function createAuthServer() {
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
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const payload = token ? decodeJwt(token) : {};

      return sendJson(res, 200, {
        success: true,
        data: {
          subjectId: payload.sub,
          role: payload.role,
          roles: payload.roles || (payload.role ? [payload.role] : []),
          scopes: payload.scopes || [],
          permissions: payload.permissions || []
        }
      });
    }

    return sendJson(res, 404, {
      success: false,
      message: "Not found"
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  return {
    url: `http://127.0.0.1:${address.port}`,
    meCalls,
    signToken(claims) {
      return new SignJWT({
        typ: "access",
        ...claims
      })
        .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(keyPair.privateKey);
    },
    close() {
      return closeServer(server);
    }
  };
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url);
    const queue = [];
    const waiters = [];

    client.on("message", (rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage.toString());
        if (waiters.length > 0) {
          const waiter = waiters.shift();
          waiter(parsed);
          return;
        }

        queue.push(parsed);
      } catch (error) {
        reject(error);
      }
    });

    client.once("open", () =>
      resolve({
        client,
        nextMessage() {
          if (queue.length > 0) {
            return Promise.resolve(queue.shift());
          }

          return new Promise((resolveMessage) => {
            waiters.push(resolveMessage);
          });
        }
      })
    );
    client.once("error", reject);
    client.once("unexpected-response", (_request, response) => {
      reject(new Error(`Unexpected server response: ${response.statusCode}`));
    });
  });
}

function buildDriverLocationUpdate(overrides = {}) {
  return {
    type: "driver.location.update",
    payload: {
      rideId: "11111111-1111-4111-8111-111111111111",
      driverId: "22222222-2222-4222-8222-222222222222",
      rideStatus: "ACTIVE",
      latitude: 10.77,
      longitude: 106.69,
      recordedAt: "2026-04-08T09:30:00.000Z",
      ...overrides
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

async function waitFor(predicate, timeoutMs = 500) {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Condition was not met before timeout");
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
