# CAB-BOOKING Security Review Workflow ? WORKFLOW 03 — DRIVER-SERVICE

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

## 6. WORKFLOW 03 — DRIVER-SERVICE

### Service Security Context

- Business role: quản lý hồ sơ tài xế, trạng thái online/offline, location update, driver availability.
- Security role: bảo vệ profile/KYC/license/PII của tài xế, ngăn privilege escalation và status abuse.
- Inbound interfaces:
  - `GET /available`
  - `GET /:driverId`
  - `PATCH /:driverId`
  - `PATCH /:driverId/location`
  - `POST /:driverId/go-online`
  - `POST /:driverId/go-offline`
- Outbound dependencies: MongoDB, gateway, Kafka expected, ride-service expected.
- Dữ liệu nhạy cảm: phone, vehicle/license info, location, approval/KYC-related profile.
- Observed in repo:
  - `services/driver-service/src/controllers/driverController.js`
  - `services/driver-service/src/models/Driver.js`
  - `services/driver-service/src/utils/index.js`
- Expected by CAB architecture:
  - Client/edge đi qua `HTTPS/TLS 1.3`, WAF, rate limiting theo `IP/user/device`, abuse protection ở gateway theo `platform/architecture/security-topology.js`.
  - Authz không chỉ có RBAC/ABAC/ownership mà còn có `scope` và `permission` theo gateway security profile.
  - ABAC theo KYC/account/ride state, audit admin action, centralized logging, correlation fields, SIEM, alerting.
  - Data security gồm encryption in-transit, encryption at-rest, masking dữ liệu nhạy cảm.
  - Realtime GPS chuẩn kiến trúc đi theo `Driver App -> WebSocket gateway -> ride-service -> Redis Geo -> Kafka`, không chỉ HTTP patch trực tiếp.
  - Event `driver.assigned` và `driver.location.updated` có trong kiến trúc với producer là `driver-service` theo `message-broker/kafka/topology.json` và `platform/architecture/event-contracts.js`.
- Preliminary repo-backed concerns:
  - `driver-service` runtime chưa thấy auth/role/ownership/scope/permission guard trong service.
  - `driver-service` runtime chưa thấy upload tài liệu, KYC, audit path, SIEM hook, alerting.
  - `driver-service` runtime hiện dùng HTTP location update; chưa thấy WebSocket GPS, Redis Geo, Kafka producer trong service này.

### Evidence Status Labels

- `Implemented`: control có evidence rõ trong code/config/test/runtime artifact của repo.
- `Expected by architecture`: control xuất hiện trong tài liệu kiến trúc bảo mật/Zero Trust/realtime nhưng chưa thấy runtime evidence đủ mạnh.
- `Missing evidence`: chưa có đủ artifact để kết luận control tồn tại hoặc hoạt động đúng.
- `Observed runtime differs from architecture`: runtime hiện tại đi khác hướng kiến trúc chuẩn; phải ghi rõ chênh lệch, không mô tả như requirement runtime đang có sẵn.

### Trust Boundaries

- `Driver/Admin -> Gateway -> driver-service`
- `driver-service -> MongoDB`
- `driver-service -> broker` cho assignment/location events
- `driver-service -> ride-service` hoặc user-service expected
- `Driver App -> WebSocket gateway -> ride-service -> Redis Geo -> Kafka` là realtime trust path theo kiến trúc chuẩn

### Attack Surface

- HTTP profile read/write.
- HTTP location update.
- Online/offline state mutation.
- Potential broker event producer.
- PII vehicle/license fields trong model.
- Gateway-exposed edge path cho driver endpoints: TLS, WAF, rate limit, abnormal request blocking, abuse protection.
- Scope/permission misuse trên profile, status, approval, KYC, location.
- Logging/audit pipeline cho location abuse, status abuse, approval/KYC change.

### Files/Paths To Review First

- `services/driver-service/src/routes/index.js`
- `services/driver-service/src/controllers/driverController.js`
- `services/driver-service/src/models/Driver.js`
- `services/driver-service/src/utils/index.js`
- `services/driver-service/src/index.js`
- `platform/architecture/service-manifests.js`
- `platform/architecture/realtime-topology.js`
- `platform/architecture/event-contracts.js`
- `platform/architecture/security-topology.js`
- `gateway/api-gateway/src/security/jwt-service.js`
- `gateway/api-gateway/src/security/abac.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/realtime/hub.js`
- `gateway/api-gateway/docs/02-architecture.md`
- `gateway/api-gateway/docs/05-security-zero-trust.md`
- `gateway/api-gateway/docs/11-observability-tracing.md`
- `message-broker/kafka/topology.json`
- `infra/docker-swarm/docker-stack.yml`

### Step-by-step Review Workflow

1. Review client / edge security cho driver endpoints qua gateway.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/docs/02-architecture.md`, `gateway/api-gateway/docs/05-security-zero-trust.md`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/route-registry.js`
   - Kiểm tra:
     - `HTTPS/TLS 1.3`
     - WAF
     - rate limiting theo `IP/user/device`
     - abuse protection cho endpoint driver-service qua gateway
   - `Implemented`: chỉ khi có code/config/runtime artifact chứng minh control đang bật.
   - `Expected by architecture`: `HTTPS/TLS 1.3`, WAF, rate limiting theo `IP/user/device`, abnormal request blocking có trong `platform/architecture/security-topology.js`.
   - `Missing evidence`: repo hiện chưa có artifact runtime rõ cho TLS 1.3, WAF, device-based rate limiting, abuse protection riêng cho driver-service routes.
2. Review ownership + scope + permission + RBAC/ABAC.
   - Đọc: `services/driver-service/src/routes/index.js`, `services/driver-service/src/controllers/driverController.js`, `gateway/api-gateway/src/security/jwt-service.js`, `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/security/abac.js`
   - Kiểm tra:
     - ownership map giữa actor và `driverId`
     - `scope` và `permission` riêng, không chỉ role
     - ABAC theo ride state / location / account context
   - `Implemented`: gateway có parse `scopes` và `permissions` trong `jwt-service.js`; ABAC GPS có rule `Driver can update GPS only when ride status is ACTIVE` ở `gateway/api-gateway/src/security/abac.js`.
   - `Missing evidence`: `driver-service` runtime chưa thấy enforce ownership, scope, permission ở service/domain layer; chưa thấy route-level permission map riêng cho driver endpoints.
   - FAIL evidence: ai biết `driverId` cũng GET/PATCH/POST được hoặc chỉ check auth mà không check scope/permission/resource.
3. Review field-level authorization và sensitive mutation.
   - Đọc: `services/driver-service/src/utils/index.js`, `services/driver-service/src/models/Driver.js`
   - Kiểm tra: field như `status`, `availability`, vehicle info, phone, location có bị mass assignment không; approval/KYC/license path có guard riêng không.
   - `Implemented`: validation chỉ allow một tập field trong `validateDriverPayload`.
   - `Missing evidence`: chưa có tách biệt admin-only field, chưa có permission boundary cho approval/KYC/license mutation.
   - FAIL evidence: payload có thể đổi trạng thái nhạy cảm hoặc info nhạy cảm mà không guard.
4. Review KYC / approval / audit / alert expectations.
   - Đọc: `services/driver-service/*`, `platform/architecture/security-topology.js`, `gateway/api-gateway/docs/11-observability-tracing.md`
   - Kiểm tra:
     - approval/KYC change có workflow owner rõ không
     - centralized logging
     - correlation fields
     - SIEM
     - alerting cho `location abuse`, `status abuse`, `approval/KYC change`
   - `Expected by architecture`: centralized logging (`ELK/OpenSearch`), SIEM, real-time alerts có trong `platform/architecture/security-topology.js`.
   - `Implemented`: response meta của `driver-service` có `requestId`, `correlationId`, `timestamp` trong `services/driver-service/src/utils/index.js`.
   - `Missing evidence`: chưa thấy audit trail bền vững, centralized logging pipeline, SIEM integration, alert rule, hay log event riêng cho approval/KYC/status/location abuse.
5. Review location abuse và realtime/WebSocket GPS path.
   - Đọc: `services/driver-service/src/controllers/driverController.js`, `services/driver-service/src/routes/index.js`, `platform/architecture/realtime-topology.js`, `gateway/api-gateway/src/realtime/hub.js`, `gateway/api-gateway/src/security/abac.js`
   - Kiểm tra:
     - runtime có dùng WebSocket GPS path hay chỉ HTTP `PATCH /:driverId/location`
     - nếu có WebSocket thì có auth handshake, rate limit, schema validation, ABAC
     - nếu chỉ có HTTP thì phải ghi rõ khoảng lệch với kiến trúc chuẩn `WebSocket + Redis + Kafka`
   - `Implemented`: gateway realtime hub có handshake auth, WS rate limit, schema validation, ABAC cho `driver.location.update`.
   - `Observed runtime differs from architecture`: `driver-service` runtime hiện chỉ thấy HTTP location update; chưa thấy service này xử lý WebSocket GPS, Redis Geo, Kafka publish như topology chuẩn.
   - `Missing evidence`: chưa thấy driver-service consume WS stream hoặc bridge HTTP update sang Redis/Kafka path.
6. Review event expectation và event integrity.
   - Đọc: `message-broker/kafka/topology.json`, `platform/architecture/event-contracts.js`, `platform/architecture/realtime-topology.js`, `services/driver-service/*`
   - Kiểm tra:
     - producer của `driver.assigned` và `driver.location.updated` trong kiến trúc
     - runtime có producer thật hay không
     - event envelope/correlation/schema/replay safety
   - `Expected by architecture`: `driver.assigned` và `driver.location.updated` có producer là `driver-service` trong `message-broker/kafka/topology.json` và `platform/architecture/event-contracts.js`.
   - `Observed runtime differs from architecture`: chưa thấy Kafka producer hoặc publish path tương ứng trong `services/driver-service` runtime.
   - `Missing evidence`: chưa thấy event envelope, correlation/idempotency metadata, replay guard, schema validation ở producer runtime.
7. Review data security / privacy.
   - Đọc: `services/driver-service/src/models/Driver.js`, `services/driver-service/src/controllers/driverController.js`, `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra:
     - encryption at-rest
     - encryption in-transit
     - masking dữ liệu nhạy cảm như `phone`, `license`, `KYC`, `location`
   - `Expected by architecture`: encryption `at-rest` và `in-transit`, masking có trong `platform/architecture/security-topology.js`.
   - `Missing evidence`: chưa thấy field-level encryption/masking trong model/controller; chưa thấy masking response/log; infra hiện chưa chứng minh internal transport encrypted end-to-end.
   - `Observed runtime differs from architecture`: Kafka đang `PLAINTEXT` trong `infra/docker-swarm/docker-stack.yml`, nên internal event transport chưa khớp yêu cầu encrypted internal traffic.

### PASS/FAIL Checklist

- Driver chỉ đọc/sửa profile của chính mình hoặc admin path rõ.
- `PATCH /:driverId/location` không phải open update endpoint.
- Driver endpoint qua gateway có evidence cho TLS/WAF/rate limiting/abuse protection; nếu không có thì ghi đúng `Expected by architecture` hoặc `Missing evidence`.
- Review phải có `scope` và `permission` riêng, không chỉ RBAC/ABAC/ownership.
- Không có mass assignment cho status/availability/license data.
- Online/offline transition có authz rõ.
- KYC/approval state không bị thay bởi actor không đúng vai trò.
- Correlation fields phải hiện diện và nhất quán qua request/response/log artifact.
- Có evidence centralized logging, SIEM, alerting cho `location abuse`, `status abuse`, `approval/KYC change`; nếu chưa có thì không PASS.
- Có review rõ cho encryption at-rest, encryption in-transit, masking `phone/license/KYC/location`.
- PII không lộ tràn qua response/log mặc định.
- Admin action hoặc approval change có audit evidence.
- Realtime GPS path phải được đánh dấu rõ:
  - `Implemented` nếu có WS + Redis + Kafka evidence
  - `Observed runtime differs from architecture` nếu runtime chỉ có HTTP location update
- Event expectation phải bám đúng kiến trúc:
  - `Expected by architecture`: `driver.location.updated` producer là `driver-service`
  - `Observed runtime differs from architecture`: runtime service chưa publish event này
- Bất kỳ control nào không có evidence thì không PASS.

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

- Evidence auth context mapping từ gateway sang driver-service.
- Evidence route-level scope/permission enforcement riêng cho driver endpoints.
- Evidence TLS 1.3/WAF/device-based rate limiting và abuse protection runtime cho driver-service path.
- Evidence KYC/upload flow, approval owner, audit admin action, centralized logging, SIEM, alerting.
- Evidence Kafka producer thật cho assignment/location events.
- Evidence realtime/WebSocket GPS path trong driver-service hoặc bridge runtime sang Redis/Kafka.
- Evidence field masking/encryption cho `phone`, `license`, `KYC`, `location`.

### Fix Priority

- P0: privilege escalation, driver profile IDOR, status abuse, location abuse, missing scope/permission enforcement, open sensitive mutation path.
- P1: thiếu audit/logging/SIEM/alerting, thiếu ABAC theo ride/KYC state, PII exposure, runtime lệch kiến trúc realtime/event.
- P2: event/docs consistency, observability completeness, resilience details.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/driver-service/src/controllers/driverController.js`
   - `services/driver-service/src/models/Driver.js`
   - `services/driver-service/src/utils/index.js`
   - `gateway/api-gateway/src/security/abac.js`
   - `gateway/api-gateway/src/security/jwt-service.js`
   - `gateway/api-gateway/src/middleware/rate-limit.js`
   - `gateway/api-gateway/src/realtime/hub.js`
   - `platform/architecture/security-topology.js`
   - `platform/architecture/realtime-topology.js`
   - `platform/architecture/event-contracts.js`
   - `message-broker/kafka/topology.json`
   - `infra/docker-swarm/docker-stack.yml`
4. So sánh với checklist.
5. Với mỗi control, đánh dấu một trong bốn trạng thái:
   - `Implemented`
   - `Expected by architecture`
   - `Missing evidence`
   - `Observed runtime differs from architecture`
6. Không viết như thể runtime đã có TLS/WAF/SIEM/Kafka/WebSocket GPS nếu repo chưa chứng minh.
7. Ghi findings theo template.

### AI Review Prompt

```text
Bạn là security reviewer cho driver-service của CAB-BOOKING.

Ưu tiên đọc:
- services/driver-service/src/routes/index.js
- services/driver-service/src/controllers/driverController.js
- services/driver-service/src/models/Driver.js
- services/driver-service/src/utils/index.js
- platform/architecture/realtime-topology.js
- platform/architecture/event-contracts.js
- platform/architecture/security-topology.js
- gateway/api-gateway/src/security/abac.js
- gateway/api-gateway/src/security/jwt-service.js
- gateway/api-gateway/src/middleware/rate-limit.js
- gateway/api-gateway/src/realtime/hub.js
- message-broker/kafka/topology.json
- infra/docker-swarm/docker-stack.yml

Tập trung bắt:
- privilege escalation
- driver/profile IDOR
- driver status abuse
- unsafe location update
- missing scope/permission enforcement
- client/edge security gap cho driver endpoints
- PII/KYC leak
- thiếu audit/logging/SIEM/alerting cho admin action, KYC/approval, location abuse, status abuse
- thiếu ABAC theo ride/KYC/account state
- data security/privacy gap: encryption at-rest, encryption in-transit, masking
- runtime lệch kiến trúc realtime `WebSocket + Redis + Kafka`
- event expectation lệch kiến trúc hoặc bị diễn đạt sai

Rules:
- Không assume gateway đã enforce đủ ownership.
- Không assume RBAC là đủ nếu chưa thấy scope/permission.
- Nếu KYC/upload/audit path không thấy trong repo, ghi rõ là missing evidence.
- Nếu runtime hiện tại khác kiến trúc chuẩn, phải ghi `Observed runtime differs from architecture`.
- Không được gán sai producer của `driver.location.updated`; kiến trúc hiện tại ghi producer là `driver-service`, nhưng nếu runtime không publish thì phải nói thẳng runtime đang lệch kiến trúc.
- Với mỗi control, phải gắn đúng một trạng thái:
  - `Implemented`
  - `Expected by architecture`
  - `Missing evidence`
  - `Observed runtime differs from architecture`

Đầu ra:
- Findings chuẩn
- PASS/FAIL checklist
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

