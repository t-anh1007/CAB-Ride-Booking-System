# Auth Service dry-run checklist (synced with Postman 2026)

This checklist matches the live Postman collection **CAB System - Auth Service 2026** (workspace: My Workspace).

| Artifact | Postman | Repo export (optional backup) |
|----------|---------|-------------------------------|
| Collection | **CAB System - Auth Service 2026** — id `316124d3-4f80-4ddf-8f8c-2fc3a0d5c10c`, uid `47840465-316124d3-4f80-4ddf-8f8c-2fc3a0d5c10c` | `postman/auth-service-mvp.postman_collection.json` (re-export if you need file parity) |
| Environment | **CAB System - Auth Service Local 2026** — id `0bc794f5-1a9c-4668-bdf8-1655c664568a` | `postman/auth-service-local.postman_environment.json` |

**Collection description (from Postman):** Fresh Postman collection for the CAB booking project auth flows. Covers authentication, authorization, JWT/OAuth2, RBAC/ABAC, gateway-protected routes, and manual failure-policy drills.

**Last synced from Postman API:** collection `updatedAt` 2026-04-09T21:09:54.000Z (info `updatedAt` 2026-04-09T21:13:43.000Z on nested items where applicable).

---

## Collection layout (folders → requests)

Use this to find requests in the Postman sidebar or when selecting folders in Collection Runner.

1. **Health**
   - `[Health] Gateway Health` — `GET {{gatewayBaseUrl}}/health`
   - `[Health] Auth Health` — `GET {{gatewayBaseUrl}}/auth/health` (tests allow **200** or **503**)
2. **Failure Policy** (manual chaos — see warnings below)
   - `[Failure Policy] Auth Upstream Down -> Protected Route 503` — `GET /protected/customer` with `Bearer {{accessToken}}`
   - `[Failure Policy] Redis Down -> OTP Request 503` — `POST /auth/login/otp/request`
   - `[Failure Policy] DB Down -> Admin Login 503` — `POST /auth/login/admin`
3. **Authorization (RBAC / ABAC)**
   - **ABAC**
     - `[ABAC] Driver Update Assigned Active Ride -> 200` — `PATCH .../ride/driver/rides/{{rideActiveAssignedId}}/location`
     - `[ABAC] Driver Update Completed Ride -> 403` — `PATCH .../{{rideCompletedAssignedId}}/location` (expects `RIDE_LOCATION_UPDATE_FORBIDDEN`)
     - **Why you may see 403 on the “active ride” case:** `ride-service` compares `ride.assignedDriverSubjectId` to the driver JWT `sub` (forwarded as `x-auth-subject-id`). The in-memory mock defaulted to `driver-1`, while OTP login gives a **random UUID** — so ABAC correctly returns `ride_not_assigned_to_driver`. Set env **`RIDE_ABAC_ASSIGNED_DRIVER_SUBJECT_ID`** to that driver’s `sub` (e.g. from `GET /auth/auth/me` with `driverAccessToken` or decode JWT), then `docker compose up -d --build ride-service` (or full stack), and the active-ride PATCH should return **200**.
   - **RBAC**
     - `[RBAC] Protected Customer - No Token -> 401`
     - `[RBAC] Protected Admin - Customer Token -> 403` — uses `Bearer {{accessToken}}`
     - `[RBAC] Protected Driver - Driver Token -> 200` — uses `Bearer {{driverAccessToken}}`
4. **Authentication**
   - **Driver OTP:** `[OTP Driver] Request OTP` → `[OTP Driver] Verify OTP`
   - **Admin MFA:** `[Admin] Password Login` → `[Admin] Complete MFA` (body uses `{{adminTotpCode}}`)
   - **Customer OTP:** `[OTP Customer] Request OTP` → `[OTP Customer] Verify OTP`
   - `[JWT] Auth Me - Customer` — `GET {{gatewayBaseUrl}}/auth/auth/me` with customer access token
5. **Session Lifecycle (JWT / OAuth2)**
   - `[OAuth2] Refresh Customer Token` — `POST /auth/refresh`
   - `[OAuth2] OAuth Token Alias` — `POST /auth/oauth/token` (`grant_type`, `refresh_token`)
   - `[OAuth2] OAuth Revoke Alias` — `POST /auth/oauth/revoke`

**Collection variables** (defaults in collection; mirror your environment): `gatewayBaseUrl`, `customerDestination`, `driverDestination`, `otpCode`, `accessToken`, `refreshToken`, `oldRefreshToken`, `driverAccessToken`, `driverRefreshToken`, `adminDestination`, `adminPassword`, `adminChallengeToken`, `adminTotpCode`, `adminAccessToken`, `adminRefreshToken`, `rideActiveAssignedId`, `rideCompletedAssignedId`, `driverLatitude`, `driverLongitude`.

Tests use **`pm.collectionVariables`** for tokens and OTP. Prefer selecting the **collection + environment** together in the runner so `{{gatewayBaseUrl}}` and secrets resolve consistently.

---

## Recommended run order (happy path + automated tests)

The folder order in Postman puts **Failure Policy** before flows that obtain tokens. For a first dry-run, follow this sequence instead of strict top-to-bottom.

### 0) Prerequisites

- Stack up: `docker-compose up --build` (or your dev compose).
- Postgres: database `cab_auth` exists and auth migrations are applied.
- `AUTH_BOOTSTRAP_ADMIN_EMAIL` / `AUTH_BOOTSTRAP_ADMIN_PASSWORD` match Postman `adminDestination` / `adminPassword`.
- Non-production auth so OTP debug is available; OTP request tests copy `data.debugOtpCode` into collection variable `otpCode` when present.
- **Admin MFA:** set `adminTotpCode` (or use recovery flow if you change the request) before `[Admin] Complete MFA`.

### 1) Health

- Run **Health** folder: gateway **200**; auth **200** or **503** per test script.

### 2) Customer OTP

- `[OTP Customer] Request OTP` → **202**; script stores OTP when `body.data.debugOtpCode` exists.
- `[OTP Customer] Verify OTP` → **200**; tokens saved to `accessToken` / `refreshToken`.

### 3) Session refresh + OAuth alias + revoke

- `[OAuth2] Refresh Customer Token` → **200**, rotated refresh token.
- `[OAuth2] OAuth Token Alias` → **200**, refresh rotated again.
- `[OAuth2] OAuth Revoke Alias` → **200** (run while `refreshToken` is still valid).

### 4) Driver OTP (needed for RBAC driver + ABAC)

- `[OTP Driver] Request OTP` → **202**
- `[OTP Driver] Verify OTP` → **200**; `driverAccessToken` / `driverRefreshToken` set.

### 5) RBAC + ABAC + Auth Me

- Run **RBAC** requests (customer token must exist before “Protected Admin - Customer Token”).
- Run **ABAC** patches (driver token + ride ids).
- `[JWT] Auth Me - Customer` — requires a valid **customer** `accessToken` (re-run customer verify or refresh if you revoked the session in step 3).

**Note:** If you already ran **OAuth Revoke**, customer refresh tokens may be invalid; you may need a fresh customer OTP session before `Auth Me` and RBAC requests that need `accessToken`.

### 6) Admin MFA

- `[Admin] Password Login` → **200**, `mfa_required`, `challengeToken` saved.
- `[Admin] Complete MFA` → **200**, admin tokens saved.

### 7) Failure Policy (manual)

Run only when you intentionally break dependencies. Read each request’s description in Postman.

- Expect **503** with `AUTH_SERVICE_UNAVAILABLE` when auth upstream is down (protected route with a token).
- Expect **503** `REDIS_UNAVAILABLE` when Redis is down (OTP request).
- Expect **503** `AUTH_DB_UNAVAILABLE` when Postgres is down (admin login).

Do **not** run these against a healthy stack expecting passes.

---

## Not covered by this collection (optional manual / future requests)

The following appeared in older checklists but **are not** present as requests in **CAB System - Auth Service 2026** as of the sync above:

- Refresh-token replay / family revocation (`REFRESH_TOKEN_REUSED`)
- `POST /auth/logout` and `POST /auth/logout-all`
- Abuse / rate-limit drills (OTP cooldown **429**, lock **423**, admin lockout)
- Failure drills for `POST /auth/refresh` or `POST /auth/oauth/token` with DB or Redis down

Add separate requests or a forked folder if you need regression coverage for those.

---

## Audit log spot-check (database)

After happy-path flows, you can still sample `audit_logs` (adjust event list to what your backend emits):

```sql
SELECT event_type, event_status, COUNT(*) AS total
FROM audit_logs
GROUP BY event_type, event_status
ORDER BY event_type, event_status;
```

---

## Sign-off

- All checks you intend to cover (collection + any manual extras) passed.
- Deviations documented with request/response evidence.
- Failure Policy drills executed only under controlled chaos conditions.
