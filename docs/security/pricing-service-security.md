# CAB-BOOKING Security Review Workflow ? WORKFLOW 06 — PRICING-SERVICE

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

## 9. WORKFLOW 06 — PRICING-SERVICE

### Service Security Context

- Business role: tính quote, surge pricing, pricing rule lookup, và trả server-side price snapshot để downstream dùng.
- Security role: đảm bảo fare được tính server-authoritative, signal surge không bị client điều khiển, config không bị thao túng, fallback không tạo giá bất thường, và AI/model boundary không làm suy yếu trust model.
- Inbound interfaces observed trong repo:
  - `POST /api/v1/pricing/quote`
  - `GET /api/v1/pricing/surge`
- Inbound interfaces expected by architecture nhưng chưa có runtime proof:
  - admin/operator config change path cho pricing rule / surge zone
  - internal caller path giữa booking-service và pricing-service nếu được tách rõ
- Outbound dependencies observed trong repo:
  - MongoDB qua Mongoose models `PricingRule` và `SurgeZone`
  - logging qua `services/pricing-service/src/utils/logger.js`
- Outbound dependencies expected by architecture:
  - `booking-service` là consumer của pricing output / price snapshot
  - `Surge Pricing Model` trong `platform/architecture/ai-topology.js`
  - model/data source/feature provenance cho AI surge pricing
- Dữ liệu nhạy cảm phải coi là protected:
  - pricing rule (`baseFare`, `perKm`, `perMinute`)
  - `surgeMultiplier`
  - config metadata / rule timestamps
  - anomaly log / abuse signal
  - price snapshot và signal đầu vào dùng để tạo giá
- Observed in repo:
  - `services/pricing-service/src/routes/pricingRoutes.js`
  - `services/pricing-service/src/controllers/pricingController.js`
  - `services/pricing-service/src/models/PricingRule.js`
  - `services/pricing-service/src/models/SurgeZone.js`
  - `services/pricing-service/src/utils/logger.js`
  - `services/booking-service/src/controllers/bookingController.js`
  - `services/booking-service/src/models/Booking.js`
- Expected by architecture:
  - `platform/architecture/security-topology.js`
  - `platform/architecture/security-zero-trust-architecture.mmd`
  - `platform/architecture/resilience-topology.js`
  - `platform/architecture/ai-topology.js`
  - `docs/architecture/01-overall-architecture.md`
- Preliminary repo-backed concerns:
  - `demandIndex` và `supplyIndex` đang nhận trực tiếp từ request trong `services/pricing-service/src/controllers/pricingController.js`.
  - Gateway chưa có route policy riêng cho `pricing/quote` hay `pricing/surge`.
  - Chưa thấy admin/operator config path hay audit path cho thay đổi `PricingRule` / `SurgeZone`.
  - Booking hiện nhận `priceSnapshot` trực tiếp từ request body trong `services/booking-service/src/controllers/bookingController.js`, nên server-authoritative pricing chưa được chứng minh end-to-end.
  - Chưa thấy runtime integration với AI surge pricing model, trust boundary, hay fallback governance ngoài code local.

### Status Labels Bắt Buộc

- `Implemented`: có evidence trực tiếp trong code/config/test/runtime artifact của repo.
- `Expected by architecture`: chỉ mới thấy ở tài liệu kiến trúc/topology, chưa có runtime implementation đủ mạnh để kết luận đã có control.
- `Missing evidence`: chưa thấy code/config/runtime artifact chứng minh control tồn tại.
- `Observed runtime differs from architecture`: tài liệu kiến trúc yêu cầu control, nhưng runtime/config trong repo cho thấy trạng thái khác hoặc yếu hơn.

### Trust Boundaries Phải Review

- `Client -> Edge -> Gateway -> pricing-service` cho quote / surge / config path nếu có expose.
- `pricing-service -> MongoDB`.
- `booking-service -> pricing-service` cho internal pricing request.
- `pricing-service -> booking-service` cho price snapshot handoff expectation.
- `pricing-service -> AI surge pricing model / model serving API`.
- `pricing-service -> data source / feature provenance source`.
- `Admin/Operator actor -> Gateway -> pricing-service` cho config change path nếu có expose.

### Files/Paths To Review First

- `services/pricing-service/src/routes/pricingRoutes.js`
- `services/pricing-service/src/controllers/pricingController.js`
- `services/pricing-service/src/models/PricingRule.js`
- `services/pricing-service/src/models/SurgeZone.js`
- `services/pricing-service/src/utils/logger.js`
- `services/booking-service/src/controllers/bookingController.js`
- `services/booking-service/src/models/Booking.js`
- `gateway/api-gateway/src/app.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/middleware/authorization.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `gateway/api-gateway/src/validation-schemas.js`
- `platform/architecture/security-topology.js`
- `platform/architecture/resilience-topology.js`
- `platform/architecture/ai-topology.js`
- `infra/docker-swarm/docker-stack.yml`

### Pricing Path Security Matrix

#### A. Client / Edge / Gateway controls cho tất cả pricing paths

- Paths phải review:
  - `POST /api/v1/pricing/quote`
  - `GET /api/v1/pricing/surge`
  - config/admin/operator path nếu có expose
- `HTTPS/TLS 1.3`
  - `Expected by architecture`: `platform/architecture/security-topology.js` và `docs/architecture/01-overall-architecture.md` yêu cầu HTTPS/TLS 1.3 cho client/edge/gateway.
  - `Missing evidence`: chưa thấy TLS termination/runtime certificate config trong gateway code hay `infra/docker-swarm/docker-stack.yml`.
- `WAF`
  - `Expected by architecture`: security topology yêu cầu WAF ở edge.
  - `Missing evidence`: chưa thấy WAF config/runtime artifact cho pricing paths.
- `Rate limiting / quota`
  - `Expected by architecture`: gateway topology yêu cầu rate limit/quota.
  - `Missing evidence`: `gateway/api-gateway/src/route-registry.js` không có policy riêng cho `pricing/quote`, `pricing/surge`, hay config path.
- `Request validation`
  - `Implemented`: `services/pricing-service/src/routes/pricingRoutes.js` có Joi validation cho quote body.
  - `Missing evidence`: gateway không có schema riêng cho pricing paths trong `gateway/api-gateway/src/validation-schemas.js`.
  - `Missing evidence`: `GET /api/v1/pricing/surge` chỉ check `zoneId` presence trong controller, chưa có gateway schema/query validation chuẩn.
- `Authn/Authz qua gateway cho quote / surge / config paths nếu có expose`
  - `Implemented`: family `pricing-service` mặc định `authRequired: true`, `allowedRoles: ["Customer", "Driver", "Admin"]` trong `gateway/api-gateway/src/route-registry.js`.
  - `Missing evidence`: gateway chỉ check `role`; chưa có `scope`/`permission` policy riêng cho quote / surge / config paths.
  - `Missing evidence`: chưa thấy config/admin/operator path để review gateway authz cụ thể.

#### B. `POST /api/v1/pricing/quote`

- `Rate limiting / quota`
  - `Missing evidence`: chưa có gateway policy riêng cho quote path.
- `Request validation`
  - `Implemented`: route-level Joi schema validate `pickupAddress`, `destinationAddress`, `vehicleType`, `distanceKm`, `durationMin`, `demandIndex`, `supplyIndex`.
  - `Missing evidence`: validation hiện cho phép `demandIndex` / `supplyIndex` từ client đi vào production pricing logic.
- `Authn/Authz`
  - `Implemented`: gateway family role gate cho `Customer`, `Driver`, `Admin`.
  - `Missing evidence`: downstream service không check actor intent, scope, hay permission cho quote usage.
- `Ownership / caller trust`
  - `Missing evidence`: chưa thấy quote request được bind với booking workflow hay internal caller identity.
- `Server-authoritative pricing`
  - `Observed runtime differs from architecture`: logic hiện dùng `demandIndex` / `supplyIndex` từ request để tính surge trong `services/pricing-service/src/controllers/pricingController.js`.

#### C. `GET /api/v1/pricing/surge`

- `Rate limiting / quota`
  - `Missing evidence`: chưa có gateway policy riêng.
- `Request validation`
  - `Missing evidence`: controller chỉ check `zoneId` presence; chưa có Joi/query schema riêng.
- `Authn/Authz`
  - `Implemented`: gateway family role gate.
  - `Missing evidence`: chưa có rule chi tiết cho ai được đọc surge theo zone.
- `Ownership / scope`
  - `Missing evidence`: chưa có scope/permission tách biệt public quote-consumer với operator/admin read.
- `Data minimization`
  - `Missing evidence`: response hiện trả thẳng `surgeMultiplier` theo `zoneId`; chưa có policy cho zone visibility/governance.

#### D. Admin/operator config change path nếu có expose

- `Expected by architecture`: pricing rule / surge zone change phải có governance, authz, audit.
- `Missing evidence`: repo chưa có route/controller/path cho config change.
- `Missing evidence`: do chưa có path, cũng chưa có gateway authz/rate limit/validation/audit cho config change.

#### E. Internal caller access nếu pricing được gọi bởi service khác

- `Expected by architecture`: `ai-topology.js` mô tả `booking-service -> pricing-service` là pricing request.
- `Missing evidence`: chưa thấy runtime service-to-service call path, service identity, hay internal authorization contract.

### Authorization Checklist Bắt Buộc

#### `POST /api/v1/pricing/quote`

- `role`
  - `Implemented`: gateway family cho `Customer`, `Driver`, `Admin`.
- `scope`
  - `Missing evidence`: chưa thấy scope như `pricing:quote`, `pricing:quote:booking-flow`.
- `permission`
  - `Missing evidence`: chưa thấy permission tách quote interactive với quote system/internal.
- `ownership`
  - `Missing evidence`: quote request chưa bind với actor/resource cụ thể.
- `caller trust`
  - `Missing evidence`: chưa phân biệt quote từ end-user với internal booking caller.

#### `GET /api/v1/pricing/surge`

- `role`
  - `Implemented`: gateway family role gate.
- `scope`
  - `Missing evidence`
- `permission`
  - `Missing evidence`
- `ownership`
  - `Missing evidence`: zone read không có tenant/zone policy hay operator partition.

#### Admin/operator config change

- `Admin`
  - `Expected by architecture`: pricing config change phải là privileged operation.
  - `Missing evidence`: chưa có admin path, scope, permission, audit, approval step.
- `Operator`
  - `Missing evidence`: không thấy role/operator permission trong gateway hay service.
- `Config governance`
  - `Missing evidence`: không thấy versioning, approval, hay rollback audit cho `PricingRule` / `SurgeZone`.

#### Internal caller access nếu pricing được gọi bởi service khác

- `Service identity`
  - `Missing evidence`: chưa thấy service account hay signed internal request từ booking-service.
- `Authorization`
  - `Missing evidence`: chưa thấy allowlist/permission model cho internal caller.
- `Ownership`
  - `Missing evidence`: chưa thấy pricing quote được bound với booking/request context từ trusted internal source.

### Data Security / Privacy Checklist

- `Encryption at-rest`
  - `Expected by architecture`: security topology yêu cầu encryption at-rest.
  - `Missing evidence`: chưa thấy MongoDB encryption-at-rest/key management artifact cho pricing data.
- `Encryption in-transit`
  - `Expected by architecture`: security topology yêu cầu encryption in-transit.
  - `Observed runtime differs from architecture`: `PRICING_SERVICE_URL` và `BOOKING_SERVICE_URL` trong swarm là `http://...`.
- `Masking / minimization cho pricing rule`
  - `Missing evidence`: chưa có policy giới hạn exposure của `baseFare`, `perKm`, `perMinute`, rule metadata.
- `Masking / minimization cho surge multiplier`
  - `Missing evidence`: `GET /surge` trả trực tiếp `surgeMultiplier`; chưa thấy role-based minimization.
- `Masking / minimization cho config metadata`
  - `Missing evidence`: schema có `timestamps` nhưng chưa có visibility/redaction policy.
- `Masking / minimization cho anomaly log`
  - `Missing evidence`: logger ghi `vehicleType`, `distanceKm`, `demandIndex`, `supplyIndex`; chưa có explicit redaction/minimization policy.
- `Retention policy cho pricing log`
  - `Missing evidence`: chưa thấy log retention policy.
- `Retention policy cho audit trail`
  - `Missing evidence`: chưa có audit trail store/policy.
- `Retention policy cho config change history`
  - `Missing evidence`: chưa thấy config version history hay retention.

### Service-to-Service Trust Checklist

- `mTLS`
  - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu mTLS.
  - `Observed runtime differs from architecture`: swarm đang dùng `http://pricing-service:3101` và `http://booking-service:3103`.
- `Service identity`
  - `Expected by architecture`: topology yêu cầu `per-service identity`.
  - `Missing evidence`: chưa thấy service credential / service account verification cho pricing-service.
- `Authorization giữa pricing-service và booking-service`
  - `Expected by architecture`: internal caller không được implicit trust.
  - `Missing evidence`: chưa thấy runtime call path, allowlist, signed internal request, hay permission contract giữa pricing-service và booking-service.
- `Trust boundary tới AI surge pricing model / data source nếu có`
  - `Expected by architecture`: `ai-topology.js` mô tả `Surge Pricing Model` và `Model Serving API`.
  - `Missing evidence`: chưa thấy runtime integration, auth, timeout, provenance check, hay service identity tới AI model/data source.

### AI Surge Pricing Boundary Checklist

- `Feature/signal provenance cho demand/supply`
  - `Expected by architecture`: AI topology mô tả demand context từ `booking-service`, trip history, pricing context.
  - `Observed runtime differs from architecture`: runtime hiện nhận `demandIndex` / `supplyIndex` trực tiếp từ request client.
- `Không dùng production signal do client tự gửi`
  - `Observed runtime differs from architecture`: controller quote đang dùng signal client gửi vào để tính giá.
- `Auth/trust boundary với AI model`
  - `Expected by architecture`: pricing-service là `AI pricing consumer`.
  - `Missing evidence`: chưa thấy auth/trust boundary runtime với `Surge Pricing Model` hay `Model Serving API`.
- `Fallback fixed rule không bị abuse`
  - `Implemented`: khi `supplyIndex <= 0`, code ép `surgeMultiplier = 1.0`; khi không có rule vehicle-specific thì fallback `vehicleType: 'standard'`.
  - `Missing evidence`: chưa có audit/alert khi fallback xảy ra, chưa có guarantee fallback không bị lợi dụng để ép giá thấp/bất thường.

### Logging / Audit / SIEM / Alerting Checklist

- `Audit pricing rule / surge zone change`
  - `Missing evidence`: chưa thấy config change path hay audit trail.
- `Centralized logging`
  - `Implemented`: dùng Winston JSON console logger trong `services/pricing-service/src/utils/logger.js`.
  - `Missing evidence`: chưa thấy centralized sink / ELK / OpenSearch integration artifact.
- `Anomaly detection cho surge manipulation / quote abuse`
  - `Expected by architecture`: security topology yêu cầu SIEM/real-time alerts.
  - `Missing evidence`: chưa thấy detection rule, rate abuse analytics, hay surge manipulation alerting.
- `Correlation/tracing phục vụ điều tra tampering`
  - `Implemented`: quote response có `requestId` trong `formatResponse()`.
  - `Missing evidence`: chưa có `correlationId` chuẩn, chưa propagate tracing context đầy đủ, surge path không log correlation context rõ.
- `Sensitive logging hygiene`
  - `Missing evidence`: logger hiện ghi raw `demandIndex` / `supplyIndex`; chưa có policy xác định field nào nên log / mask / aggregate.

### Resilience Security Checklist

- `Timeout / circuit breaker với AI surge model hoặc dependency`
  - `Expected by architecture`: `platform/architecture/resilience-topology.js` yêu cầu timeout/circuit breaker.
  - `Missing evidence`: pricing-service runtime hiện không có AI/model dependency client để chứng minh timeout/circuit breaker.
- `Fallback không tạo giá bất thường`
  - `Implemented`: có floor `surgeMultiplier >= 1.0` và fallback `standard` rule nếu thiếu vehicle-specific rule.
  - `Missing evidence`: chưa có guard upper-bound, anomaly alert, hay policy chứng minh fallback không gây snapshot sai đáng kể.
- `Race condition / stale data không làm sai snapshot`
  - `Missing evidence`: chưa thấy snapshot versioning, rule version pinning, hay concurrency control cho pricing config reads.
- `Graceful degradation vẫn giữ server-authoritative pricing`
  - `Expected by architecture`: resilience topology yêu cầu graceful degradation.
  - `Observed runtime differs from architecture`: dù giá được tính server-side, runtime vẫn dùng signal client-controlled nên chưa đạt server-authoritative pricing đúng nghĩa.

### Step-by-step Review Workflow

1. Review client/edge/gateway controls cho quote / surge / config paths.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/app.js`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`
   - Kiểm tra: `HTTPS/TLS 1.3`, WAF, rate limiting/quota, request validation, authn/authz gateway.
2. Review quote authority.
   - Đọc: `services/pricing-service/src/routes/pricingRoutes.js`, `services/pricing-service/src/controllers/pricingController.js`
   - Kiểm tra: demand/supply, distance/duration, vehicleType có nguồn trusted hay client tự quyết.
3. Review surge path và config governance.
   - Đọc: `services/pricing-service/src/controllers/pricingController.js`, `services/pricing-service/src/models/PricingRule.js`, `services/pricing-service/src/models/SurgeZone.js`
   - Kiểm tra: `scope/role/permission/ownership`, admin/operator config change, fallback behavior, config governance.
4. Review service-to-service trust với booking-service.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`, `services/booking-service/src/models/Booking.js`, `platform/architecture/ai-topology.js`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra: internal caller access, price snapshot trust, mTLS, service identity, authorization contract.
5. Review AI surge pricing boundary.
   - Đọc: `platform/architecture/ai-topology.js`, pricing service source
   - Kiểm tra: feature provenance, model trust boundary, fallback fixed rule, client-supplied production signal.
6. Review data security/privacy.
   - Đọc: pricing models, logger, architecture docs
   - Kiểm tra: at-rest, in-transit, masking/minimization, retention.
7. Review logging/audit/SIEM/alerting.
   - Đọc: `services/pricing-service/src/utils/logger.js`, controller code, architecture docs
   - Kiểm tra: audit config change, centralized logging, anomaly detection, correlation/tracing.
8. Review resilience security.
   - Đọc: `platform/architecture/resilience-topology.js`, controller code, infra config
   - Kiểm tra: timeout/circuit breaker, fallback safety, stale data/race condition impact, graceful degradation.

### Checklist Kết Luận Cuối

- Quote path không được PASS nếu production signal `demandIndex/supplyIndex` còn đến từ client.
- Gateway control cho pricing paths phải được đánh riêng cho `quote`, `surge`, và `config`; không được dùng family auth chung để kết luận đủ.
- Pricing authority chỉ PASS khi price snapshot downstream không thể bị client ghi đè.
- AI surge boundary chỉ PASS khi có provenance/trust boundary runtime, không chỉ topology.
- Config governance chỉ PASS khi có admin/operator path, authz, audit, và change history evidence.
- Internal service-to-service trust chỉ PASS khi có mTLS/service identity/authz evidence.
- Logging/audit chỉ PASS khi trace đủ để điều tra tampering/surge manipulation/config abuse.
- Resilience chỉ PASS khi fallback/degradation vẫn giữ server-authoritative pricing và không tạo giá bất thường.

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

- Gateway route policy/schema riêng cho `pricing/quote` và `pricing/surge`.
- Admin/operator config change path và audit trail cho `PricingRule` / `SurgeZone`.
- Runtime evidence rằng demand/supply signal đến từ hệ thống trusted thay vì client.
- Internal authorization contract giữa booking-service và pricing-service.
- Runtime integration với AI surge pricing model có auth/trust boundary.
- Retention policy cho pricing log, audit trail, config change history.
- Anomaly detection / alerting cho surge manipulation và quote abuse.

### Fix Priority

- P0: client-controlled fare, client-controlled demand/supply, unsafe fallback gây sai giá, server-authoritative pricing bị phá vỡ.
- P1: thiếu config governance/audit, thiếu service identity/mTLS proof, thiếu price snapshot integrity với booking-service, thiếu AI model trust boundary.
- P2: monitoring/anomaly detection, tracing completeness, docs/runtime consistency.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan tối thiểu các file:
   - `services/pricing-service/src/routes/pricingRoutes.js`
   - `services/pricing-service/src/controllers/pricingController.js`
   - `services/pricing-service/src/models/PricingRule.js`
   - `services/pricing-service/src/models/SurgeZone.js`
   - `services/pricing-service/src/utils/logger.js`
   - `services/booking-service/src/controllers/bookingController.js`
   - `services/booking-service/src/models/Booking.js`
   - `gateway/api-gateway/src/route-registry.js`
   - `platform/architecture/ai-topology.js`
   - `platform/architecture/security-topology.js`
   - `infra/docker-swarm/docker-stack.yml`
4. Đánh dấu từng item là `Implemented`, `Expected by architecture`, `Missing evidence`, hoặc `Observed runtime differs from architecture`.
5. Chỗ nào chưa có evidence thì nói thẳng là chưa có.

### AI Review Prompt

```text
Bạn là security reviewer cho pricing-service của CAB-BOOKING.

Ưu tiên đọc:
- services/pricing-service/src/routes/pricingRoutes.js
- services/pricing-service/src/controllers/pricingController.js
- services/pricing-service/src/models/PricingRule.js
- services/pricing-service/src/models/SurgeZone.js
- services/pricing-service/src/utils/logger.js
- services/booking-service/src/controllers/bookingController.js
- services/booking-service/src/models/Booking.js
- gateway/api-gateway/src/route-registry.js
- gateway/api-gateway/src/validation-schemas.js
- platform/architecture/security-topology.js
- platform/architecture/resilience-topology.js
- platform/architecture/ai-topology.js
- infra/docker-swarm/docker-stack.yml

Tập trung bắt:
- client/edge/gateway controls cho quote / surge / config paths nếu có expose
- scope/role/permission/ownership cho `POST /api/v1/pricing/quote`, `GET /api/v1/pricing/surge`, admin/operator config change, internal caller access
- data security/privacy: at-rest, in-transit, masking/minimization, retention
- service-to-service trust: mTLS, service identity, authorization giữa pricing-service và booking-service, trust boundary tới AI surge pricing model / data source
- AI surge pricing boundary: feature/signal provenance, không dùng production signal do client tự gửi, auth/trust boundary với AI model, fallback fixed rule không bị abuse
- logging/audit/SIEM/alerting: audit pricing rule / surge zone change, centralized logging, anomaly detection cho surge manipulation / quote abuse, correlation/tracing phục vụ điều tra tampering
- resilience security: timeout / circuit breaker với AI surge model hoặc dependency, fallback không tạo giá bất thường, race condition / stale data không làm sai snapshot, graceful degradation vẫn giữ server-authoritative pricing

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

