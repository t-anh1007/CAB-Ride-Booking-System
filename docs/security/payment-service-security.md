# CAB-BOOKING Security Review Workflow ? WORKFLOW 05 — PAYMENT-SERVICE

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

## 8. WORKFLOW 05 — PAYMENT-SERVICE

### Service Security Context

- Business role: tạo payment, lookup payment, confirm payment, refund payment, lưu trạng thái thanh toán.
- Security role: chống double charge, unauthorized payment lookup, callback forgery, refund abuse, amount tampering, state machine bypass, forged payment event, và integrity drift giữa payment với booking/ride/user relation.
- Inbound interfaces observed trong repo:
  - `POST /api/v1/payments`
  - `GET /api/v1/payments/:paymentId`
  - `POST /api/v1/payments/:paymentId/confirm`
  - `POST /api/v1/payments/:paymentId/refund`
  - `GET /health`
  - `GET /architecture`
- Outbound dependencies observed trong repo:
  - MongoDB: `services/payment-service/src/db/mongoClient.js`
  - Gateway path family: `gateway/api-gateway/src/route-registry.js`
- Outbound dependencies expected by architecture nhưng chưa có runtime proof đủ:
  - payment provider adapter / callback path
  - Kafka event publish cho payment lifecycle
  - booking / ride / user relation sources để cross-check integrity
- Dữ liệu nhạy cảm phải coi là protected:
  - `paymentId`, `providerRef`, `status`
  - `amount`, `currency`
  - `rideId`, `userId`
  - `refundReason`, `failureReason`
  - `retryHistory`, `retryCount`
  - provider callback payload / audit trail nếu tồn tại
- Observed in repo:
  - `services/payment-service/src/app.js`
  - `services/payment-service/src/routes/paymentRoutes.js`
  - `services/payment-service/src/controllers/paymentController.js`
  - `services/payment-service/src/services/paymentService.js`
  - `services/payment-service/src/models/paymentModel.js`
  - `services/payment-service/src/repositories/paymentRepository.js`
  - `services/payment-service/src/db/mongoClient.js`
  - `services/payment-service/src/middlewares/requestMeta.js`
  - `services/payment-service/src/utils/response.js`
- Expected by architecture:
  - `platform/architecture/security-topology.js`
  - `platform/architecture/security-zero-trust-architecture.mmd`
  - `platform/architecture/resilience-topology.js`
  - `platform/architecture/event-contracts.js`
  - `docs/architecture/01-overall-architecture.md`
- Preliminary repo-backed concerns:
  - Gateway chỉ có policy riêng cho `POST /api/v1/payments`; chưa có policy riêng cho `GET /api/v1/payments/:paymentId`, `POST /api/v1/payments/:paymentId/confirm`, `POST /api/v1/payments/:paymentId/refund`.
  - Payment service hiện không check actor, scope, permission, ownership, admin/support override ở controller/service layer.
  - `formatPayment()` trả trực tiếp `rideId`, `userId`, `providerRef`, `status`.
  - `requestMeta` đang gán `requestId` và `correlationId` cứng là `"uuid"`.
  - Chưa thấy webhook/callback endpoint, signature verification, replay protection, hay timestamp window cho PSP callback.
  - Chưa thấy Kafka producer hay event envelope validation cho `payment.success` / `payment.failed`.

### Status Labels Bắt Buộc

- `Implemented`: có evidence trực tiếp trong code/config/test/runtime artifact của repo.
- `Expected by architecture`: chỉ mới thấy ở tài liệu kiến trúc/topology, chưa có runtime implementation đủ mạnh để kết luận đã có control.
- `Missing evidence`: chưa thấy code/config/runtime artifact chứng minh control tồn tại.
- `Observed runtime differs from architecture`: tài liệu kiến trúc yêu cầu control, nhưng runtime/config trong repo cho thấy trạng thái khác hoặc yếu hơn.

### Trust Boundaries Phải Review

- `Client -> Edge -> Gateway -> payment-service` cho mọi payment path expose.
- `payment-service -> MongoDB`.
- `payment-service -> booking / ride / user relation sources`.
- `payment-service -> payment provider adapter`.
- `payment provider -> callback/webhook path`.
- `payment-service -> Kafka / event broker`.
- `Admin/Support actor -> Gateway -> payment-service` cho confirm/refund/override path nếu có expose.

### Files/Paths To Review First

- `services/payment-service/src/app.js`
- `services/payment-service/src/routes/paymentRoutes.js`
- `services/payment-service/src/controllers/paymentController.js`
- `services/payment-service/src/services/paymentService.js`
- `services/payment-service/src/models/paymentModel.js`
- `services/payment-service/src/repositories/paymentRepository.js`
- `services/payment-service/src/db/mongoClient.js`
- `services/payment-service/src/middlewares/requestMeta.js`
- `services/payment-service/src/utils/response.js`
- `gateway/api-gateway/src/app.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/middleware/authorization.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `gateway/api-gateway/src/validation-schemas.js`
- `platform/architecture/security-topology.js`
- `platform/architecture/resilience-topology.js`
- `platform/architecture/event-contracts.js`
- `infra/docker-swarm/docker-stack.yml`

### Payment Path Security Matrix

#### A. Client / Edge / Gateway controls cho toàn bộ payment paths

- Paths phải review:
  - `POST /api/v1/payments`
  - `GET /api/v1/payments/:paymentId`
  - `POST /api/v1/payments/:paymentId/confirm`
  - `POST /api/v1/payments/:paymentId/refund`
  - callback path nếu có expose qua gateway
- `HTTPS/TLS 1.3`
  - `Expected by architecture`: `platform/architecture/security-topology.js` và `docs/architecture/01-overall-architecture.md` yêu cầu HTTPS/TLS 1.3 cho client/edge/gateway.
  - `Missing evidence`: chưa thấy TLS termination/runtime certificate config trong gateway code hay `infra/docker-swarm/docker-stack.yml`.
- `WAF`
  - `Expected by architecture`: security topology yêu cầu WAF ở edge.
  - `Missing evidence`: chưa thấy WAF config/runtime artifact cho payment paths.
- `Rate limiting / quota`
  - `Implemented`: `POST /api/v1/payments` có gateway rate limit policy `payment-create` trong `gateway/api-gateway/src/route-registry.js`.
  - `Missing evidence`: chưa thấy rate limit/quota policy riêng cho `GET /api/v1/payments/:paymentId`, `POST /api/v1/payments/:paymentId/confirm`, `POST /api/v1/payments/:paymentId/refund`, hay callback path.
- `Request validation`
  - `Implemented`: gateway có schema `paymentCreate` cho `POST /api/v1/payments` trong `gateway/api-gateway/src/validation-schemas.js`.
  - `Missing evidence`: chưa thấy schema validation riêng cho confirm/refund body, paymentId path param, hay callback payload.
- `Authn/Authz qua gateway`
  - `Implemented`: family `payment-service` mặc định `authRequired: true`, `allowedRoles: ["Customer", "Admin"]` trong `gateway/api-gateway/src/route-registry.js`.
  - `Missing evidence`: gateway chỉ check `role`; chưa có `scope`/`permission` policy chi tiết cho create / get / confirm / refund / callback paths.
  - `Missing evidence`: callback/provider path không tồn tại trong route registry; nếu có expose ở đâu khác thì chưa có evidence.

#### B. `POST /api/v1/payments`

- `Rate limiting / quota`
  - `Implemented`: gateway rate limit `payment-create`.
- `Request validation`
  - `Implemented`: gateway schema require `rideId`, `userId`, `amount`, `method`.
  - `Implemented`: service validate required strings, UUID, amount positive integer, allowed method trong `services/payment-service/src/services/paymentService.js`.
- `Idempotency`
  - `Implemented`: gateway yêu cầu `Idempotency-Key`; service lookup `findPaymentByIdempotencyKey()` trước khi create; MongoDB có unique sparse index trên `idempotencyKey`.
- `Authn/Authz`
  - `Implemented`: gateway role gate `Customer`, `Admin`.
  - `Missing evidence`: downstream service không bind `userId` với actor identity từ token.
- `Ownership`
  - `Missing evidence`: service nhận `userId` và `rideId` trực tiếp từ payload, chưa cross-check ownership với booking/ride/user source.
- `Scope / permission`
  - `Missing evidence`: chưa thấy scope như `payments:create:self`, `payments:create:any`.

#### C. `GET /api/v1/payments/:paymentId`

- `Rate limiting / quota`
  - `Missing evidence`: chưa có route policy riêng.
- `Request validation`
  - `Missing evidence`: gateway chưa có schema/path validation riêng; service chỉ validate UUID trong service layer.
- `Authn/Authz`
  - `Implemented`: family auth + role gate qua gateway.
  - `Missing evidence`: chưa có permission-level rule cho payment lookup.
- `Ownership`
  - `Missing evidence`: `getPaymentById()` trả payment theo `paymentId`, không check actor có phải owner/Admin hay không.
- `Data exposure`
  - `Observed runtime differs from architecture`: `formatPayment()` trả `rideId`, `userId`, `providerRef` trực tiếp.

#### D. `POST /api/v1/payments/:paymentId/confirm`

- `Rate limiting / quota`
  - `Missing evidence`: chưa có route policy riêng.
- `Request validation`
  - `Missing evidence`: gateway chưa có schema confirm; service chỉ check `paymentId` UUID và `outcome` string sau đó.
- `Authn/Authz`
  - `Implemented`: family auth + role gate qua gateway.
  - `Missing evidence`: chưa có rule tách bạch confirm do customer, admin, internal processor, hay provider callback.
- `Ownership`
  - `Missing evidence`: không check actor có quyền confirm payment này.
- `Scope / permission`
  - `Missing evidence`: chưa có scope như `payments:confirm`, `payments:confirm:any`, `payments:provider-callback`.
- `State machine`
  - `Implemented`: block confirm khi status là `REFUNDED` hoặc `CANCELLED`.
  - `Missing evidence`: chưa thấy rule chặn reconfirm payment đã `COMPLETED`; outcome `success` có thể ghi lại `providerRef` mới.

#### E. `POST /api/v1/payments/:paymentId/refund`

- `Rate limiting / quota`
  - `Missing evidence`: chưa có route policy riêng.
- `Request validation`
  - `Missing evidence`: gateway chưa có schema refund; service chỉ nhận `payload.reason || 'Refund requested'`.
- `Authn/Authz`
  - `Implemented`: family auth + role gate qua gateway.
  - `Missing evidence`: chưa có permission tách bạch customer refund, admin refund, support override.
- `Ownership`
  - `Missing evidence`: không check actor có quyền refund payment này.
- `Scope / permission`
  - `Missing evidence`: chưa có scope như `payments:refund:self`, `payments:refund:any`, `payments:refund:admin-override`.
- `State machine`
  - `Implemented`: chỉ cho refund khi payment đang `COMPLETED`.
  - `Missing evidence`: chưa thấy audit/approval path cho refund reason hay admin override.

### Authorization Checklist Bắt Buộc

#### Create payment

- `role`
  - `Implemented`: gateway cho `Customer`, `Admin`.
- `scope`
  - `Missing evidence`
- `permission`
  - `Missing evidence`
- `ownership`
  - `Missing evidence`: chưa verify `userId` trong body khớp actor.
- `integrity với ride/user relation`
  - `Missing evidence`: chưa cross-check booking/ride/user relation từ trusted source.

#### Get payment by id

- `role`
  - `Implemented`: gateway family role gate.
- `scope`
  - `Missing evidence`
- `permission`
  - `Missing evidence`
- `ownership`
  - `Missing evidence`: chưa verify payment thuộc actor hay tenant hiện tại.

#### Confirm payment

- `role`
  - `Implemented`: gateway family role gate.
- `scope`
  - `Missing evidence`
- `permission`
  - `Missing evidence`
- `ownership`
  - `Missing evidence`
- `state-sensitive authorization`
  - `Implemented`: có check status tối thiểu.
  - `Missing evidence`: chưa có actor-based authorization cho state transition.

#### Refund payment

- `role`
  - `Implemented`: gateway family role gate.
- `scope`
  - `Missing evidence`
- `permission`
  - `Missing evidence`
- `ownership`
  - `Missing evidence`
- `admin/support override`
  - `Missing evidence`: chưa có flow riêng, audit riêng, hay justification field bắt buộc.

#### Admin / support override

- `Admin`
  - `Expected by architecture`: role `Admin` được cho qua gateway family.
  - `Missing evidence`: chưa có permission boundary, audit, justification, approval step.
- `Support`
  - `Missing evidence`: không thấy role/support permission trong gateway hay service.
- `Internal processor/service`
  - `Missing evidence`: không thấy service account path cho confirm/refund/provider callback.

### Data Security / Privacy Checklist

- `Encryption at-rest`
  - `Expected by architecture`: security topology yêu cầu encryption at-rest cho domain payment.
  - `Missing evidence`: chưa thấy MongoDB encryption-at-rest/key management artifact cho payment data.
- `Encryption in-transit`
  - `Expected by architecture`: security topology yêu cầu encryption in-transit.
  - `Observed runtime differs from architecture`: `PAYMENT_SERVICE_URL` trong swarm là `http://payment-service:3102`.
- `Masking / minimization cho payment status`
  - `Missing evidence`: `status` được trả thẳng qua API; chưa thấy view-specific minimization.
- `Masking / minimization cho provider ref`
  - `Missing evidence`: `providerRef` được trả thẳng trong `formatPayment()`.
- `Masking / minimization cho refund reason`
  - `Missing evidence`: `refundReason` hiện được lưu trong model nhưng chưa thấy rule redaction/retention.
- `Masking / minimization cho user/ride relation`
  - `Missing evidence`: `rideId` và `userId` được trả thẳng qua API.
- `Masking / minimization cho payment metadata`
  - `Missing evidence`: chưa có model/provider callback payload hiện hữu, nhưng cũng chưa có minimization policy cho fields tương lai như `failureReason`, `retryHistory`, provider payload.
- `Retention policy cho payment log`
  - `Missing evidence`: chưa thấy TTL/archive/delete policy cho payment documents.
- `Retention policy cho audit trail`
  - `Missing evidence`: chưa thấy audit trail store hoặc retention policy.
- `Retention policy cho provider callback payload`
  - `Missing evidence`: chưa thấy callback path hay retention policy.

### Service-to-Service Trust Checklist

- `mTLS`
  - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu mTLS.
  - `Observed runtime differs from architecture`: swarm đang dùng `http://payment-service:3102`.
- `Service identity`
  - `Expected by architecture`: topology yêu cầu `per-service identity`.
  - `Missing evidence`: chưa thấy service credential / service account verification trong payment-service.
- `Authorization giữa payment-service và booking / ride / user relation sources`
  - `Expected by architecture`: Zero Trust yêu cầu internal authn/authz và no implicit trust.
  - `Missing evidence`: chưa thấy bất kỳ call hay authorization contract nào để cross-check `rideId` / `userId`.
- `Trust boundary tới payment provider adapter`
  - `Expected by architecture`: provider là external untrusted boundary.
  - `Missing evidence`: chưa thấy adapter, provider auth, secret handling, timeout, TLS pinning, IP allowlist.
- `Trust boundary tới callback path`
  - `Expected by architecture`: callback phải được verify.
  - `Missing evidence`: chưa thấy webhook/callback endpoint.

### Event-Driven Security Checklist

- `Event schema/envelope validation`
  - `Expected by architecture`: `platform/architecture/event-contracts.js` mô tả `PaymentSuccess`.
  - `Missing evidence`: chưa thấy runtime producer/consumer envelope validation trong payment-service.
- `Replay protection`
  - `Missing evidence`: chưa thấy event id / nonce / dedupe window cho publish hay consume path.
- `Topic allowlist`
  - `Expected by architecture`: `platform/architecture/event-contracts.js` chỉ ra topic `payment.success`.
  - `Missing evidence`: chưa thấy runtime topic config allowlist trong payment-service.
- `Forged-event impact cho payment.completed / payment.failed`
  - `Missing evidence`: chưa thấy publish path cho `payment.completed` hoặc `payment.failed`.
  - `Risk`: khi event được bổ sung sau này, nếu không có signed/validated envelope thì forged event có thể gây unlock ride/notify sai.

### Logging / Audit / SIEM / Alerting Checklist

- `Audit create payment`
  - `Missing evidence`: chưa thấy audit record cho create.
- `Audit confirm payment`
  - `Missing evidence`: chưa thấy audit record cho confirm outcome, providerRef, actor/source.
- `Audit refund payment`
  - `Missing evidence`: chưa thấy audit record cho refund, reason, actor, approval.
- `Audit admin override`
  - `Missing evidence`: chưa thấy admin override flow hay audit.
- `Centralized logging`
  - `Expected by architecture`: ELK/OpenSearch có trong `platform/architecture/security-topology.js`.
  - `Missing evidence`: chưa thấy payment-service integration artifact.
- `Correlation/tracing fields đúng chuẩn`
  - `Observed runtime differs from architecture`: `services/payment-service/src/middlewares/requestMeta.js` hard-code `requestId` và `correlationId` là `"uuid"`.
  - `Implemented`: response envelope có `meta.requestId`, `meta.correlationId`, `timestamp` trong `services/payment-service/src/utils/response.js`.
- `Suspicious refund / callback forgery / retry storm detection`
  - `Expected by architecture`: SIEM/real-time alerts được yêu cầu trong topology.
  - `Missing evidence`: chưa thấy detection rule, counters, alert hooks, anomaly pipeline.

### Resilience Security Checklist

- `Timeout / circuit breaker / PSP failover`
  - `Expected by architecture`: `platform/architecture/resilience-topology.js` yêu cầu timeout/circuit breaker/graceful fallback.
  - `Missing evidence`: chưa có PSP client/runtime, nên chưa có timeout/circuit breaker/failover control.
- `Retry không gây double charge`
  - `Implemented`: create path có idempotency ở gateway, service, và Mongo unique index.
  - `Missing evidence`: confirm path timeout chỉ ghi `retryHistory`; chưa thấy PSP-side idempotency/capture safety.
- `Graceful degradation không bypass control`
  - `Expected by architecture`: resilience topology yêu cầu graceful degradation.
  - `Missing evidence`: chưa thấy defined degraded mode khi PSP / booking / ride source down.
- `Fallback / eventual consistency vẫn giữ integrity`
  - `Expected by architecture`: event-driven / resilience architecture ngụ ý eventual consistency có kiểm soát.
  - `Missing evidence`: chưa có saga compensation/runtime artifact để chứng minh no double charge hoặc payment-booking integrity under failure.

### Webhook / Provider Callback Security Checklist

- `Signature verification`
  - `Expected by architecture`: callback/webhook phải verify signature.
  - `Missing evidence`: chưa thấy endpoint hay code path verify signature trong payment-service.
- `Replay protection`
  - `Expected by architecture`: callback replay phải bị chặn.
  - `Missing evidence`: chưa thấy nonce/idempotency/timestamp replay guard.
- `Timestamp window`
  - `Expected by architecture`: callback signature thường phải gắn timestamp freshness window.
  - `Missing evidence`: chưa thấy callback path hay timestamp window logic.
- `Callback abuse / rate limiting`
  - `Expected by architecture`: callback path nếu expose phải có abuse control.
  - `Missing evidence`: chưa thấy callback endpoint, route policy, hay rate limit.
- `Không suy diễn implementation đã tồn tại`
  - Nếu chưa có callback path thì phải ghi:
    - `Expected by architecture` cho yêu cầu.
    - `Missing evidence` cho runtime implementation.

### Step-by-step Review Workflow

1. Review client/edge/gateway controls cho toàn bộ payment paths.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/app.js`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/validation-schemas.js`
   - Kiểm tra: `HTTPS/TLS 1.3`, WAF, rate limit/quota, request validation, authn/authz cho create / confirm / refund / lookup / callback path nếu có expose.
2. Review authorization chi tiết cho create/get/confirm/refund.
   - Đọc: `services/payment-service/src/controllers/paymentController.js`, `services/payment-service/src/services/paymentService.js`
   - Kiểm tra: `scope/role/permission/ownership`, admin/support override, actor/resource binding.
3. Review create payment idempotency và integrity.
   - Đọc: `services/payment-service/src/services/paymentService.js`, `services/payment-service/src/repositories/paymentRepository.js`, `services/payment-service/src/db/mongoClient.js`
   - Kiểm tra: replay safety, duplicate create, amount tampering, `rideId`/`userId` trust model.
4. Review confirm/refund state machine.
   - Đọc: `services/payment-service/src/services/paymentService.js`, `services/payment-service/src/models/paymentModel.js`
   - Kiểm tra: legal transitions, reconfirm risk, refund abuse, override path.
5. Review data security/privacy.
   - Đọc: `services/payment-service/src/models/paymentModel.js`, `services/payment-service/src/services/paymentService.js`, `services/payment-service/src/repositories/paymentRepository.js`, `services/payment-service/src/utils/response.js`, `services/payment-service/src/db/mongoClient.js`
   - Kiểm tra: encryption at-rest, encryption in-transit, masking/minimization, retention.
6. Review service-to-service trust.
   - Đọc: `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`, payment service source
   - Kiểm tra: mTLS, service identity, authorization với booking/ride/user relation sources, provider boundary.
7. Review event-driven security.
   - Đọc: `platform/architecture/event-contracts.js`, payment service source
   - Kiểm tra: event schema/envelope validation, replay protection, topic allowlist, forged-event impact cho `payment.completed` / `payment.failed`.
8. Review logging/audit/SIEM/alerting.
   - Đọc: `services/payment-service/src/middlewares/requestMeta.js`, `services/payment-service/src/utils/response.js`, payment service source, `platform/architecture/security-topology.js`
   - Kiểm tra: audit create/confirm/refund/admin override, centralized logging, tracing fields, suspicious refund/callback forgery/retry storm detection.
9. Review resilience security.
   - Đọc: `platform/architecture/resilience-topology.js`, payment service source
   - Kiểm tra: timeout/circuit breaker/PSP failover, retry không gây double charge, graceful degradation không bypass control, fallback/eventual consistency vẫn giữ integrity.
10. Review webhook/provider callback security.
   - Đọc: toàn bộ `services/payment-service/src/*`
   - Kiểm tra: signature verification, replay protection, timestamp window, callback abuse/rate limiting.
   - Nếu không thấy code path thì ghi thẳng `Missing evidence`.

### Checklist Kết Luận Cuối

- Create payment phải có authn, role gate, idempotency, ownership binding, và integrity cross-check với trusted relation source hoặc ghi rõ thiếu.
- Get payment by id không được chỉ dựa vào `paymentId`; phải có ownership hoặc admin permission rõ.
- Confirm/refund không được chỉ dựa vào `paymentId` + state; phải có actor authorization rõ.
- Tất cả payment paths expose qua edge/gateway phải được review cho `HTTPS/TLS 1.3`, WAF, rate limiting/quota, request validation.
- `providerRef`, `rideId`, `userId`, `refundReason`, `retryHistory` phải có review riêng về masking/minimization và retention.
- Internal transport không được ghi `Implemented` cho mTLS/service identity nếu swarm vẫn đang `http://`.
- Event-driven control chỉ được ghi `Implemented` khi có runtime producer/consumer artifact, không chỉ dựa vào topology.
- Callback/webhook security chỉ PASS khi có endpoint/code/config/test chứng minh signature verification, replay guard, timestamp window, abuse control.
- Correlation/tracing không được PASS nếu request IDs bị hard-code.

### Findings Template

```md
- Missing:
- Incorrect:
- Risk:
- Severity:
- Status:
- Evidence:
- Fix Direction:
```

### Evidence Still Needed

- Runtime TLS/certificate artifact cho payment path.
- WAF config cho payment path.
- Route policy riêng cho get/confirm/refund/callback.
- Scope/permission/ownership model cho create/get/confirm/refund/admin-support override.
- Cross-service integrity check với booking/ride/user relation sources.
- Provider adapter, callback endpoint, signature verification, replay guard, timestamp window.
- Event producer/runtime contract cho `payment.success` / `payment.failed`.
- Audit trail store/pipeline và retention policy.
- PSP timeout/circuit breaker/failover artifact.

### Fix Priority

- P0: unauthorized payment lookup, amount tampering, double charge, callback forgery, refund abuse, invalid state transition, forged payment event impact.
- P1: thiếu ownership/scope/permission, thiếu audit, tracing/correlation sai chuẩn, thiếu masking/minimization, thiếu service identity/mTLS proof.
- P2: docs/topology alignment, observability hardening, retention governance detail.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan tối thiểu các file:
   - `services/payment-service/src/app.js`
   - `services/payment-service/src/routes/paymentRoutes.js`
   - `services/payment-service/src/controllers/paymentController.js`
   - `services/payment-service/src/services/paymentService.js`
   - `services/payment-service/src/models/paymentModel.js`
   - `services/payment-service/src/repositories/paymentRepository.js`
   - `services/payment-service/src/middlewares/requestMeta.js`
   - `gateway/api-gateway/src/route-registry.js`
   - `gateway/api-gateway/src/validation-schemas.js`
   - `platform/architecture/security-topology.js`
   - `platform/architecture/event-contracts.js`
   - `infra/docker-swarm/docker-stack.yml`
4. Đánh dấu từng item là `Implemented`, `Expected by architecture`, `Missing evidence`, hoặc `Observed runtime differs from architecture`.
5. Chỗ nào chưa có evidence thì nói thẳng là chưa có.

### AI Review Prompt

```text
Bạn là security reviewer cho payment-service của CAB-BOOKING.

Ưu tiên đọc:
- services/payment-service/src/app.js
- services/payment-service/src/routes/paymentRoutes.js
- services/payment-service/src/controllers/paymentController.js
- services/payment-service/src/services/paymentService.js
- services/payment-service/src/models/paymentModel.js
- services/payment-service/src/repositories/paymentRepository.js
- services/payment-service/src/db/mongoClient.js
- services/payment-service/src/middlewares/requestMeta.js
- services/payment-service/src/utils/response.js
- gateway/api-gateway/src/route-registry.js
- gateway/api-gateway/src/validation-schemas.js
- platform/architecture/security-topology.js
- platform/architecture/resilience-topology.js
- platform/architecture/event-contracts.js
- infra/docker-swarm/docker-stack.yml

Tập trung bắt:
- client/edge/gateway controls cho create / get / confirm / refund / callback paths nếu có expose
- scope/role/permission/ownership cho create payment, get payment by id, confirm payment, refund payment, admin/support override
- data security/privacy: at-rest, in-transit, masking/minimization, retention
- service-to-service trust: mTLS, service identity, authz với booking/ride/user relation sources, provider boundary
- event-driven security: event schema/envelope validation, replay protection, topic allowlist, forged-event impact cho `payment.completed` / `payment.failed`
- logging/audit/SIEM/alerting: audit create / confirm / refund / override, centralized logging, tracing fields, suspicious refund/callback forgery/retry storm detection
- resilience security: timeout / circuit breaker / PSP failover, retry không gây double charge, graceful degradation không bypass control, fallback / eventual consistency vẫn giữ integrity
- webhook/provider callback security: signature verification, replay protection, timestamp window, callback abuse/rate limiting

Rules:
- Chỉ PASS khi có evidence trong code/config/runtime artifact.
- Nếu chỉ thấy trong doc/topology thì ghi `Expected by architecture`.
- Nếu runtime/config đang khác kiến trúc thì ghi `Observed runtime differs from architecture`.
- Không suy diễn implementation đã tồn tại.

Đầu ra:
- Findings chuẩn
- Checklist có status cho từng mục
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

