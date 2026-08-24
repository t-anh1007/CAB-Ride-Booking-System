# CAB-BOOKING Security Review Workflow ? WORKFLOW 09 — USER-SERVICE

Ngày tạo: `2026-04-20`

Phạm vi tài liệu này là tạo một bộ workflow thực chiến để từng thành viên trong team tự rà service của mình theo đúng trust boundary của CAB-BOOKING. Tài liệu này không kết luận hệ thống "an toàn"; nó chỉ định nghĩa cách đọc evidence, cách chấm PASS/FAIL, các gap sơ bộ đã thấy trong repo, và cách chuyển từ review sang fix mode.

## 1. SYSTEM SECURITY OVERVIEW

### 1.1 Kiến trúc CAB-BOOKING tóm tắt

- CAB-BOOKING là kiến trúc `microservices + event-driven + real-time + AI-enabled + Zero Trust`.
- Frontend hiện diện dưới `apps/admin-dashboard`, `apps/customer-app`, `apps/driver-app`.
- Entry point phía backend là `gateway/api-gateway`.
- Repo hiện có 10 domain service thật dưới `services/`:
  - `auth-service`
  - `booking-service`
  - `driver-service`
  - `matching-service`
  - `notification-service`
  - `payment-service`
  - `pricing-service`
  - `review-service`
  - `ride-service`
  - `user-service`
- Data layer và broker hiện diện dưới:
  - `data-layer/postgresql`
  - `data-layer/mongodb`
  - `data-layer/redis`
  - `message-broker/kafka`
- Infra triển khai chính hiện bám `infra/docker-swarm/docker-stack.yml`.
- Lớp AI/ML và kiến trúc kỳ vọng hiện bám `platform/architecture/*`, `platform/ml/*`, `platform/node/ai-layer.js`.

### 1.2 Zero Trust principles dùng chung

- `Never trust, always verify`.
- Mọi request phải được xác thực và ủy quyền.
- Không giả định traffic nội bộ là trusted.
- Gateway là `Policy Enforcement Point`, nhưng không được assume gateway đã làm đủ.
- Event broker input, WebSocket message, internal callback, scheduler payload, và fallback path đều là `untrusted input`.
- PASS chỉ được ghi nhận khi có evidence trong code/config/runtime artifact.
- Nếu chỉ có tài liệu nhưng chưa có code hoặc config chứng minh, trạng thái phải là `Expected by architecture`, không phải `Implemented`.

### 1.3 Service discovery trong repo

| Thành phần | Trạng thái trong repo | Evidence chính | Ghi chú security |
| --- | --- | --- | --- |
| `auth-service` | Observed | `services/auth-service/*` | Có JWT, refresh rotation, revoke, MFA, audit path |
| `booking-service` | Observed | `services/booking-service/*` | Có idempotency ở service; event broker hiện mock |
| `driver-service` | Observed | `services/driver-service/*` | Có driver profile/location nhưng chưa thấy auth/audit |
| `notification-service` | Observed | `services/notification-service/*` | Có Kafka consumer, retry, dedupe, internal send endpoint |
| `payment-service` | Observed | `services/payment-service/*` | Có create/confirm/refund/idempotency; chưa thấy webhook verification path |
| `pricing-service` | Observed | `services/pricing-service/*` | Có quote/surge logic; client đang gửi demand/supply trực tiếp |
| `review-service` | Observed | `services/review-service/*` | Có one-review-per-ride; store hiện in-memory |
| `ride-service` | Observed | `services/ride-service/*` | Có lifecycle + WebSocket + ETA module nội bộ |
| `user-service` | Observed | `services/user-service/*` | Có user/profile/preferences/payment refs trên Postgres |
| `eta-service` | Expected architecture workflow | `services/ride-service/src/services/eta.service.js`, `platform/architecture/ai-topology.js`, `data-layer/redis/geo-topology.json` | Chưa tách service riêng |
| `matching-service` | Observed | `AI-ML/matching-service/*`, `platform/architecture/ai-topology.js`, `platform/ml/feature-store-topology.json`, `platform/node/ai-layer.js` | Có runtime FastAPI cho AI matching, feature store, training và background model serving |
| `api-gateway` | Observed, shared control plane | `gateway/api-gateway/*` | Không tạo workflow riêng; dùng như evidence xuyên suốt |

### 1.4 Trust boundaries tổng thể

- `Client -> Gateway`
  - Frontend app đi vào `api-gateway` qua HTTPS và WebSocket.
- `Gateway -> Service`
  - Route registry ánh xạ từ `/api/v1/*` sang service upstream.
- `Service -> Service`
  - Có kiến trúc mTLS/service identity ở mức expected architecture, nhưng repo hiện chưa có evidence triển khai mesh/mTLS thực.
- `Service -> DB/Redis/Broker`
  - Data ownership được mô tả trong `data-layer/*/ownership.json`.
- `Producer -> Broker -> Consumer`
  - Kafka topology có `payment.success`, `ride.created`, `driver.assigned`, `driver.location.updated`, `ride.status.changed`.
- `WebSocket / polling fallback`
  - Gateway có realtime hub; ride-service cũng có WebSocket server riêng trong codebase.
- `Service -> Third-party API`
  - Expected cho ETA routing/traffic API và payment callback provider, nhưng evidence runtime còn thiếu.
- `Service -> AI/ML serving / feature store`
  - Hiện là topology kỳ vọng trong `platform/architecture/ai-topology.js`, chưa có service tách riêng.

### 1.5 Repo-backed observations phải giữ trong đầu khi review

- `gateway/api-gateway/src/middleware/authorization.js` đang enforce theo `role`, chưa thấy downstream scope/permission enforcement rõ.
- `gateway/api-gateway/src/security/abac.js` enforce rule `Driver can update GPS only when ride is ACTIVE`.
- `services/ride-service/src/services/ride.service.js` hiện vẫn cho update location ở `DRIVER_ASSIGNED` và `DRIVER_ARRIVING`, chưa khớp hẳn rule `ACTIVE only`.
- `services/payment-service/src/middlewares/requestMeta.js` đang gán `requestId` và `correlationId` cứng là `"uuid"`.
- `services/booking-service/src/utils/messageBroker.js` là mock, chưa phải Kafka producer thật.
- `services/review-service/src/store.js` là in-memory store.
- `services/ride-service` có ETA module nội bộ, nên `eta-service` hiện là expected workflow chứ chưa phải runtime service.
- `infra/docker-swarm/docker-stack.yml` đang dùng Kafka plaintext listener; chưa có evidence mTLS cho service-to-service hay broker link.

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

## 12. WORKFLOW 09 — USER-SERVICE

### Service Security Context

- Business role: quản lý user profile, driver profile phụ trợ, preferences, saved locations, payment references, wallet view và user summary/list phục vụ downstream UI/backend flow.
- Security role: chặn IDOR, mass assignment, admin/user confusion, role escalation, PII leak, wallet/payment reference exposure, mutation nhạy cảm không audit.
- Inbound interfaces observed trong repo:
  - `GET /api/v1/users`
  - `GET /api/v1/users/drivers/eligible`
  - `GET /api/v1/users/:userId`
  - `PATCH /api/v1/users/:userId`
  - `GET /api/v1/users/:userId/summary`
  - `GET/PATCH /api/v1/users/:userId/driver-profile`
  - `GET/PATCH /api/v1/users/:userId/preferences`
  - `GET/POST/PATCH/DELETE /api/v1/users/:userId/saved-locations`
  - `GET/POST /api/v1/users/:userId/payment-methods`
  - `GET /api/v1/users/:userId/wallet`
- Outbound dependencies: PostgreSQL, gateway, broker metadata surfaced via `/architecture`, driver profile read model kept in Postgres tables.
- Sensitive data in scope: `fullName`, `displayName`, `phone`, `email`, `avatarUrl`, saved locations, payment method reference/masked value, wallet balance/status, `role`, `accountStatus`, `kycStatus`, `approvalStatus`, `licenseNumber`.
- Observed in repo:
  - `services/user-service/src/routes/user-routes.js`
  - `services/user-service/src/schemas/user-schemas.js`
  - `services/user-service/src/services/user-domain-service.js`
  - `services/user-service/src/repositories/postgres-user-repository.js`
  - `services/user-service/sql/schema.sql`
  - `gateway/api-gateway/src/route-registry.js`
  - `gateway/api-gateway/src/middleware/authorization.js`
  - `gateway/api-gateway/src/middleware/rate-limit.js`
  - `gateway/api-gateway/src/middleware/validation.js`
  - `platform/architecture/security-topology.js`
  - `infra/docker-swarm/docker-stack.yml`
- Expected by CAB architecture:
  - client/edge qua `HTTPS/TLS 1.3`, WAF, gateway rate limiting/quota/validation, gateway authn/authz theo `scope/role/permission`
  - service-to-service `mTLS + per-service identity + no implicit trust`
  - encryption `at-rest` và `in-transit`, masking/minimization cho PII/payment domains
  - centralized logging, audit, SIEM, real-time alerting
- Preliminary repo-backed concerns:
  - `patchUserProfileSchema` cho phép sửa `role` và `accountStatus`.
  - `patchDriverProfileSchema` cho phép sửa trực tiếp `kycStatus`, `approvalStatus`, `licenseNumber`.
  - `userDomainService` và repository chưa thấy actor context, ownership check, scope/permission check.
  - Gateway route family cho `user-service` chỉ thấy `allowedRoles`, chưa thấy route-specific `scope/permission/ownership`.
  - Chưa thấy audit trail cho account/profile/payment-method/wallet access.

### Trust Boundaries

- `Customer/Driver/Admin -> Gateway -> user-service`
- `user-service -> PostgreSQL`
- `user-service -> wallet/payment reference tables`
- `user-service -> broker metadata path`
- `gateway -> user-service` với trust boundary riêng cho authn/authz context forwarding
- `user-service -> driver profile read model`

### Attack Surface

- Profile read/update.
- Driver profile read/update.
- Preferences.
- Saved locations CRUD.
- Payment methods create/list.
- Wallet read model.
- User list/search và driver eligibility list.
- `/architecture` metadata response nếu bị expose ngoài trusted plane.

### Files/Paths To Review First

- `services/user-service/src/routes/user-routes.js`
- `services/user-service/src/schemas/user-schemas.js`
- `services/user-service/src/services/user-domain-service.js`
- `services/user-service/src/repositories/postgres-user-repository.js`
- `services/user-service/sql/schema.sql`
- `services/user-service/src/domain/user-constants.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/middleware/authorization.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `platform/architecture/security-topology.js`
- `infra/docker-swarm/docker-stack.yml`

### Review Status Vocabulary

- `Implemented`: có evidence trong code/config/runtime artifact hiện diện trong repo.
- `Expected by architecture`: control được yêu cầu bởi `platform/architecture/*`, `docs/architecture/*`, hoặc topology nhưng chưa có runtime evidence đủ mạnh.
- `Missing evidence`: chưa tìm thấy code/config/runtime artifact để chứng minh control, hoặc workflow hiện tại không đủ dữ liệu để kết luận.
- `Observed runtime differs from architecture`: repo/runtime artifact hiện có đang thể hiện hành vi lệch với security architecture/Zero Trust.

### Step-by-step Review Workflow

1. Review Client/Edge và Gateway security cho toàn bộ user-service path.
   - Đọc: `platform/architecture/security-topology.js`, `docs/architecture/01-overall-architecture.md`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/middleware/authorization.js`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra từng control:
     - `HTTPS/TLS 1.3`
       - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu `HTTPS/TLS 1.3`.
       - `Missing evidence`: chưa thấy TLS termination config/cert/runtime artifact cho user-service paths trong repo hiện tại.
     - `WAF`
       - `Expected by architecture`: WAF nằm trong `clientAndEdge.controls.waf`.
       - `Missing evidence`: chưa thấy WAF config/rule/deployment artifact.
     - `rate limiting / quota`
       - `Implemented`: gateway có middleware rate limit chung trong `gateway/api-gateway/src/middleware/rate-limit.js`.
       - `Observed runtime differs from architecture`: `gateway/api-gateway/src/route-registry.js` chưa khai báo policy riêng cho user-service routes; hiện rate limit/quota chưa chứng minh coverage cho `GET/PATCH /api/v1/users*`, `saved-locations`, `payment-methods`, `wallet`.
     - `request validation`
       - `Implemented`: service routes dùng `zod` schema trong `services/user-service/src/schemas/user-schemas.js`.
       - `Observed runtime differs from architecture`: gateway validation chỉ áp dụng cho các path có `validationSchema` trong route registry; chưa thấy user-service path được gắn schema ở gateway.
     - `gateway authn/authz` cho `profile / driver-profile / preferences / saved-locations / payment-methods / wallet / admin paths nếu có expose`
       - `Implemented`: gateway family `user-service` yêu cầu auth và role thuộc `Customer|Driver|Admin`.
       - `Observed runtime differs from architecture`: security topology yêu cầu `scope/role/permission`; runtime gateway hiện chỉ enforce `role`, chưa có scope/permission/ownership cho các path user-service.
2. Review `scope / role / permission / ownership` cho từng endpoint chính.
   - Đọc: `services/user-service/src/routes/user-routes.js`, `services/user-service/src/services/user-domain-service.js`, `services/user-service/src/repositories/postgres-user-repository.js`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/authorization.js`
   - Đánh dấu chi tiết:
     - `GET /api/v1/users`
       - `Implemented`: gateway role gate mức family cho `Customer|Driver|Admin`.
       - `Observed runtime differs from architecture`: route list users trả search/filter toàn bộ users nhưng không thấy `scope`, `permission`, `admin-only`, hoặc ownership guard trong gateway hay service.
       - `Missing evidence`: chưa thấy phân quyền rõ `support/admin/reporting` cho path này.
     - `GET /api/v1/users/:userId`
       - `Implemented`: có parse `userId`.
       - `Observed runtime differs from architecture`: service trả aggregate user theo `:userId` nhưng không nhận actor context, không thấy owner check hoặc admin exception.
       - `Missing evidence`: chưa thấy `scope=user:read:self`, `permission=user.read.any`, hay equivalent.
     - `PATCH /api/v1/users/:userId`
       - `Observed runtime differs from architecture`: service nhận payload profile trực tiếp và repository cho update `role`, `accountStatus`, `defaultPaymentMethod`.
       - `Missing evidence`: chưa thấy owner check, admin-only guard, field-level permission matrix.
     - `GET /api/v1/users/:userId/driver-profile`
       - `Observed runtime differs from architecture`: chỉ check target user có role `DRIVER`; không check caller có phải owner/admin/support được phép xem KYC/approval hay không.
       - `Missing evidence`: chưa thấy rule phân tách `driver self`, `admin/support`, `customer forbidden`.
     - `PATCH /api/v1/users/:userId/driver-profile`
       - `Observed runtime differs from architecture`: payload cho phép sửa `kycStatus`, `approvalStatus`, `approvalNotes`, `licenseNumber`; service/repository không thấy actor role/permission gate.
       - `Missing evidence`: chưa thấy phân tách ai được sửa `vehicleType/licenseNumber` và ai được đổi `KYC/approval`.
     - `GET /api/v1/users/:userId/preferences`
       - `Observed runtime differs from architecture`: không thấy owner/admin guard; bất kỳ actor có token hợp lệ trong family role có thể truy cập nếu đoán được `userId`.
     - `PATCH /api/v1/users/:userId/preferences`
       - `Observed runtime differs from architecture`: không thấy owner check; mutation không gắn actor permission.
     - `saved-locations CRUD`
       - `Implemented`: repository query/update/delete theo cặp `(user_id, location_id)`.
       - `Observed runtime differs from architecture`: service vẫn tin `userId` từ path, chưa thấy ownership actor-to-path check; guard hiện tại chỉ ràng buộc record với `userId` supplied, không phải với authenticated owner.
     - `payment-methods`
       - `Implemented`: schema chỉ nhận `type/provider/maskedValue/isDefault/status`; DB chỉ lưu `masked_value`, không thấy raw PAN field.
       - `Observed runtime differs from architecture`: không thấy owner/admin guard; `status` được client gửi trực tiếp; chưa thấy permission tách biệt cho create/list/update default.
       - `Missing evidence`: chưa thấy path xoá/disable/admin override nếu có expose ở runtime khác.
     - `wallet`
       - `Observed runtime differs from architecture`: `GET /wallet` trả `balance/currency/status` theo `userId` path nhưng không thấy owner/admin check.
       - `Missing evidence`: chưa thấy policy cho `wallet.read.self` vs `wallet.read.any`.
     - `admin/support actions nếu có`
       - `Missing evidence`: workflow hiện tại chưa thấy route admin/support riêng trong user-service.
       - `Expected by architecture`: kiến trúc yêu cầu `scope/role/permission` và audit cho sensitive admin actions.
3. Review mass assignment, field-level authz, owner-bound mutation.
   - Đọc: `services/user-service/src/schemas/user-schemas.js`, `services/user-service/src/services/user-domain-service.js`, `services/user-service/src/repositories/postgres-user-repository.js`
   - Kiểm tra:
     - `role`
       - `Observed runtime differs from architecture`: `patchUserProfileSchema` cho phép `role`; repository ghi thẳng `users.role`.
     - `accountStatus`
       - `Observed runtime differs from architecture`: `patchUserProfileSchema` cho phép `accountStatus`; repository ghi thẳng `users.account_status`.
     - `defaultPaymentMethod`
       - `Implemented`: domain service yêu cầu phải có active saved payment method nếu giá trị khác `cash`.
       - `Missing evidence`: chưa thấy permission gate tách owner/admin cho field này.
     - `kycStatus / approvalStatus / approvalNotes`
       - `Observed runtime differs from architecture`: schema cho sửa trực tiếp; repository cập nhật trực tiếp không guard admin/support.
     - `licenseNumber`
       - `Observed runtime differs from architecture`: cho phép update trực tiếp nhưng chưa thấy owner/admin separation hoặc masking rule.
4. Review data security / privacy.
   - Đọc: `services/user-service/sql/schema.sql`, `services/user-service/src/repositories/postgres-user-repository.js`, `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra:
     - `encryption at-rest`
       - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu encryption at-rest.
       - `Missing evidence`: schema/repo không chứng minh DB encryption, column encryption, disk encryption, key management.
     - `encryption in-transit`
       - `Expected by architecture`: Zero Trust yêu cầu encrypted transport.
       - `Observed runtime differs from architecture`: `docker-stack.yml` dùng internal `http://service:port`; Kafka dùng `PLAINTEXT`.
       - `Missing evidence`: chưa thấy PostgreSQL TLS/broker TLS artifact rõ cho user-service data path.
     - `masking / minimization`
       - `Observed runtime differs from architecture`: `getUser`, `getUserSummary`, `listUsers` trả thẳng `fullName`, `phone`, `email`, `avatarUrl`, `accountStatus`, `kycStatus`, `approvalStatus` mà chưa thấy audience-based minimization.
       - `Implemented`: payment method chỉ map ra `maskedValue`, không thấy raw payment field trong schema/table.
       - `Missing evidence`: chưa thấy masking cho wallet balance, payment reference detail, license number, approval notes.
     - `retention policy`
       - `Missing evidence`: chưa thấy retention policy hoặc TTL cho `account-change log`, `payment-method log`, `wallet access log`.
5. Review service-to-service trust và internal authorization.
   - Đọc: `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`, `services/user-service/src/routes/user-routes.js`
   - Kiểm tra:
     - `mTLS`
       - `Expected by architecture`: `security-topology.js` yêu cầu `mTLS`.
       - `Observed runtime differs from architecture`: deployment hiện dùng plain internal HTTP; không thấy mesh/mTLS.
     - `service identity`
       - `Expected by architecture`: `per-service identity`.
       - `Missing evidence`: chưa thấy SPIFFE/service account/cert identity artifact.
     - `authorization giữa gateway và user-service`
       - `Expected by architecture`: every request phải authenticated/authorized.
       - `Missing evidence`: chưa thấy downstream verification rằng request thật sự đến từ trusted gateway hoặc mang signed internal identity.
     - `trust boundary tới wallet/payment reference tables, broker metadata path, driver profile read model`
       - `Observed runtime differs from architecture`: wallet/payment/driver-profile đều truy cập cùng repository nội bộ, chưa thấy extra authorization boundary hoặc row-level security evidence.
       - `Missing evidence`: chưa thấy hard boundary riêng cho `/architecture` metadata path.
6. Review event-driven security nếu user-service có broker metadata/event path.
   - Đọc: `services/user-service/src/routes/user-routes.js`, `platform/architecture/event-contracts.js`
   - Kiểm tra:
     - `schema/envelope validation`
       - `Missing evidence`: repo user-service hiện chưa thấy producer/consumer event path để đánh giá schema/envelope validation.
     - `replay protection`
       - `Missing evidence`: chưa thấy event handler/idempotency artifact.
     - `topic allowlist`
       - `Missing evidence`: chưa thấy user-service subscribe/publish config riêng.
     - `forged-event impact`
       - `Expected by architecture`: broker input phải treated as untrusted.
       - `Missing evidence`: chưa có runtime event path để chứng minh forged-event handling.
     - `hạn chế dữ liệu profile/KYC/payment reference đi vào event path`
       - `Missing evidence`: chưa thấy event payload contract của user-service; không được assume dữ liệu nhạy cảm đã được minimization.
7. Review logging / audit / SIEM / alerting.
   - Đọc: `services/user-service/src/*`, `platform/architecture/security-topology.js`
   - Kiểm tra:
     - `audit account/profile change`
       - `Missing evidence`: chưa thấy audit repository/service cho profile change.
     - `audit role/accountStatus/KYC/approval change`
       - `Missing evidence`: chưa thấy audit trail cho các field privilege-sensitive này.
     - `audit payment-method change`
       - `Missing evidence`: chưa thấy audit create/default/status change cho payment methods.
     - `audit wallet access`
       - `Missing evidence`: chưa thấy wallet access log.
     - `centralized logging`
       - `Expected by architecture`: `security-topology.js` yêu cầu `ELK/OpenSearch`.
       - `Missing evidence`: chưa thấy pipeline/config logging tập trung trong user-service workflow.
     - `correlation/tracing fields`
       - `Missing evidence`: chưa thấy request/correlation/tracing field propagation rõ trong user-service response/log path.
     - `detection`
       - `Expected by architecture`: SIEM + real-time alerts.
       - `Missing evidence`: chưa thấy detection rule cho `IDOR probe`, `mass assignment attempt`, `role escalation`, `abnormal wallet access`, `PII scraping`.
8. Review resilience security.
   - Đọc: `platform/architecture/security-topology.js`, `services/user-service/src/*`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra:
     - `degraded mode không bypass ownership/authz`
       - `Missing evidence`: chưa thấy degraded-mode/fallback logic để chứng minh owner/authz vẫn được giữ.
     - `nếu audit backend unavailable thì mutation nhạy cảm xử lý thế nào`
       - `Missing evidence`: vì chưa thấy audit backend integration nên cũng chưa có policy fail-open/fail-closed.
     - `retry/fallback không làm lộ wallet/payment reference hoặc bypass owner check`
       - `Missing evidence`: chưa thấy retry/fallback artifact cho user-service path.
     - `graceful degradation vẫn giữ integrity của account/KYC/payment-method controls`
       - `Missing evidence`: chưa thấy resilience code/test cho các control này.

### Endpoint Authorization Checklist

- `GET /api/v1/users`
  - `Implemented`: gateway role gate mức family.
  - `Observed runtime differs from architecture`: chưa thấy admin/support-only restriction, scope, permission.
- `GET /api/v1/users/:userId`
  - `Observed runtime differs from architecture`: chưa thấy owner/admin check.
- `PATCH /api/v1/users/:userId`
  - `Observed runtime differs from architecture`: chưa thấy owner/admin check; có mass assignment `role/accountStatus`.
- `GET /api/v1/users/:userId/driver-profile`
  - `Observed runtime differs from architecture`: chưa thấy owner/admin/support split cho KYC/approval visibility.
- `PATCH /api/v1/users/:userId/driver-profile`
  - `Observed runtime differs from architecture`: chưa thấy field-level permission cho `kycStatus/approvalStatus/licenseNumber`.
- `GET/PATCH /api/v1/users/:userId/preferences`
  - `Observed runtime differs from architecture`: chưa thấy owner check.
- `saved-locations CRUD`
  - `Implemented`: DB operation bound vào `user_id`.
  - `Observed runtime differs from architecture`: chưa thấy actor ownership check trước khi dùng `userId` path.
- `payment-methods`
  - `Implemented`: chỉ có `masked_value` trong schema/table.
  - `Observed runtime differs from architecture`: chưa thấy owner/admin check; `status` do client gửi.
- `wallet`
  - `Observed runtime differs from architecture`: chưa thấy owner/admin check.
- `admin/support actions nếu có expose`
  - `Missing evidence`: chưa thấy route hoặc policy cụ thể.

### Data Security / Privacy Checklist

- `encryption at-rest`
  - `Expected by architecture`
  - `Missing evidence`: chưa thấy DB/disk/key config chứng minh.
- `encryption in-transit`
  - `Expected by architecture`
  - `Observed runtime differs from architecture`: internal service URLs và Kafka đang plaintext.
- `masking/minimization full name, phone, email, avatar`
  - `Observed runtime differs from architecture`: response hiện trả raw values.
- `masking/minimization payment reference`
  - `Implemented`: lưu/trả `masked_value`.
  - `Missing evidence`: chưa thấy rule redact log.
- `masking/minimization wallet`
  - `Missing evidence`: chưa thấy minimization cho balance/status theo audience.
- `masking/minimization KYC/approval state`
  - `Observed runtime differs from architecture`: list/summary path hiện trả trực tiếp `kycStatus/approvalStatus`.
- `retention policy account-change log`
  - `Missing evidence`
- `retention policy payment-method log`
  - `Missing evidence`
- `retention policy wallet access log`
  - `Missing evidence`

### Service-to-Service Trust Checklist

- `mTLS`
  - `Expected by architecture`
  - `Observed runtime differs from architecture`
- `service identity`
  - `Expected by architecture`
  - `Missing evidence`
- `authorization giữa gateway và user-service`
  - `Expected by architecture`
  - `Missing evidence`
- `trust boundary tới wallet/payment reference tables`
  - `Missing evidence`
- `trust boundary tới broker metadata path`
  - `Missing evidence`
- `trust boundary tới driver profile read model`
  - `Missing evidence`

### Event-Driven Security Checklist

- `schema/envelope validation`
  - `Missing evidence`
- `replay protection`
  - `Missing evidence`
- `topic allowlist`
  - `Missing evidence`
- `forged-event impact`
  - `Expected by architecture`
  - `Missing evidence`
- `hạn chế profile/KYC/payment reference trên event path`
  - `Missing evidence`

### Logging / Audit / SIEM / Alerting Checklist

- `audit account/profile change`
  - `Missing evidence`
- `audit role/accountStatus/KYC/approval change`
  - `Missing evidence`
- `audit payment-method change`
  - `Missing evidence`
- `audit wallet access`
  - `Missing evidence`
- `centralized logging`
  - `Expected by architecture`
  - `Missing evidence`
- `correlation/tracing fields`
  - `Missing evidence`
- `detection for IDOR probe`
  - `Expected by architecture`
  - `Missing evidence`
- `detection for mass assignment attempt`
  - `Expected by architecture`
  - `Missing evidence`
- `detection for role escalation`
  - `Expected by architecture`
  - `Missing evidence`
- `detection for abnormal wallet access`
  - `Expected by architecture`
  - `Missing evidence`
- `detection for PII scraping`
  - `Expected by architecture`
  - `Missing evidence`

### Resilience Security Checklist

- `degraded mode không được bypass ownership/authz`
  - `Missing evidence`
- `audit backend unavailable xử lý mutation nhạy cảm thế nào`
  - `Missing evidence`
- `retry/fallback không làm lộ wallet/payment reference hoặc bypass owner check`
  - `Missing evidence`
- `graceful degradation vẫn giữ integrity của account/KYC/payment-method controls`
  - `Missing evidence`

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

- Evidence TLS termination/runtime artifact, WAF, quota, gateway schema mapping cho user-service routes.
- Evidence `scope/permission/ownership` mapping từ actor token sang từng `:userId` route.
- Evidence admin/support-only enforcement cho `GET /api/v1/users` và các field `role/accountStatus/KYC/approval`.
- Evidence audit trail cho account/profile/payment-method/wallet access.
- Evidence centralized logging, correlation/tracing, SIEM, alerting.
- Evidence encryption at-rest/in-transit cho Postgres, gateway->service, broker path.
- Evidence service identity/mTLS/internal authz giữa gateway và user-service.
- Evidence event path security nếu user-service thực sự publish/consume metadata/event.
- Evidence retention policy cho account-change, payment-method, wallet-access logs.
- Evidence resilience behavior khi audit/logging backend unavailable.

### Fix Priority

- P0: IDOR trên `:userId` paths, mass assignment `role/accountStatus/KYC/approval`, wallet/profile read không ownership, weak gateway-to-service authz context.
- P1: thiếu audit/logging/SIEM/alerting, thiếu data minimization/masking, thiếu service-to-service trust evidence, internal plaintext transport lệch kiến trúc.
- P2: retention/resilience details, broker/event path clarification, docs/runtime consistency.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/user-service/src/routes/user-routes.js`
   - `services/user-service/src/schemas/user-schemas.js`
   - `services/user-service/src/services/user-domain-service.js`
   - `services/user-service/src/repositories/postgres-user-repository.js`
   - `gateway/api-gateway/src/route-registry.js`
   - `gateway/api-gateway/src/middleware/authorization.js`
   - `gateway/api-gateway/src/middleware/rate-limit.js`
   - `gateway/api-gateway/src/middleware/validation.js`
   - `platform/architecture/security-topology.js`
   - `infra/docker-swarm/docker-stack.yml`
4. So sánh với checklist.
5. Với mỗi control, gắn đúng một trạng thái:
   - `Implemented`
   - `Expected by architecture`
   - `Missing evidence`
   - `Observed runtime differs from architecture`
6. Ghi findings theo template, không viết như thể runtime đã có control nếu repo chưa chứng minh.

### AI Review Prompt

```text
Bạn là security reviewer cho user-service của CAB-BOOKING.

Ưu tiên đọc:
- services/user-service/src/routes/user-routes.js
- services/user-service/src/schemas/user-schemas.js
- services/user-service/src/services/user-domain-service.js
- services/user-service/src/repositories/postgres-user-repository.js
- services/user-service/sql/schema.sql

Tập trung bắt:
- IDOR
- mass assignment
- weak admin guard
- PII leak
- thiếu audit cho account change
- ownership gap ở saved locations / payment methods / wallet
- thiếu gateway `scope/role/permission/ownership`
- thiếu client/edge controls cho user-service path
- data security/privacy gap: encryption at-rest, encryption in-transit, masking/minimization, retention
- service-to-service trust gap: mTLS, service identity, gateway->service authz
- event-driven security gap nếu có broker metadata/event path
- logging/audit/SIEM/detection gap
- resilience security gap

Rules:
- Không assume gateway đã map owner đúng.
- Nếu schema cho phép user sửa `role`, `accountStatus`, `kycStatus`, `approvalStatus`, coi là dấu hiệu cần fail trừ khi service chặn rõ.
- Chỉ ghi `Implemented` khi có evidence trong code/config/runtime artifact.
- Nếu chỉ có doc/topology thì ghi `Expected by architecture`.
- Nếu runtime artifact hiện tại đi ngược kiến trúc, ghi `Observed runtime differs from architecture`.
- Chỗ nào chưa có evidence thì nói thẳng là `Missing evidence`.

Đầu ra:
- Findings chuẩn
- Checklist có trạng thái cho từng control
- Evidence còn thiếu
- Fix priority P0/P1/P2
```

## 15. CROSS-SERVICE SECURITY GAPS TO LOOK FOR

### 15.1 Gateway vs downstream auth gaps

- Gateway có `JWT/JWKS/RBAC/idempotency` trong:
  - `gateway/api-gateway/src/security/jwt-service.js`
  - `gateway/api-gateway/src/middleware/authorization.js`
  - `gateway/api-gateway/src/middleware/idempotency.js`
- Nhưng nhiều service downstream vẫn nhận `userId`, `driverId`, `role-sensitive fields` trực tiếp từ payload/path:
  - `services/booking-service/src/controllers/bookingController.js`
  - `services/ride-service/src/controllers/ride.controller.js`
  - `services/user-service/src/schemas/user-schemas.js`
- Gap cần tìm: downstream có thực sự tự verify ownership/context hay chỉ tin gateway.

### 15.2 Event security gaps

- Kiến trúc mô tả event Kafka rõ trong `message-broker/kafka/topology.json` và `platform/architecture/event-contracts.js`.
- Nhưng runtime evidence không đồng đều:
  - booking broker là mock: `services/booking-service/src/utils/messageBroker.js`
  - notification consume nhiều topic nhưng validation còn cần rà sâu: `services/notification-service/src/kafka-consumer.js`
  - review publish chỉ log non-blocking: `services/review-service/src/routes.js`
- Gap cần tìm: forged event, replay, topic mismatch, thiếu event schema envelope.

### 15.3 Secrets / config gaps

- `infra/docker-swarm/docker-stack.yml` truyền nhiều secret qua env.
- Chưa có evidence secret manager / key rotation / vault integration trong runtime code.
- `services/auth-service/images/.gitignore` còn nhắc tới local MFA pages chứa secret, nên cần rà artifact cẩn thận.
- Gap cần tìm: secrets chỉ ở env file, hard-coded fallback, sample file lộ thông tin nhạy cảm.

### 15.4 Logging / audit gaps

- Auth có audit path khá rõ.
- Các service còn lại ít hoặc chưa thấy audit:
  - payment refund/admin override
  - user account change
  - driver approval/KYC mutation
  - review moderation
- Gap cần tìm: action nhạy cảm thay đổi state nhưng không để lại audit evidence.

### 15.5 Service-to-service trust gaps

- `platform/architecture/security-topology.js` yêu cầu `mTLS + service identity`.
- `infra/docker-swarm/docker-stack.yml` và runtime repo hiện chưa có evidence mesh/mTLS.
- Kafka trong Swarm dùng `PLAINTEXT`.
- Gap cần tìm: nội bộ đang trust-by-network, không có identity-bound call protection.

### 15.6 Misconfiguration patterns

- Gateway docs filename và nội dung có dấu hiệu lệch mapping giữa realtime/failure/idempotency docs trong `gateway/api-gateway/docs/*`.
- `services/payment-service/src/middlewares/requestMeta.js` hard-code request meta.
- `services/review-service/src/store.js` là in-memory.
- `services/ride-service/docs/*` mô tả Redis/Kafka/fallback nhiều hơn mức runtime code đã chứng minh.
- Gap cần tìm: doc nói có, code chưa có; default config mở rộng attack surface.

### 15.7 Consistency gaps giữa booking / pricing / payment / ride

- Booking nhận `priceSnapshot` từ client.
- Pricing nhận `demandIndex/supplyIndex` từ request.
- Payment chưa cross-check rõ với booking snapshot/ride state.
- Ride lifecycle và gateway ABAC đang lệch rule GPS ACTIVE-only.
- Gap cần tìm: business integrity đứt đoạn giữa giá, thanh toán, lifecycle, event propagation.

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

