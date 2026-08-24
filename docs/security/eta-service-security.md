# CAB-BOOKING Security Review Workflow ? WORKFLOW 10 — ETA-SERVICE

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

## 13. WORKFLOW 10 — ETA-SERVICE

### Service Security Context

- Business role: tính ETA từ GPS/location/trip context, phục vụ tracking và UX real-time.
- Security role: chặn poisoned location input, forged GPS event, cache poisoning, external routing API abuse, location leak.
- Inbound interfaces:
  - Observed runtime: chưa có service runtime riêng trong `services/`; ETA hiện là module `services/ride-service/src/services/eta.service.js`.
  - Target architecture: ETA là service độc lập nhận GPS/event input, ride context, trip history, routing/traffic API.
- Outbound dependencies: Redis Geo expected, routing/traffic API expected, feature store/model serving expected, ride-service.
- Dữ liệu nhạy cảm: live location, trip path, ETA output, API key routing provider.
- Observed in repo:
  - `services/ride-service/src/services/eta.service.js`
  - `services/ride-service/src/services/location.service.js`
  - `services/ride-service/src/realtime/socket.js`
  - `services/ride-service/src/services/ride.service.js`
  - `platform/architecture/ai-topology.js`
  - `platform/architecture/realtime-topology.js`
  - `data-layer/redis/geo-topology.json`
- Expected by CAB architecture:
  - ETA là service độc lập, nhận GPS/event input, dùng Redis hot-store, routing/traffic API, fallback historical average, và có boundary authn/authz riêng nếu expose path.
- Preliminary repo-backed concerns:
  - Observed runtime: ETA hiện là code tính toán nội bộ, chưa có authz boundary riêng.
  - Observed runtime differs from architecture: runtime ETA đang gắn trong `ride-service`, chưa phải service độc lập.
  - Observed runtime differs from architecture: `location.service.js` đang dùng in-memory `Map`, trong khi target architecture mô tả Redis Geo / feature store / model serving.
  - Missing evidence: routing API key, Redis TTL/invalidation, schema validation cho ETA-serving path độc lập, retention policy cho location.

### Runtime vs Architecture Boundary

- `Observed runtime`
  - ETA hiện nằm trong `services/ride-service/src/services/eta.service.js`.
  - Tính ETA chủ yếu bằng Haversine + `avgSpeed = 30`.
  - `services/ride-service/src/services/location.service.js` đang lưu location bằng in-memory `Map`.
  - ETA được cập nhật từ `ride.service.js` khi location update vào ride runtime.
- `Target architecture`
  - ETA là service độc lập.
  - Input đi qua realtime/event path có source provenance rõ.
  - Redis Geo là hot-store.
  - Có thể dùng historical average / feature store / model serving cho ETA prediction.
- `Observed runtime differs from architecture`
  - runtime chưa có ETA service độc lập
  - runtime chưa có Redis Geo writer/reader trong ETA path
  - runtime chưa có routing/traffic API integration
  - runtime chưa có feature-store/model-serving boundary cho ETA

### Evidence Status Labels

- `Implemented`: control có evidence rõ trong code/config/test/runtime artifact của repo.
- `Expected by architecture`: control xuất hiện trong tài liệu kiến trúc nhưng chưa có runtime evidence đủ mạnh.
- `Missing evidence`: chưa có đủ artifact để kết luận control tồn tại hoặc hoạt động đúng.
- `Observed runtime differs from architecture`: runtime hiện tại đi khác kiến trúc đích; phải ghi thẳng chỗ lệch, không mô tả như implementation đã tồn tại.

### Trust Boundaries

- `Observed runtime`: `driver-app / REST test path -> ride-service -> eta.service.js`
- `Observed runtime`: `ride.service.js -> location.service.js -> eta.service.js`
- `Target architecture`: `driver-app -> gateway WS -> ETA service`
- `Target architecture`: `driver.location.updated / GPSLocationStream -> ETA service`
- `Target architecture`: `ETA service -> Redis Geo`
- `Target architecture`: `ETA service -> routing/traffic API`
- `Target architecture`: `ETA service -> customer/driver/admin/internal consumer`

### Attack Surface

- GPS event input.
- ETA calculation function input.
- ETA-serving path nếu expose qua API/gateway.
- Cache read/write expected.
- External API integration expected.
- Fallback historical average expected.
- Realtime/WebSocket message boundary.
- AI/ML feature ingestion / serving path nếu ETA dùng historical/model-based prediction.

### Files/Paths To Review First

- `services/ride-service/src/services/eta.service.js`
- `services/ride-service/src/services/location.service.js`
- `services/ride-service/src/services/ride.service.js`
- `services/ride-service/src/realtime/socket.js`
- `services/ride-service/src/controllers/ride.controller.js`
- `gateway/api-gateway/src/realtime/hub.js`
- `gateway/api-gateway/src/security/jwt-service.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `gateway/api-gateway/docs/02-architecture.md`
- `gateway/api-gateway/docs/05-security-zero-trust.md`
- `gateway/api-gateway/docs/11-observability-tracing.md`
- `platform/architecture/ai-topology.js`
- `platform/architecture/security-topology.js`
- `platform/architecture/realtime-topology.js`
- `data-layer/redis/geo-topology.json`
- `platform/ml/feature-store-topology.json`

### Step-by-step Review Workflow

1. Review ETA input trust boundary.
   - Đọc: `services/ride-service/src/services/eta.service.js`, `services/ride-service/src/services/location.service.js`
   - Kiểm tra: input lat/lng/ride context có schema validation và source trust không.
   - `Implemented`: `location.service.js` có validate lat/lng cơ bản; `ride.service.js` chỉ update ETA khi có `driverId` khớp ride.
   - `Missing evidence`: source provenance riêng cho ETA input, anti-forgery boundary, replay guard.
   - FAIL evidence: ETA nhận thẳng location payload không provenance.
2. Review observed runtime vs target architecture separation.
   - Đọc: `services/ride-service/src/services/ride.service.js`, `platform/architecture/ai-topology.js`
   - Kiểm tra: ETA có boundary runtime riêng hay đang gắn chặt vào ride-service.
   - `Observed runtime`: ETA là helper nội bộ trong `ride-service`.
   - `Expected by architecture`: ETA prediction là capability/service boundary độc lập trong `platform/architecture/ai-topology.js`.
   - `Observed runtime differs from architecture`: runtime chưa có control plane, authz plane, service identity riêng cho ETA.
3. Review Client / Edge / Gateway security cho ETA path.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/security/jwt-service.js`, `gateway/api-gateway/src/route-registry.js`
   - Kiểm tra:
     - `HTTPS/TLS 1.3`
     - WAF
     - rate limiting
     - request validation
     - authn/authz cho ETA-serving path nếu có expose qua API/gateway
   - `Expected by architecture`: TLS 1.3, WAF, rate limiting, request validation, scope/role/permission checks có trong security topology và gateway docs.
   - `Missing evidence`: repo chưa có route ETA riêng qua gateway; chưa có runtime evidence cho TLS/WAF/rate limit/validation riêng trên ETA-serving path.
   - `Observed runtime differs from architecture`: vì ETA chưa là service độc lập nên chưa có gateway path/edge policy riêng cho ETA.
4. Review scope / permission / ownership.
   - Đọc: `services/ride-service/src/services/ride.service.js`, `services/ride-service/src/controllers/ride.controller.js`, `gateway/api-gateway/src/security/jwt-service.js`
   - Kiểm tra:
     - ai được xem ETA của ride nào
     - `passenger / driver / admin / internal service` được xem mức dữ liệu nào
     - ownership/resource boundary có rõ không
   - `Implemented`: `ride.service.js` có path đọc rides theo `userId` và `driverId` trong runtime ride domain.
   - `Missing evidence`: policy riêng cho ETA payload exposure theo role/scope/permission; chưa thấy data-minimized ETA view cho từng actor.
   - `Observed runtime differs from architecture`: target ETA service độc lập chưa có authz boundary riêng cho consumer.
5. Review Redis/cache expectation.
   - Đọc: `data-layer/redis/geo-topology.json`, `platform/architecture/realtime-topology.js`
   - Kiểm tra: Redis Geo writer, TTL, invalidation, cache poisoning defense.
   - `Expected by architecture`: Redis Geo hot-store có trong `data-layer/redis/geo-topology.json`, `realtime-topology.js`.
   - `Observed runtime differs from architecture`: `location.service.js` đang dùng in-memory `Map`, không phải Redis Geo.
   - `Missing evidence`: TTL, invalidation, cache poisoning guard, retention policy cho location cache.
6. Review routing/traffic API expectation.
   - Đọc: `platform/architecture/ai-topology.js`, `services/ride-service/src/services/eta.service.js`
   - Kiểm tra: external API key handling, timeout, retry, circuit breaker, fallback.
   - `Expected by architecture`: routing/traffic API và fallback historical average xuất hiện trong ETA architecture intent.
   - `Missing evidence`: runtime chưa thấy external routing API, secret handling, timeout/retry/circuit breaker, abuse control.
7. Review data security / privacy.
   - Đọc: `services/ride-service/src/services/location.service.js`, `services/ride-service/src/services/ride.service.js`, `platform/architecture/security-topology.js`
   - Kiểm tra:
     - encryption at-rest
     - encryption in-transit
     - masking/minimization cho `live location`, `trip path`, `ETA payload`
     - retention/logging policy cho dữ liệu vị trí
   - `Expected by architecture`: encryption `at-rest`, `in-transit`, masking có trong `platform/architecture/security-topology.js`.
   - `Missing evidence`: field masking/minimization riêng cho ETA payload, retention policy, log sanitation cho location/trip path.
   - `Observed runtime differs from architecture`: runtime hiện lưu/đẩy location trong ride runtime và docs test path, chưa chứng minh boundary privacy riêng cho ETA service.
8. Review realtime / WebSocket boundary.
   - Đọc: `gateway/api-gateway/src/realtime/hub.js`, `services/ride-service/src/realtime/socket.js`, `platform/architecture/realtime-topology.js`
   - Kiểm tra:
     - handshake auth
     - per-message authorization
     - replay/forgery protection
     - source provenance của GPS/event input
   - `Implemented`: gateway realtime hub có handshake auth, WS rate limit, schema validation, ABAC cho `driver.location.update`.
   - `Missing evidence`: replay token, message signature, forged-event defense downstream tại ETA module, source provenance chain tới ETA calculation.
   - `Observed runtime differs from architecture`: runtime ETA module không phải consumer/service WS riêng; boundary hiện nằm ở gateway và ride-service.
9. Review logging / audit / SIEM / alerting.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/docs/11-observability-tracing.md`, `services/ride-service/*`
   - Kiểm tra:
     - poisoned ETA input
     - cache poisoning
     - routing API abuse
     - location leak
     - bất thường ETA drift
   - `Expected by architecture`: centralized logging, SIEM, real-time alerting có trong `platform/architecture/security-topology.js`.
   - `Missing evidence`: alert rules, audit trail, detector cho ETA drift, poisoned input, cache poisoning, routing API abuse, location leak.
10. Review AI/ML trust boundary cho ETA.
   - Đọc: `platform/architecture/ai-topology.js`, `platform/ml/feature-store-topology.json`
   - Kiểm tra:
     - feature ingestion trust
     - serving auth
     - PII minimization
     - poisoning guard
   - `Expected by architecture`: ETA Prediction, Feature Store, Model Serving API có trong `ai-topology.js` và `feature-store-topology.json`.
   - `Observed runtime differs from architecture`: runtime ETA hiện là Haversine + average speed, chưa thấy feature store hay model serving.
   - `Missing evidence`: serving auth, feature lineage, poisoning guard, PII minimization trong feature ingestion.

### PASS/FAIL Checklist

- ETA input có schema validation và source provenance.
- GPS/event input được coi là untrusted.
- Runtime vs architecture phải tách rõ:
  - `Observed runtime`: ETA đang là module trong `ride-service`
  - `Target architecture`: ETA là service độc lập
  - mọi chỗ lệch phải ghi `Observed runtime differs from architecture`
- ETA path qua gateway, nếu có expose, phải review `HTTPS/TLS 1.3`, WAF, rate limiting, request validation, authn/authz.
- Review phải có `scope`, `permission`, `ownership` cho ETA payload; không dừng ở source trust chung chung.
- Passenger/driver/admin/internal service phải có data visibility boundary rõ hoặc phải ghi `Missing evidence`.
- Có checklist riêng cho encryption at-rest, encryption in-transit, masking/minimization `live location/trip path/ETA payload`, retention/logging policy cho location.
- Realtime/WebSocket boundary phải review handshake auth, per-message authorization, replay/forgery protection, source provenance.
- Logging/audit/SIEM/alerting phải cover poisoned ETA input, cache poisoning, routing API abuse, location leak, ETA drift anomaly.
- Nếu ETA dùng historical average / feature store / model serving thì phải review AI/ML trust boundary.
- Có kế hoạch Redis TTL/invalidation hoặc evidence runtime tương đương.
- Có chính sách timeout/retry/circuit breaker cho routing API expected.
- Fallback historical average không bypass security hoặc làm rò location.
- ETA service boundary được xác định rõ nếu tách riêng.
- Không lộ routing API key hoặc live location không cần thiết.
- Mọi phần chưa có runtime evidence phải gắn `Expected by architecture`, `Missing evidence`, hoặc `Observed runtime differs from architecture`; không ghi PASS.

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

- Service runtime riêng cho ETA.
- Route/gateway path riêng cho ETA-serving nếu target architecture expose API.
- Scope/permission/ownership matrix cho actor nào được xem ETA và ở mức dữ liệu nào.
- Redis TTL/invalidation và cache poisoning guard.
- Routing/traffic API integration, secret handling, resilience policy.
- Encryption at-rest / in-transit evidence cho ETA-related data flow.
- Masking/minimization và retention/logging policy cho live location, trip path, ETA payload.
- Replay/forgery protection và provenance chain cho GPS/event input tới ETA.
- SIEM / alerting / audit evidence cho poisoned input, cache poisoning, location leak, ETA drift.
- Feature store / model serving authz và poisoning guard nếu ETA sẽ dùng AI/ML path.

### Fix Priority

- P0: forged/poisoned ETA input, live location leak, unauth ETA-serving path, missing ownership/scope/permission boundary cho ETA payload.
- P1: thiếu cache TTL/invalidation, fallback safety, timeout/circuit breaker, replay/forgery guard, retention/privacy controls.
- P2: topology/docs alignment, observability planning, AI/ML readiness controls chưa có runtime evidence.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/ride-service/src/services/eta.service.js`
   - `services/ride-service/src/services/location.service.js`
   - `services/ride-service/src/services/ride.service.js`
   - `services/ride-service/src/realtime/socket.js`
   - `services/ride-service/src/controllers/ride.controller.js`
   - `gateway/api-gateway/src/security/jwt-service.js`
   - `gateway/api-gateway/src/middleware/rate-limit.js`
   - `gateway/api-gateway/src/middleware/validation.js`
   - `gateway/api-gateway/src/realtime/hub.js`
   - `platform/architecture/ai-topology.js`
   - `platform/architecture/security-topology.js`
   - `platform/architecture/realtime-topology.js`
   - `data-layer/redis/geo-topology.json`
   - `platform/ml/feature-store-topology.json`
4. So sánh với checklist.
5. Với mỗi control, đánh dấu đúng một trạng thái:
   - `Implemented`
   - `Expected by architecture`
   - `Missing evidence`
   - `Observed runtime differs from architecture`
6. Không mô tả Redis/routing API/model-serving/TLS/WAF như thể runtime ETA đã có nếu repo chưa chứng minh.
7. Ghi findings theo template.

### AI Review Prompt

```text
Bạn là security reviewer cho expected eta-service của CAB-BOOKING.

Ưu tiên đọc:
- services/ride-service/src/services/eta.service.js
- services/ride-service/src/services/location.service.js
- services/ride-service/src/services/ride.service.js
- services/ride-service/src/realtime/socket.js
- services/ride-service/src/controllers/ride.controller.js
- gateway/api-gateway/src/realtime/hub.js
- gateway/api-gateway/src/security/jwt-service.js
- gateway/api-gateway/src/middleware/rate-limit.js
- gateway/api-gateway/src/middleware/validation.js
- platform/architecture/ai-topology.js
- platform/architecture/security-topology.js
- platform/architecture/realtime-topology.js
- data-layer/redis/geo-topology.json
- platform/ml/feature-store-topology.json

Tập trung bắt:
- forged event input
- poisoned ETA input
- external API key leak
- unsafe fallback historical average
- location leak
- cache poisoning
- thiếu trust boundary riêng cho ETA
- thiếu client/edge/gateway security cho ETA path
- thiếu scope/permission/ownership cho ETA payload
- thiếu data minimization/retention cho location và ETA
- thiếu realtime boundary control
- thiếu logging/SIEM/alerting cho ETA abuse và ETA drift
- thiếu AI/ML trust boundary nếu ETA đi theo feature/model path

Rules:
- Đây là expected architecture workflow; phải tách rõ:
  - `Observed runtime`: ETA hiện là module trong `ride-service`
  - `Target architecture`: ETA là service độc lập
- Mọi chỗ runtime khác kiến trúc đích phải ghi `Observed runtime differs from architecture`.
- Mọi control không có repo evidence phải ghi rõ là `Expected by architecture` hoặc `Missing evidence`.
- Chỉ PASS khi có evidence trong code/config/runtime artifact.

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

