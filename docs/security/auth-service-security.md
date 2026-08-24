# CAB-BOOKING Security Review Workflow ? WORKFLOW 01 — AUTH-SERVICE

Ngày tạo: `2026-04-20`

Phạm vi tài liệu này là tạo một bộ workflow thực chiến để từng thành viên trong team tự rà service của mình theo đúng trust boundary của CAB-BOOKING. Tài liệu này không kết luận hệ thống "an toàn"; nó chỉ định nghĩa cách đọc evidence, cách chấm PASS/FAIL, các gap sơ bộ đã thấy trong repo, và cách chuyển từ review sang fix mode.

## 1. SYSTEM SECURITY OVERVIEW

### 1.1 Kiến trúc CAB-BOOKING liên quan trực tiếp tới auth-service

- CAB-BOOKING là kiến trúc `microservices + event-driven + Zero Trust`.
- Backend entry point là `gateway/api-gateway`, đóng vai trò `Policy Enforcement Point`.
- `auth-service` là central IAM trust anchor cho access token, refresh token, revoke, MFA, và auth context seed cho các service khác.
- Dependency chính ảnh hưởng auth boundary:
  - `gateway/api-gateway`
  - `data-layer/postgresql`
  - `data-layer/redis`
  - `services/notification-service`
- Các frontend/client đi vào boundary auth qua gateway, nên `HTTPS/TLS`, edge rate limit, brute-force protection, và login throttling là một phần của auth review; nhưng chỉ xem ở mức ảnh hưởng trực tiếp tới login, refresh, MFA, revoke.

### 1.2 Kiến trúc security rules cần giữ khi review auth-service

- `Never trust, always verify`.
- Không giả định traffic nội bộ là trusted chỉ vì đang ở cùng network hoặc sau gateway.
- Gateway là `Policy Enforcement Point`, nhưng không được assume gateway đã enforce đủ `scope`, `role`, `permission` cho downstream.
- Auth-service là trust anchor, nhưng không được coi là đủ an toàn nếu downstream chỉ tin forwarded auth header mà không có evidence consume/verify auth context.
- JWT phải short-lived, có verify `issuer`, `audience`, `algorithm`, expiry, và key selection rõ ràng.
- Refresh token phải có rotation, replay detection, revoke path, và blacklist/revocation marker rõ.
- Admin auth phải có MFA.
- Secret/key material không được hard-code.
- Audit/security logging phải đủ để điều tra và đẩy lên centralized logging / SIEM.
- PASS chỉ được ghi nhận khi có evidence trong code, config, test, hoặc runtime artifact nằm trong repo.
- Nếu chỉ có doc/topology mà chưa có runtime evidence, trạng thái phải là `Expected by architecture` hoặc `Evidence still needed`, không phải PASS.

### 1.3 Trust boundaries cần theo dõi cho auth-service

- `Client -> Gateway -> Auth-service`
  - Kiểm tra `HTTPS/TLS` bắt buộc, rate limit, brute-force control, device/IP/user throttling nếu áp vào login, refresh, MFA.
- `Gateway -> Auth-service JWKS` và `Gateway -> Auth-service /me`
  - Kiểm tra dependency này có fail-open hay không khi auth-service hoặc JWKS path lỗi.
- `Auth-service -> PostgreSQL`
  - Kiểm tra session, refresh family, MFA secret, audit data không bị lộ hoặc fail-open khi DB/cache gặp sự cố.
- `Auth-service -> Redis`
  - Kiểm tra revoke marker, rate limit state, replay detection, brute-force counters.
- `Auth-service -> notification-service`
  - Kiểm tra OTP/MFA delivery path không trust-by-network mù quáng.
- `Service -> Service`
  - Kiểm tra service-to-service auth đang dựa vào gì: `mTLS`, `service identity`, service mesh, signed internal identity, hay chỉ trust-by-network.
  - Nếu chưa có runtime evidence thì ghi `Expected by architecture`, không ghi PASS.

### 1.4 Repo-backed auth observations phải giữ trong đầu khi review

- `gateway/api-gateway/src/middleware/authorization.js` đang thể hiện role enforcement, nhưng chưa thấy evidence rõ cho `scope / permission enforcement` downstream.
- `gateway/api-gateway/src/security/jwt-service.js` là path quan trọng để xác minh gateway đang verify token theo trust contract của auth-service.
- `infra/docker-swarm/docker-stack.yml` và runtime repo hiện chưa cho thấy evidence rõ về `mTLS / service identity / mesh`, nên chưa được assume zero-trust nội bộ đã được triển khai.
- `services/auth-service/src/lib/jwt.js`, `services/auth-service/src/services/session.service.js`, `services/auth-service/src/services/mfa.service.js`, `services/auth-service/sql/schema.sql` là core evidence cho JWT, refresh rotation, revoke, MFA, audit.
- Cần xác minh `secret_encrypted` trong DB có thật sự được mã hóa hay chỉ là field name.
- Cần xác minh downstream service có consume và kiểm tra auth context từ auth-service/gateway hay chỉ tin forwarded header.

## 2. COMMON ZERO TRUST BASELINE

### 2.1 Authentication baseline

- Kiểm tra access token là short-lived, có verify `issuer`, `audience`, `algorithm`, expiry, revocation.
- PASS khi code verify token có controls rõ và request không-auth bị reject.
- FAIL khi token chỉ được parse sơ sài, không verify claim quan trọng, hoặc service tin header forwarded mù quáng.

### 2.2 Authorization baseline

- Kiểm tra authorization xảy ra ở cả gateway và service/domain layer cho resource ownership hoặc state-sensitive action.
- PASS khi action nhạy cảm có RBAC/ABAC/ownership evidence.
- FAIL khi chỉ check authentication mà không check actor có quyền trên resource cụ thể.

### 2.3 RBAC baseline

- Kiểm tra mapping `Customer / Driver / Admin`.
- PASS khi route nhạy cảm và hành động admin/driver-only có role gate rõ.
- FAIL khi role có thể bị đổi từ payload, không có guard, hoặc logic admin/user chung một path không có tách biệt.

### 2.4 ABAC baseline

- Kiểm tra context động như `ride status`, `location`, `KYC status`, `approval status`, `ownership`.
- PASS khi hành động stateful có điều kiện ngữ cảnh trong code.
- FAIL khi chỉ có tài liệu nói ABAC nhưng code không thể hiện rule.

### 2.5 Gateway enforcement baseline

- Kiểm tra JWT/JWKS, route mapping, validation schema, rate limit, idempotency, realtime auth handshake.
- PASS khi gateway reject request xấu trước khi proxy và giữ request context nhất quán.
- FAIL khi route quan trọng đi qua gateway mà thiếu validation/rate-limit/idempotency hoặc auth bypass.

### 2.6 Service-to-service trust baseline

- Kiểm tra evidence mTLS, service identity, zero trust nội bộ.
- PASS khi có config/runtime evidence thực.
- FAIL khi chỉ có architecture doc, hoặc internal call dùng plain trust-by-network.
- Nếu không có evidence, đánh dấu `Expected by architecture`, không đánh dấu PASS.

### 2.7 Secrets management baseline

- Kiểm tra secrets không hard-code, không commit key thật, có dấu hiệu rotation/manager.
- PASS khi secret chỉ đi qua env/secret store và không lộ trong doc hoặc sample runtime file.
- FAIL khi thấy hard-coded secret, debug artifact chứa secret, hoặc không có evidence key lifecycle.

### 2.8 Sensitive data handling baseline

- Kiểm tra PII, payment, MFA/TOTP seed, phone/email, payment reference, location data.
- PASS khi có masking, hạn chế log, DB schema phù hợp, và interface không lộ raw sensitive value quá mức.
- FAIL khi PII/payment/location bị log thô hoặc exposed không cần thiết.

### 2.9 Event-driven security baseline

- Kiểm tra event producer/consumer coi broker input là untrusted.
- PASS khi event có schema validation, idempotency/replay defense, topic allowlist, forged-event handling.
- FAIL khi consumer parse JSON và xử lý thẳng không validate payload/risk source.

### 2.10 WebSocket/Webhook security baseline

- Kiểm tra handshake auth, per-message authorization, rate limit, replay/forgery, callback signature verification.
- PASS khi handshake và per-message checks đều có.
- FAIL khi WS/webhook tin payload trực tiếp hoặc không có signature/replay control.

### 2.11 Logging / Audit / Monitoring baseline

- Kiểm tra audit cho login, payment, permission change, admin action, sensitive mutation.
- PASS khi có audit repository/service hoặc pipeline rõ.
- FAIL khi action nhạy cảm không có audit evidence hoặc log quá nghèo để điều tra.

### 2.12 Resilience-abuse baseline

- Kiểm tra retry, timeout, circuit breaker, backoff, graceful degradation dưới góc nhìn abuse.
- PASS khi retry không gây duplicate side effect và timeout/fallback có guard.
- FAIL khi retry/fallback có thể bypass control, double charge, hoặc mở abuse surface.

### 2.13 Misconfiguration / insecure default baseline

- Kiểm tra `.env.example`, `Dockerfile`, stack config, store mode, health endpoint, debug endpoint.
- PASS khi default an toàn hoặc clearly non-production.
- FAIL khi default mở rộng attack surface hoặc để plain transport/weak limits trong môi trường triển khai.

### 2.14 AI/ML trust boundary baseline

- Kiểm tra feature ingestion, model serving auth, dataset access, poisoning path, PII minimization.
- PASS khi trust boundary và authz rõ.
- FAIL khi AI/ML chỉ được mô tả bằng topology nhưng không có control evidence cho serving/dataset.

### 2.15 Failure-scenario-driven review baseline

- Kiểm tra behavior khi `auth down`, `DB down`, `Redis down`, `Kafka lag`, `timeout`, `fallback`.
- PASS khi failure không mở đường bypass security.
- FAIL khi failure mode tự động degrade sang path không auth hoặc không idempotent.

### 2.16 Common PASS / FAIL criteria

- Chỉ ghi `PASS` khi có evidence trong code, config, schema, test, hoặc runtime artifact đang nằm trong repo.
- Ghi `FAIL` khi control thiếu, sai, bypassable, hoặc logic đang trái với kiến trúc CAB-BOOKING.
- Ghi `Expected by architecture` khi control có trong tài liệu/topology nhưng chưa thấy repo evidence đủ mạnh.
- Ghi `Evidence still needed` khi path hoặc runtime config còn thiếu để kết luận.

## 3. SERVICE WORKFLOW MATRIX

| Workflow | Repo status | Vai trò | Risk nổi bật | Dependency chính | Security focus chính |
| --- | --- | --- | --- | --- | --- |
| Auth | Observed | Identity authority | auth bypass, refresh replay, MFA gap | Postgres, Redis, gateway, notification | JWT, session, revoke, MFA, audit |
| Booking | Observed | Tạo và hủy booking | IDOR, duplicate booking, price tampering | MongoDB, gateway, pricing, broker | ownership, idempotency, price snapshot |
| Driver | Observed | Driver profile và trạng thái | privilege escalation, KYC leak, status abuse | MongoDB, gateway, broker | driver ownership, KYC/approval ABAC |
| Notification | Observed | Event-to-user notification | forged event, spam abuse, open relay | Kafka, MongoDB, dispatcher | consumer validation, dedupe, provider secret |
| Payment | Observed | Payment lifecycle | double charge, refund abuse, webhook forgery | MongoDB, gateway, provider integration expected | idempotency, state machine, callback auth |
| Pricing | Observed | Fare và surge | client-controlled fare, config abuse | MongoDB, gateway, booking | server-side quote integrity |
| Review | Observed | Review và rating | fake review, duplicate review, stored XSS | in-memory store, gateway, broker | completed-ride eligibility, sanitize |
| Ride | Observed | Ride lifecycle và GPS realtime | socket auth bypass, forged GPS, invalid transition | MongoDB, Redis, gateway, driver app | state machine, GPS authz, event/realtime |
| User | Observed | User profile và account data | IDOR, mass assignment, PII leak | Postgres, gateway | ownership, admin separation, masking |
| ETA | Expected | ETA prediction | poisoned location input, unsafe fallback, key leak | Redis Geo expected, routing API expected, ride module | GPS schema, cache TTL, external API safety |
| ML Platform | Expected | Feature store, training, serving | unauth serving, data leak, poisoning | feature store, model serving API, AI topology | inference auth, dataset access, audit lifecycle |

## 4. WORKFLOW 01 — AUTH-SERVICE

### Service Security Context

- Business role: cấp danh tính, issue access token, refresh token, logout, MFA cho admin.
- Security role: trust anchor cho JWT, refresh rotation, revocation, RBAC/ABAC context seed.
- Inbound interfaces:
  - `POST /api/v1/auth/login/otp/request`
  - `POST /api/v1/auth/login/otp/verify`
  - `POST /api/v1/auth/login/admin`
  - `POST /api/v1/auth/mfa/challenge`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/oauth/token`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/oauth/revoke`
  - `POST /api/v1/auth/logout-all`
  - `GET /api/v1/auth/me`
  - `GET /.well-known/jwks.json`
- Outbound dependencies: PostgreSQL, Redis, notification-service, gateway JWKS consumers.
- Dữ liệu nhạy cảm: password hash, refresh token family, session state, MFA secret, recovery codes, audit log, phone/email.
- Observed in repo:
  - `services/auth-service/src/lib/jwt.js`
  - `services/auth-service/src/services/session.service.js`
  - `services/auth-service/src/services/mfa.service.js`
  - `services/auth-service/sql/schema.sql`
  - `gateway/api-gateway/src/security/jwt-service.js`
- Expected by CAB architecture:
  - short-lived JWT + refresh rotation + revoke blacklist + admin MFA + audit.
- Preliminary repo-backed concerns:
  - Cần xác minh `secret_encrypted` trong DB có thật sự được mã hóa hay chỉ là field name.
  - Cần xác minh downstream service có kiểm tra auth context độc lập hay chỉ tin gateway.

### Trust Boundaries

- `Client -> Gateway -> Auth-service`
- `Gateway -> Auth-service JWKS` và `Gateway -> Auth-service /me`
- `Auth-service -> PostgreSQL`
- `Auth-service -> Redis` cho rate limit và revoked session marker
- `Auth-service -> notification-service` cho OTP/MFA delivery

### Attack Surface

- HTTP APIs cho login, refresh, revoke, logout, admin MFA.
- Internal auth context resolution qua `/me`.
- JWKS exposure.
- Rate-limit path và failure-policy path.
- Không có WebSocket riêng, nhưng trust boundary với gateway rất nhạy cảm.

### Files/Paths To Review First

- `services/auth-service/src/app.js`
- `services/auth-service/src/routes/session.routes.js`
- `services/auth-service/src/routes/admin-auth.routes.js`
- `services/auth-service/src/lib/jwt.js`
- `services/auth-service/src/services/session.service.js`
- `services/auth-service/src/services/mfa.service.js`
- `services/auth-service/src/middleware/auth-rate-limit.middleware.js`
- `services/auth-service/src/repositories/audit.repository.js`
- `services/auth-service/sql/schema.sql`
- `gateway/api-gateway/src/security/jwt-service.js`
- `gateway/api-gateway/src/route-registry.js`

### Step-by-step Review Workflow

1. Review token issue và verify flow.
   - Đọc: `services/auth-service/src/lib/jwt.js`, `services/auth-service/src/config/security.js`, `gateway/api-gateway/src/security/jwt-service.js`
   - Kiểm tra: token có `issuer`, `audience`, `algorithm`, `kid`, `expiry`; gateway có verify RS256 và JWKS không.
   - PASS evidence: có `jwtVerify(... issuer, audience, algorithms: ["RS256"])` và token sign set đầy đủ claim.
   - FAIL evidence: verify thiếu issuer/audience/alg hoặc fallback sang parse token không verify.
2. Review `scope / role / permission` enforcement từ gateway sang downstream.
   - Đọc: `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/security/jwt-service.js`, `gateway/api-gateway/src/route-registry.js`, các service downstream đang consume auth context qua header/request context.
   - Kiểm tra:
     - gateway có enforce `scope`, `role`, `permission` hay chỉ `role`
     - auth context có được forward nhất quán xuống downstream không
     - downstream service có consume và kiểm tra auth context này không
   - PASS evidence: thấy rule hoặc middleware rõ cho `scope/permission`, và downstream có code consume/verify context cho action nhạy cảm.
   - FAIL evidence: gateway chỉ check `role` sơ sài, hoặc downstream chỉ tin payload/header mà không verify ownership/permission.
   - Nếu chưa thấy đủ evidence downstream consume auth context, ghi `Evidence still needed`, không PASS.
3. Review refresh rotation, replay detection, revoke.
   - Đọc: `services/auth-service/src/services/session.service.js`, `services/auth-service/src/repositories/refresh-tokens.repository.js`, `services/auth-service/src/lib/redis.js`
   - Kiểm tra: rotate refresh token, mark used token, detect reuse, revoke family/session, mark revoked session trên Redis.
   - PASS evidence: `markTokenUsed`, `handleTokenReuse`, `revokeFamily`, `markSessionRevoked`.
   - FAIL evidence: refresh token reuse không vô hiệu session family hoặc logout không revoke được session cũ.
4. Review admin MFA và password login path.
   - Đọc: `services/auth-service/src/services/admin-auth.service.js`, `services/auth-service/src/services/mfa.service.js`, `services/auth-service/src/lib/totp.js`
   - Kiểm tra: admin login có MFA challenge, TOTP/recovery code flow, bootstrap admin path, brute-force lock.
   - PASS evidence: admin login trả challenge thay vì token trực tiếp; MFA verify mới issue token.
   - FAIL evidence: admin login issue token ngay, hoặc MFA secret/recovery flow thiếu verify rõ.
5. Review client & edge security context liên quan trực tiếp tới auth.
   - Đọc: `gateway/api-gateway/src/middleware/*`, auth routes tại gateway nếu có, `services/auth-service/src/middleware/auth-rate-limit.middleware.js`, config/proxy docs liên quan TLS hoặc edge policy.
   - Kiểm tra:
     - login, refresh, MFA, revoke có yêu cầu `HTTPS/TLS` hoặc deployment assumption rõ không
     - có `WAF / rate limit / brute-force protection` ở gateway/edge cho auth path không
     - có device/IP/user throttling nếu liên quan login, refresh, MFA không
   - PASS evidence: auth path có edge guard rõ, rate limit áp đúng endpoint nhạy cảm, và không thấy path auth chạy plain transport như production default.
   - FAIL evidence: auth path có thể đi qua weak/no TLS assumption, không có brute-force control, hoặc refresh/MFA không có throttling.
   - Nếu chỉ thấy requirement trong doc/infra mà chưa có runtime enforcement, ghi `Expected by architecture` hoặc `Evidence still needed`.
6. Review rate limit và abuse protection ở auth-service.
   - Đọc: `services/auth-service/src/middleware/auth-rate-limit.middleware.js`, `services/auth-service/src/routes/*.js`
   - Kiểm tra: login/refresh/admin endpoints đều có rate limit và validation middleware.
   - PASS evidence: route auth quan trọng đi qua `authRateLimitMiddleware` và schema validation.
   - FAIL evidence: endpoint auth nhạy cảm không có rate limit hoặc có limit quá lỏng không giải thích được.
7. Review `mTLS / service identity / zero-trust nội bộ`.
   - Đọc: `infra/docker-swarm/docker-stack.yml`, `platform/architecture/security-topology.js`, `platform/architecture/service-manifests.js`, config/runtime path thể hiện internal auth.
   - Kiểm tra:
     - service-to-service auth hiện đang dựa vào gì
     - có evidence `mTLS`, `service identity`, service mesh, hoặc signed internal identity không
     - auth-service khi gọi notification-service hoặc được gateway/service khác gọi có identity-bound protection hay không
   - PASS evidence: có runtime config/code cho mTLS, internal identity verification, hoặc mesh policy đang thật sự được dùng.
   - FAIL evidence: internal call chỉ dựa vào network placement, internal DNS, hoặc shared secret không có verify boundary rõ.
   - Nếu chỉ có topology/doc kiến trúc mà chưa có runtime evidence, ghi `Expected by architecture`, không PASS.
8. Review logging / audit / SIEM readiness và sensitive data handling.
   - Đọc: `services/auth-service/src/services/audit.service.js`, `services/auth-service/src/repositories/audit.repository.js`, `services/auth-service/sql/schema.sql`
   - Kiểm tra:
     - có log/audit cho login, refresh, logout, MFA, revoke, admin auth
     - log có đủ structure để đẩy vào centralized logging / SIEM không
     - có `correlation ID`, `request ID`, `actor`, `action`, `result`, `timestamp` không
     - log có lộ secret, token, OTP, MFA seed, recovery code hay không
   - PASS evidence: có audit/log path rõ cho action auth quan trọng, structure đủ trường điều tra, và không log raw secret/token/OTP.
   - FAIL evidence: thiếu log ở auth action trọng yếu, log thiếu trường correlation/actor/result, hoặc log lộ dữ liệu nhạy cảm.
9. Review failure-scenario-driven behavior của auth-service.
   - Đọc: `services/auth-service/src/app.js`, `services/auth-service/src/services/session.service.js`, `services/auth-service/src/lib/redis.js`, `gateway/api-gateway/src/security/jwt-service.js`, config retry/fallback nếu có.
   - Kiểm tra theo từng scenario:
     - `auth-service down`
       - Expected safe behavior: gateway/downstream không fail-open cho protected path; auth-dependent flow phải fail closed hoặc degrade an toàn.
       - Fail-open risk cần bắt: bypass auth do skip introspection/JWKS fetch failure handling.
       - PASS/FAIL evidence cần tìm: error handling trả reject rõ, không có fallback cho qua request.
     - `Redis down`
       - Expected safe behavior: revoke marker, replay detection, brute-force counter không silently bỏ qua làm mở bypass lớn.
       - Fail-open risk cần bắt: refresh/revoke/login flow vẫn cho qua dù mất cache state.
       - PASS/FAIL evidence cần tìm: explicit fail-safe path, bounded degradation, hoặc reject rõ ở flow phụ thuộc Redis.
     - `JWKS unavailable`
       - Expected safe behavior: verifier không chấp nhận token mới/không xác minh được chỉ vì JWKS fetch lỗi.
       - Fail-open risk cần bắt: cache stale vô hạn, parse token không verify, skip signature check.
       - PASS/FAIL evidence cần tìm: verifier fail closed, cache policy có TTL hợp lý, error path rõ.
     - `refresh/revoke cache failure`
       - Expected safe behavior: không issue refresh/access token mới nếu không thể ghi/đọc revoke-replay state cần thiết.
       - Fail-open risk cần bắt: refresh token replay không bị phát hiện vì cache error bị nuốt.
       - PASS/FAIL evidence cần tìm: transaction/order of operations, explicit error handling, no silent success.
     - `brute-force / token leak`
       - Expected safe behavior: rate limit, lockout/challenge, revoke path, audit spike, và blast radius bị giới hạn.
       - Fail-open risk cần bắt: leaked token tiếp tục dùng vô hạn, brute-force không bị chặn, admin auth không tăng friction.
       - PASS/FAIL evidence cần tìm: throttle counters, alertable audit path, revoke/reuse detection, admin MFA enforcement cả khi abuse đang diễn ra.

### PASS/FAIL Checklist

- Access token verify có `issuer`, `audience`, `algorithms`.
- Gateway enforcement không chỉ dừng ở `RBAC`; phải có evidence rõ cho `scope / role / permission`, hoặc ghi `Evidence still needed`.
- Downstream service consume và kiểm tra auth context cho action nhạy cảm; nếu chưa có evidence thì không PASS.
- Refresh token được rotate ở mỗi lần refresh thành công.
- Refresh replay bị phát hiện và revoke cả family/session.
- Logout/logout-all ghi revoked marker hoặc revoke family rõ ràng.
- Admin password login không bypass MFA.
- Auth path liên quan login/refresh/MFA có `HTTPS/TLS` assumption rõ và edge brute-force / rate-limit control phù hợp.
- OTP/MFA/admin flows có rate limit và validation.
- Có evidence `device / IP / user throttling` nếu kiến trúc tuyên bố áp dụng cho login, refresh, MFA; nếu chưa thấy thì ghi `Evidence still needed`.
- Service-to-service trust không được assume nội bộ là trusted; chỉ PASS khi có runtime evidence `mTLS / service identity / mesh / signed internal identity`.
- Failure scenarios `auth-service down`, `Redis down`, `JWKS unavailable`, `refresh/revoke cache failure`, `brute-force / token leak` không dẫn tới fail-open.
- Audit/log tồn tại cho login, refresh, logout, MFA, revoke, admin auth, reuse detection.
- Log đủ structure cho centralized logging / SIEM: `correlation ID`, `request ID`, `actor`, `action`, `result`, `timestamp`.
- Không có evidence log lộ raw secret, token, OTP, MFA seed, recovery code.
- Không có evidence hard-coded private key hoặc raw secret bị commit.

### Findings Template

```md
- Missing:
- Incorrect:
- Risk:
- Severity:
- Evidence:
- Fix Direction:
```

### Evidence Still Needed

- Evidence key rotation hoặc secret manager cho JWT key material.
- Evidence `secret_encrypted` được encrypt thật trước khi lưu DB.
- Evidence gateway enforce được `scope / permission`, không chỉ `role`.
- Evidence service downstream ngoài gateway không tin mù header auth forwarding, và thực sự consume/verify auth context.
- Evidence `mTLS / service identity / mesh / signed internal identity` cho internal auth path; nếu mới có doc kiến trúc thì giữ trạng thái `Expected by architecture`.
- Evidence `HTTPS/TLS` và edge control bắt buộc cho auth endpoints ở deployment/runtime path.
- Evidence fail-safe behavior khi `auth-service`, `Redis`, hoặc JWKS path unavailable.
- Evidence log/audit structure đủ để đẩy vào centralized logging / SIEM mà không lộ secret.

### Fix Priority

- P0: auth bypass, weak JWT verify, refresh replay không revoke, admin MFA bypass.
- P1: thiếu audit, rate limit yếu, revoke marker không nhất quán, secret handling không rõ.
- P2: cleanup docs/config, observability, failure drill coverage.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/auth-service/src/app.js`
   - `services/auth-service/src/services/session.service.js`
   - `services/auth-service/src/lib/jwt.js`
   - `services/auth-service/src/services/mfa.service.js`
   - `gateway/api-gateway/src/security/jwt-service.js`
4. So sánh code với checklist.
5. Ghi findings theo template và tách rõ `Observed`, `Expected`, `Evidence still needed`.

### AI Review Prompt

```text
Bạn là security reviewer cho auth-service của CAB-BOOKING theo mô hình Zero Trust.

Ưu tiên đọc:
- services/auth-service/src/app.js
- services/auth-service/src/lib/jwt.js
- services/auth-service/src/services/session.service.js
- services/auth-service/src/services/mfa.service.js
- services/auth-service/src/middleware/auth-rate-limit.middleware.js
- services/auth-service/sql/schema.sql
- gateway/api-gateway/src/security/jwt-service.js

Tập trung bắt:
- auth bypass
- weak JWT verify
- missing issuer/audience/algorithm validation
- long-lived token
- refresh replay
- missing revoke/blacklist
- hard-coded secret
- missing MFA cho admin
- thiếu audit cho login/refresh/logout

Rules:
- Không kết luận an toàn nếu thiếu evidence trong code/config.
- Không assume gateway đã làm đủ.
- Phân tách rõ Observed in repo, Expected by architecture, Evidence still needed.

Đầu ra cần có:
- Findings theo format Missing / Incorrect / Risk / Severity / Evidence / Fix Direction
- PASS/FAIL checklist result
- Evidence còn thiếu
- Fix priority P0/P1/P2
```

## 15. CROSS-SERVICE SECURITY GAPS TO LOOK FOR

### 15.1 Gateway vs downstream auth gaps

- Gateway có `JWT/JWKS/RBAC/idempotency` trong:
  - `gateway/api-gateway/src/security/jwt-service.js`
  - `gateway/api-gateway/src/middleware/authorization.js`
  - `gateway/api-gateway/src/middleware/idempotency.js`
- Nhưng auth review phải kiểm tra thêm `scope / permission enforcement`, không chỉ `role`.
- Nhưng nhiều service downstream vẫn nhận `userId`, `driverId`, `role-sensitive fields` trực tiếp từ payload/path:
  - `services/booking-service/src/controllers/bookingController.js`
  - `services/ride-service/src/controllers/ride.controller.js`
  - `services/user-service/src/schemas/user-schemas.js`
- Gap cần tìm:
  - gateway có thật sự enforce `scope / permission` hay không
  - downstream có thực sự tự verify ownership/context hay chỉ tin gateway
  - auth context có bị degrade thành trust-by-header hay trust-by-payload hay không

### 15.2 Service-to-service trust gaps

- `platform/architecture/security-topology.js` yêu cầu `mTLS + service identity`.
- `infra/docker-swarm/docker-stack.yml` và runtime repo hiện chưa có evidence mesh/mTLS.
- Gap cần tìm:
  - auth-service có đang được bảo vệ bởi identity-bound internal auth hay không
  - gateway -> auth-service, auth-service -> notification-service, service -> auth context resolution có đang trust-by-network hay không
  - nếu mới có topology/doc thì phải giữ kết luận ở mức `Expected by architecture`

### 15.3 Client / edge auth protection gaps

- Auth path phụ thuộc nhiều vào edge controls hơn các service khác.
- Gap cần tìm:
  - login, refresh, MFA, revoke có bắt buộc đi qua `HTTPS/TLS` hay không
  - edge/gateway có WAF, brute-force protection, device/IP/user throttling hay không
  - rate limit có áp đều cho login, refresh, MFA thay vì chỉ áp một phần flow

### 15.4 Secrets / config gaps

- `infra/docker-swarm/docker-stack.yml` truyền nhiều secret qua env.
- Chưa có evidence secret manager / key rotation / vault integration trong runtime code.
- `services/auth-service/images/.gitignore` còn nhắc tới local MFA pages chứa secret, nên cần rà artifact cẩn thận.
- Gap cần tìm: secrets chỉ ở env file, hard-coded fallback, sample file lộ thông tin nhạy cảm, JWT key material lifecycle không rõ.

### 15.5 Logging / audit / SIEM gaps

- Auth có audit path khá rõ nhưng chưa đủ để assume SIEM readiness.
- Gap cần tìm:
  - login, refresh, logout, MFA, revoke, admin auth có log/audit đầy đủ hay không
  - log có đủ `correlation ID / request ID / actor / action / result / timestamp` hay không
  - log có thể đưa vào centralized logging / SIEM mà không lộ token, OTP, MFA seed, recovery code hay không

## 16. FINAL INSTRUCTIONS FOR DEVELOPERS

### 16.1 Cách dùng workflow này để tự rà service của mình

1. Chọn workflow đúng service của bạn.
2. Đọc `Service Security Context` để biết scope review và trust boundary.
3. Mở `Files/Paths To Review First` trước, không đọc lan man.
4. Làm review theo đúng thứ tự trong `Step-by-step Review Workflow`.
5. Với mỗi bước, ghi rõ:
   - PASS evidence
   - FAIL evidence
   - Evidence still needed
6. Dùng `PASS/FAIL Checklist` để kết luận tạm thời.
7. Nếu còn path chưa đọc hoặc config chưa có trong repo, giữ kết luận ở mức `missing evidence`.

### 16.2 Cách dùng Quick Start và AI Review Prompt

- `Quick Start for Developer` là lối vào nhanh cho người đang sửa service đó.
- `AI Review Prompt` dùng để copy nguyên khối vào Codex hoặc AI nội bộ.
- Khi dùng prompt:
  - giữ nguyên list file ưu tiên
  - thêm diff/branch hiện tại nếu bạn đang review code mới
  - yêu cầu AI trả kết quả theo findings template

### 16.3 Cách ghi evidence

- Evidence tốt phải chỉ ra path thật trong repo.
- Ưu tiên evidence theo thứ tự:
  - code path
  - schema/model
  - config/infra artifact
  - test
  - doc kiến trúc
- Không dùng câu kiểu "có vẻ", "chắc là", "gateway sẽ xử lý".
- Nếu evidence chỉ nằm ở tài liệu kiến trúc mà chưa có runtime code/config, ghi:
  - `Expected by architecture`
  - `Evidence still needed: runtime implementation`

### 16.4 Cách phân loại severity và fix priority

- `P0`
  - auth bypass
  - privilege escalation
  - socket/webhook/event forgery
  - secret leak
  - double charge
  - model serving không auth
  - GPS/location auth bypass
- `P1`
  - thiếu audit
  - thiếu idempotency/replay protection
  - ownership/ABAC validation chưa đủ
  - sensitive data masking chưa đủ
- `P2`
  - config hygiene
  - observability
  - docs/topology alignment
  - non-critical resilience hardening

### 16.5 Khi nào chuyển từ review mode sang fix mode

- Chuyển sang fix mode khi:
  - đã có evidence path rõ
  - đã gắn severity/fix priority
  - đã biết file cần sửa
  - đã xác định control target cần đạt
- Không chuyển sang fix mode khi:
  - vẫn thiếu runtime evidence
  - chưa rõ owner/resource boundary
  - chỉ mới có architecture expectation

### 16.6 Quy tắc review bắt buộc

- Không kết luận an toàn nếu chưa có evidence.
- Không assume gateway đã làm đủ.
- Không assume traffic nội bộ là trusted.
- Không assume broker event là trusted.
- Không assume fallback/retry là an toàn.
- Không assume env file là an toàn.
- Không assume có ABAC chỉ vì đã có RBAC.
- Không assume replay đã được xử lý nếu chưa thấy idempotency hoặc replay guard rõ.

### 16.7 Mẫu kết quả tối thiểu sau một lần self-review

```md
Service: <service-name>

Observed in repo:
- ...

Expected by architecture:
- ...

Findings:
- Missing:
  Incorrect:
  Risk:
  Severity:
  Evidence:
  Fix Direction:

Evidence still needed:
- ...

Fix priority:
- P0:
- P1:
- P2:
```

### 16.8 Definition of done cho một vòng review

- Đã đọc hết path ưu tiên của workflow.
- Đã đi qua toàn bộ `Step-by-step Review Workflow`.
- Đã đánh dấu từng checklist item là `PASS`, `FAIL`, hoặc `Missing evidence`.
- Đã ghi findings có evidence path cụ thể.
- Đã phân loại P0/P1/P2.
- Nếu service là `expected architecture workflow`, đã tách rõ phần nào chỉ là topology expectation.
