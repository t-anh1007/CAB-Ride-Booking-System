// Security benchmark for the zero-trust / auth layer of the cab-booking-system.
// Runs directly against the REAL gateway source modules (authorization, abac,
// internal-auth-headers, jwt-service) plus jose RS256 crypto configured exactly
// like the auth-service. No full Docker stack required -> fast + accurate.
//
//   node docs/benchmarks/security/sec-bench.mjs
//
import crypto from "node:crypto";
import { SignJWT, importPKCS8, exportJWK, createLocalJWKSet } from "jose";
import { createRequire } from "node:module";

import { createAuthorizationMiddleware } from "../../../gateway/api-gateway/src/middleware/authorization.js";
import { enforceDriverLocationAbac } from "../../../gateway/api-gateway/src/security/abac.js";
import { applyForwardedAuthHeaders, isForwardedAuthHeader } from "../../../gateway/api-gateway/src/security/internal-auth-headers.js";
import { createJwtService } from "../../../gateway/api-gateway/src/security/jwt-service.js";

const require = createRequire(import.meta.url);
const argon2 = require("argon2");

const ISSUER = "cab-auth-service";
const AUDIENCE = "cab-api";
const ALG = "RS256";

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const stats = (arr) => ({
  p50: +pct(arr, 50).toFixed(4),
  p95: +pct(arr, 95).toFixed(4),
  p99: +pct(arr, 99).toFixed(4),
  avg: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4),
});
const now = () => Number(process.hrtime.bigint()) / 1e6; // ms

const results = {};

// ---- key material (RS256 2048-bit, same as auth-service) -------------------
async function setupKeys() {
  const { privateKey: pkcs8, publicKey: spki } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const privateKey = await importPKCS8(pkcs8, ALG);
  const pubKeyObj = crypto.createPublicKey(spki);
  const jwk = { ...(await exportJWK(pubKeyObj)), use: "sig", alg: ALG, kid: "auth-key-local-1" };
  const jwks = { keys: [jwk] };
  return { privateKey, jwks };
}

async function signToken(privateKey, claims = {}) {
  return new SignJWT({
    typ: "access",
    role: claims.role || "Customer",
    roles: claims.roles || [claims.role || "Customer"],
    scope: (claims.scopes || []).join(" "),
    permissions: claims.permissions || [],
    ...claims.extra,
  })
    .setProtectedHeader({ alg: ALG, kid: "auth-key-local-1", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub || crypto.randomUUID())
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime("15m")
    .sign(privateKey);
}

// ---- #2 + #1: JWT verify throughput + per-request crypto overhead ----------
async function benchJwtVerify(privateKey, jwks) {
  const resolver = createLocalJWKSet(jwks);
  const { jwtVerify } = await import("jose");
  const token = await signToken(privateKey, { role: "Customer", scopes: ["rides:read"] });

  for (let i = 0; i < 500; i++) await jwtVerify(token, resolver, { issuer: ISSUER, audience: AUDIENCE, algorithms: [ALG] }); // warmup

  const N = 5000;
  const lat = [];
  const t0 = now();
  for (let i = 0; i < N; i++) {
    const a = now();
    await jwtVerify(token, resolver, { issuer: ISSUER, audience: AUDIENCE, algorithms: [ALG] });
    lat.push(now() - a);
  }
  const totalMs = now() - t0;
  results.jwtVerify = {
    samples: N,
    opsPerSec: Math.round((N / totalMs) * 1000),
    latencyMs: stats(lat),
  };
}

// ---- #4: JWKS cache effectiveness (real jwt-service.js) ---------------------
async function benchJwksCache(privateKey, jwks) {
  let jwksFetches = 0;
  let meFetches = 0;
  const mkResp = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  const fetchImpl = async (url) => {
    if (String(url).includes("jwks")) {
      jwksFetches++;
      return mkResp(jwks);
    }
    meFetches++;
    return mkResp({ data: { sub: "u1", roles: ["Customer"], scopes: ["rides:read"], permissions: [] } });
  };
  const svc = createJwtService({
    authServiceUrl: "http://auth.local:3104",
    fetchImpl,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksCacheTtlMs: 60_000,
  });
  const token = await signToken(privateKey, { role: "Customer", scopes: ["rides:read"] });
  const M = 10_000;
  for (let i = 0; i < M; i++) await svc.verifyAccessToken(token, {});
  results.jwksCache = {
    verifications: M,
    jwksFetches, // expect 1 within TTL
    fetchReductionPct: +(100 * (1 - jwksFetches / M)).toFixed(4),
  };
}

// ---- helper to run a connect-style middleware and capture outcome ----------
function runAuthz(mw, request) {
  return new Promise((resolve) => {
    mw(request, {}, (err) => resolve(err ? { blocked: true, status: err.status, code: err.code } : { blocked: false }));
  });
}

function mkRequest({ role, scopes = [], permissions = [], routeConfig }) {
  return {
    method: "GET",
    auth: { role, scopes, permissions, userId: "actor-1", subjectId: "actor-1" },
    routeConfig: { isApiRoute: true, authRequired: true, ...routeConfig },
  };
}

// ---- #3: RBAC/ABAC decision latency ----------------------------------------
async function benchAuthzLatency() {
  const mw = createAuthorizationMiddleware();
  const req = mkRequest({
    role: "Driver",
    scopes: ["rides:read"],
    permissions: ["location:update:assigned"],
    routeConfig: { allowedRoles: ["Driver"], requiredScopes: ["rides:read"], requiredPermissions: ["location:update:assigned"] },
  });
  for (let i = 0; i < 2000; i++) await runAuthz(mw, req); // warmup

  const N = 50_000;
  const lat = [];
  for (let i = 0; i < N; i++) {
    const a = now();
    await runAuthz(mw, req);
    lat.push(now() - a);
  }
  results.rbacLatency = { samples: N, latencyMs: stats(lat), latencyUs: +(stats(lat).p50 * 1000).toFixed(2) };

  // ABAC (attribute-based, assigned-driver check) latency
  const auth = { role: "Driver", userId: "d1", subjectId: "d1", permissions: ["location:update:assigned"] };
  const payload = { rideId: "r1" };
  const resolveRideContext = async () => ({ status: "ONGOING", driverId: "d1" });
  for (let i = 0; i < 2000; i++) await enforceDriverLocationAbac(auth, payload, { resolveRideContext });
  const alat = [];
  for (let i = 0; i < 20_000; i++) {
    const a = now();
    await enforceDriverLocationAbac(auth, payload, { resolveRideContext });
    alat.push(now() - a);
  }
  results.abacLatency = { samples: 20000, latencyMs: stats(alat), latencyUs: +(stats(alat).p50 * 1000).toFixed(2) };
}

// ---- #5: authorization coverage (broken-access = 0) ------------------------
async function benchCoverage() {
  const mw = createAuthorizationMiddleware();
  const cases = [];

  // RBAC negatives (must be blocked)
  cases.push(["customer hits admin-only route", await runAuthz(mw, mkRequest({ role: "Customer", routeConfig: { allowedRoles: ["Admin"] } })), true]);
  cases.push(["driver hits admin-only route", await runAuthz(mw, mkRequest({ role: "Driver", routeConfig: { allowedRoles: ["Admin"] } })), true]);
  cases.push(["no role hits role-guarded route", await runAuthz(mw, mkRequest({ role: null, routeConfig: { allowedRoles: ["Driver"] } })), true]);
  cases.push(["missing required scope", await runAuthz(mw, mkRequest({ role: "Customer", scopes: [], routeConfig: { requiredScopes: ["payments:write"] } })), true]);
  cases.push(["missing required permission", await runAuthz(mw, mkRequest({ role: "Driver", permissions: [], routeConfig: { requiredPermissions: ["location:update:assigned"] } })), true]);
  cases.push(["wrong scope present but not the required one", await runAuthz(mw, mkRequest({ role: "Customer", scopes: ["rides:read"], routeConfig: { requiredScopes: ["admin:reports"] } })), true]);

  // RBAC positives (must be allowed)
  cases.push(["admin allowed on admin route", await runAuthz(mw, mkRequest({ role: "Admin", scopes: ["admin:all"], routeConfig: { allowedRoles: ["Admin"] } })), false]);
  cases.push(["admin:all bypasses scope reqs", await runAuthz(mw, mkRequest({ role: "Admin", scopes: ["admin:all"], routeConfig: { requiredScopes: ["payments:write"] } })), false]);
  cases.push(["driver with correct role+scope+perm", await runAuthz(mw, mkRequest({ role: "Driver", scopes: ["rides:read"], permissions: ["location:update:assigned"], routeConfig: { allowedRoles: ["Driver"], requiredScopes: ["rides:read"], requiredPermissions: ["location:update:assigned"] } })), false]);

  // ABAC negatives (must throw)
  const abacTry = async (fn) => { try { await fn(); return { blocked: false }; } catch (e) { return { blocked: true, status: e.status, code: e.code }; } };
  const resolveActive = async () => ({ status: "ONGOING", driverId: "assigned-driver" });
  cases.push(["non-driver publishes GPS", await abacTry(() => enforceDriverLocationAbac({ role: "Customer" }, { rideId: "r1" }, {})), true]);
  cases.push(["driver GPS without rideId", await abacTry(() => enforceDriverLocationAbac({ role: "Driver", permissions: ["location:update:assigned"] }, {}, {})), true]);
  cases.push(["driver GPS without permission", await abacTry(() => enforceDriverLocationAbac({ role: "Driver", permissions: [] }, { rideId: "r1" }, {})), true]);
  cases.push(["driver GPS for ride assigned to someone else", await abacTry(() => enforceDriverLocationAbac({ role: "Driver", userId: "other", permissions: ["location:update:assigned"] }, { rideId: "r1" }, { resolveRideContext: resolveActive })), true]);
  cases.push(["driver GPS on completed ride", await abacTry(() => enforceDriverLocationAbac({ role: "Driver", userId: "assigned-driver", permissions: ["location:update:assigned"] }, { rideId: "r1" }, { resolveRideContext: async () => ({ status: "COMPLETED", driverId: "assigned-driver" }) })), true]);

  // ABAC positive
  cases.push(["assigned driver GPS on active ride", await abacTry(() => enforceDriverLocationAbac({ role: "Driver", userId: "assigned-driver", permissions: ["location:update:assigned"] }, { rideId: "r1" }, { resolveRideContext: resolveActive })), false]);

  let correct = 0;
  const failures = [];
  for (const [name, outcome, mustBlock] of cases) {
    const ok = outcome.blocked === mustBlock;
    if (ok) correct++; else failures.push(name);
  }
  const negatives = cases.filter(([, , mb]) => mb);
  const blockedNeg = negatives.filter(([, o]) => o.blocked).length;
  results.coverage = {
    totalCases: cases.length,
    correct,
    accuracyPct: +(100 * correct / cases.length).toFixed(2),
    negativeCases: negatives.length,
    negativesBlocked: blockedNeg,
    brokenAccessRatePct: +(100 * (negatives.length - blockedNeg) / negatives.length).toFixed(2),
    failures,
  };
}

// ---- #7: zero-trust header spoofing neutralized ----------------------------
function benchHeaderSpoof() {
  const N = 10_000;
  let neutralized = 0;
  const verifiedAuth = { subjectId: "real-user", userId: "real-user", role: "Customer", roles: ["Customer"], scopes: ["rides:read"], permissions: [] };
  for (let i = 0; i < N; i++) {
    // attacker tries to inject elevated identity via client headers
    const headers = new Headers({
      "x-auth-role": "Admin",
      "x-auth-user-id": "attacker",
      "x-auth-scopes": "admin:all",
      "x-auth-permissions": "payments:write",
      "x-auth-context-source": "spoofed",
    });
    const out = applyForwardedAuthHeaders(headers, verifiedAuth);
    const roleOk = out.get("x-auth-role") === "Customer";
    const userOk = out.get("x-auth-user-id") === "real-user";
    const scopeOk = out.get("x-auth-scopes") === "rides:read";
    const sourceOk = out.get("x-auth-context-source") === "api-gateway";
    if (roleOk && userOk && scopeOk && sourceOk) neutralized++;
  }
  // detection of forwarded auth headers
  const detected = ["x-auth-role", "X-Auth-Scopes", "x-auth-user-id"].every(isForwardedAuthHeader) && !isForwardedAuthHeader("authorization");
  results.headerSpoof = {
    attempts: N,
    neutralized,
    neutralizedPct: +(100 * neutralized / N).toFixed(2),
    detectorCorrect: detected,
  };
}

// ---- bonus: argon2id password hashing cost ---------------------------------
async function benchArgon2() {
  const opts = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
  const t = [];
  for (let i = 0; i < 20; i++) {
    const a = now();
    await argon2.hash("Sup3rSecret!" + i, opts);
    t.push(now() - a);
  }
  results.argon2 = { samples: 20, latencyMs: stats(t), memoryCostKiB: 19456, config: "argon2id t=2 p=1" };
}

async function main() {
  const { privateKey, jwks } = await setupKeys();
  await benchJwtVerify(privateKey, jwks);
  await benchJwksCache(privateKey, jwks);
  await benchAuthzLatency();
  await benchCoverage();
  benchHeaderSpoof();
  await benchArgon2();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
