# CAB-BOOKING Security Review Workflow ? WORKFLOW 11 — MATCHING-SERVICE

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

## 14. WORKFLOW 11 — MATCHING-SERVICE

### Service Security Context

- Business role: quản lý feature store, training pipeline, model serving API cho matching, surge pricing, ETA prediction.
- Security role: chặn dataset leak, poisoned training path, unauth model serving, secret leak, debug endpoint exposure.
- Inbound interfaces:
  - Observed runtime: chưa có service runtime riêng trong `services/`.
  - Evidence topology ở `platform/architecture/ai-topology.js`, `platform/ml/feature-store-topology.json`, `platform/node/ai-layer.js`.
  - Target architecture: feature store, model training, model serving API, admin/debug/model management path.
- Outbound dependencies: feature store, model training, model serving API, driver/booking/pricing data sources, trip history, ratings feedback.
- Dữ liệu nhạy cảm: GPS/location features, trip history, ratings, derived features, model artifacts, serving credentials.
- Observed in repo:
  - `platform/architecture/ai-topology.js`
  - `platform/ml/feature-store-topology.json`
  - `platform/node/ai-layer.js`
- Expected by CAB architecture:
  - feature store, training pipeline, serving API, dataset access control, inference auth, model lifecycle audit.
- Preliminary repo-backed concerns:
  - Observed runtime: đã có `AI-ML/matching-service/*` với FastAPI runtime, scheduler, model training, matching inference và feature ingestion.
  - Observed runtime differs from architecture: service hiện gom `feature store`, `training`, `matching inference` và background surge push vào cùng một runtime; `Model Serving API` vẫn chưa tách control plane riêng như sơ đồ đích.
  - Missing evidence: dataset access policy, secret handling, inference auth boundary, rollback control, model admin management.

### Runtime vs Architecture Boundary

- `Observed runtime`
  - `AI-ML/matching-service/*` là runtime FastAPI thật cho AI matching.
  - `platform/architecture/ai-topology.js`, `platform/ml/feature-store-topology.json`, `platform/node/ai-layer.js` vẫn là artifact mô tả scope AI/ML.
  - `AI-ML/matching-service/app/routers/features.py`, `AI-ML/matching-service/app/routers/training.py`, `AI-ML/matching-service/app/routers/matching.py` cho thấy feature ingestion, training và matching inference đã tồn tại.
- `Target architecture`
  - Feature Store
  - Model Training
  - Model Serving API
  - Dataset access control
  - Model publish / rollback / admin-debug-management
- `Observed runtime differs from architecture`
  - chưa có `Model Serving API` tách riêng cho toàn AI layer
  - ETA/Surge/Matching chưa tách thành các service/model-serving boundary độc lập hoàn toàn như sơ đồ AI/ML đích
  - chưa có model lifecycle control plane riêng

### Evidence Status Labels

- `Implemented`: control có evidence rõ trong code/config/test/runtime artifact của repo.
- `Expected by architecture`: control xuất hiện trong topology/doc kiến trúc nhưng chưa có runtime evidence đủ mạnh.
- `Missing evidence`: chưa có đủ artifact để kết luận control tồn tại hoặc hoạt động đúng.
- `Observed runtime differs from architecture`: runtime hiện tại đi khác kiến trúc đích; phải ghi thẳng chỗ lệch, không mô tả như implementation đã tồn tại.

### Trust Boundaries

- `Observed runtime`: architecture metadata -> `platform/node/ai-layer.js` response headers
- `Target architecture`: `booking/driver/pricing/review/trip data -> feature store`
- `Target architecture`: `feature store -> model training`
- `Target architecture`: `model training -> model serving API`
- `Target architecture`: `model serving API -> matching / ETA / surge consumers`
- `Target architecture`: `admin/debug/model management -> model platform`

### Attack Surface

- Feature ingestion path expected.
- Dataset storage and training path expected.
- Model serving API expected.
- Debug/admin/model lifecycle operations expected.
- Inference request/response and monitoring expected.
- Client/Edge và Gateway path cho serving/admin/debug nếu expose.
- Service-to-service inference calls giữa matching / ETA / pricing và model serving.
- Dataset export, feature read, model publish / rollback path.

### Files/Paths To Review First

- `platform/architecture/ai-topology.js`
- `platform/ml/feature-store-topology.json`
- `platform/node/ai-layer.js`
- `platform/architecture/security-topology.js`
- `platform/architecture/ai-machine-learning-architecture.mmd`
- `platform/architecture/security-zero-trust-architecture.mmd`
- `platform/architecture/service-manifests.js`
- `platform/architecture/topology.js`
- `platform/architecture/system-requirements.js`
- `gateway/api-gateway/src/security/jwt-service.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `gateway/api-gateway/docs/02-architecture.md`
- `gateway/api-gateway/docs/05-security-zero-trust.md`
- `gateway/api-gateway/docs/11-observability-tracing.md`
- `infra/docker-swarm/docker-stack.yml`
- `services/ride-service/src/services/eta.service.js`
- `services/pricing-service/src/controllers/pricingController.js`

### Step-by-step Review Workflow

1. Review data source trust boundary.
   - Đọc: `platform/architecture/ai-topology.js`, `platform/ml/feature-store-topology.json`
   - Kiểm tra: GPS/trip history/ratings có access control và minimization policy không.
   - `Expected by architecture`: feature store ingest `GPS / Location Data`, `Trip History`, `Ratings & Feedback` theo `platform/ml/feature-store-topology.json`.
   - `Missing evidence`: access control path, minimization policy, retention policy, dataset lineage runtime.
   - FAIL evidence: topology có data source nhưng không có policy/capability evidence.
2. Review observed runtime vs target architecture.
   - Đọc: `platform/architecture/ai-topology.js`, `platform/node/ai-layer.js`
   - Kiểm tra: ML platform có runtime boundary riêng hay mới dừng ở metadata/topology.
   - `Observed runtime`: hiện mới có architecture metadata và AI layer header exposure.
   - `Target architecture`: feature store, training, serving, model lifecycle operations là service/platform boundary riêng.
   - `Observed runtime differs from architecture`: chưa có runtime service để áp authz, service identity, lifecycle control.
3. Review Client / Edge / Gateway security cho model serving / admin / debug path.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/security/jwt-service.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/route-registry.js`
   - Kiểm tra:
     - `HTTPS/TLS 1.3`
     - WAF
     - rate limiting / quota
     - request validation
     - authn/authz qua gateway nếu serving API được expose
   - `Expected by architecture`: TLS 1.3, WAF, rate limiting/quota, validation, scope/role/permission checks có trong `security-topology.js`.
   - `Missing evidence`: chưa thấy serving/admin/debug route runtime qua gateway; chưa có quota hoặc policy riêng cho model serving path.
   - `Observed runtime differs from architecture`: chưa có gateway-exposed serving API thật để áp edge controls.
4. Review scope / role / permission chi tiết.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/security/jwt-service.js`, `platform/architecture/ai-topology.js`
   - Kiểm tra:
     - inference API
     - dataset access
     - feature store access
     - model training / publish / rollback
     - admin/debug/model management operations
   - `Implemented`: gateway JWT service có parse `scopes`, `permissions`, `role`.
   - `Expected by architecture`: gateway authz model có `scope`, `role`, `permission`.
   - `Missing evidence`: matrix authz chi tiết cho inference/dataset/feature store/training/publish/rollback/admin-debug chưa có runtime policy artifact.
5. Review model serving auth và service-to-service trust ở inference path.
   - Đọc: `platform/node/ai-layer.js`, `platform/architecture/security-topology.js`, `platform/architecture/ai-topology.js`
   - Kiểm tra:
     - inference API có authn/authz không
     - mTLS
     - service identity
     - authorization giữa matching / ETA / pricing và model serving API
   - `Expected by architecture`: `mTLS`, `service identity`, authenticated/authorized gateway pattern có trong `security-topology.js`; serving inference flow có trong `ai-topology.js`.
   - `Missing evidence`: chưa có runtime mTLS, service identity, or service-to-service authorization policy cho inference path.
   - `Observed runtime differs from architecture`: chưa có model serving API runtime để chứng minh inference trust boundary.
6. Review poisoning và data integrity.
   - Đọc: `platform/architecture/ai-topology.js`, upstream feature-producing services
   - Kiểm tra: forged GPS, corrupted trip history, spam review/rating có thể poison feature không.
   - `Expected by architecture`: feature ingestion / training / serving chain tồn tại trong topology AI/ML.
   - `Missing evidence`: feature provenance, schema validation, quarantine path, anomaly detection, poisoning guard runtime.
   - FAIL evidence: feature ingestion assumed trusted.
7. Review data security / privacy.
   - Đọc: `platform/architecture/security-topology.js`, `platform/ml/feature-store-topology.json`, `platform/architecture/ai-topology.js`
   - Kiểm tra:
     - encryption at-rest
     - encryption in-transit
     - masking/minimization cho `GPS/location features`, `trip history`, `ratings`, `derived features`, `model artifacts`
     - retention/access policy cho dataset và feature data
   - `Expected by architecture`: encryption `at-rest`, `in-transit`, masking có trong `security-topology.js`.
   - `Missing evidence`: runtime encryption config, dataset retention policy, feature access policy, artifact masking/minimization chưa thấy trong repo.
8. Review secret handling và debug exposure.
   - Đọc: `platform/node/ai-layer.js`, `platform/architecture/security-topology.js`
   - Kiểm tra: model registry credential, external provider/API secret, debug endpoint restriction.
   - `Missing evidence`: secret manager / key rotation / registry credential handling / admin-debug restriction chưa có runtime artifact rõ.
   - FAIL evidence: không có secret/debug control evidence.
9. Review logging / audit / SIEM / alerting.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/docs/11-observability-tracing.md`, `platform/architecture/ai-topology.js`
   - Kiểm tra:
     - dataset access
     - model publish / rollback
     - permission change
     - suspicious inference usage
     - poisoned data path / feature anomaly
   - `Expected by architecture`: audit/logging/SIEM/real-time alerting có trong `security-topology.js`.
   - `Missing evidence`: audit implementation cho dataset access, model publish/rollback, permission change, suspicious inference, poisoned feature path.
10. Review failure-mode security cho AI/ML.
   - Đọc: `platform/architecture/ai-topology.js`, `platform/architecture/security-topology.js`, `platform/node/ai-layer.js`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra:
     - serving down / timeout / retry
     - fallback path không bypass auth
     - rollback không mở abuse path
     - graceful degradation đúng với kiến trúc
   - `Expected by architecture`: resilience/fallback là phần của target serving architecture.
   - `Missing evidence`: timeout/retry/fallback/rollback security policy cho serving runtime chưa có artifact.
   - `Observed runtime differs from architecture`: chưa có serving runtime nên chưa chứng minh graceful degradation hay rollback security.

### PASS/FAIL Checklist

- Runtime vs architecture phải tách rõ:
  - `Observed runtime`
  - `Target architecture`
  - `Observed runtime differs from architecture`
- Model serving/admin/debug path qua gateway, nếu có expose, phải review `HTTPS/TLS 1.3`, WAF, rate limiting / quota, request validation, authn/authz.
- Inference API phải có `scope/role/permission` rõ.
- Dataset access không bị assume trusted vì nội bộ.
- Dataset access phải có `scope/role/permission` rõ.
- Feature store access phải có `scope/role/permission` rõ.
- Model training / publish / rollback phải có `scope/role/permission` rõ.
- Admin/debug/model management operations phải có `scope/role/permission` rõ.
- Feature ingestion có schema/provenance control.
- GPS/trip/review signals không đi thẳng vào training/inference mà không validation.
- Có checklist riêng cho encryption at-rest, encryption in-transit, masking/minimization `GPS/location features`, `trip history`, `ratings`, `derived features`, `model artifacts`.
- Có retention/access policy cho dataset và feature data.
- Service-to-service inference path phải review `mTLS`, `service identity`, authorization giữa matching / ETA / pricing và model serving API.
- Secret handling cho model platform có evidence.
- Debug/admin/model management path không public.
- Model lifecycle có audit requirement rõ.
- Logging/audit/SIEM/alerting phải cover dataset access, model publish/rollback, permission change, suspicious inference, poisoned data path / feature anomaly.
- Failure-mode security phải cover serving down / timeout / retry, fallback auth, rollback abuse path, graceful degradation.
- Những gì mới ở topology phải đánh dấu `Expected by architecture`, `Missing evidence`, hoặc `Observed runtime differs from architecture`; không được đánh dấu PASS.

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

- Runtime service/code cho model serving API.
- Runtime service/code cho feature store.
- Runtime service/code cho training / publish / rollback control plane.
- Dataset access control và audit implementation.
- Feature store access control implementation.
- Scope/role/permission matrix cho inference, dataset, feature store, training, publish, rollback, admin/debug.
- Secret manager / key rotation / registry credential handling.
- mTLS / service identity / service-to-service authorization cho inference path.
- Encryption at-rest / in-transit evidence cho dataset, feature, model artifact flows.
- Retention/access policy cho dataset và feature data.
- Logging/SIEM/alerting implementation cho suspicious inference và poisoned data path.
- Failure-mode security policy cho timeout/retry/fallback/rollback.

### Fix Priority

- P0: unauth model serving, feature/data leak, poisoned training path, debug endpoint exposure, missing scope/permission boundary cho model operations.
- P1: thiếu audit lifecycle, thiếu minimization, thiếu service identity/mTLS cho inference path, thiếu failure-mode security cho serving/fallback/rollback.
- P2: topology-to-runtime mapping, observability planning, dataset retention and access governance detail.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `platform/architecture/ai-topology.js`
   - `platform/ml/feature-store-topology.json`
   - `platform/node/ai-layer.js`
   - `platform/architecture/security-topology.js`
   - `platform/architecture/ai-machine-learning-architecture.mmd`
   - `platform/architecture/security-zero-trust-architecture.mmd`
   - `platform/architecture/system-requirements.js`
   - `gateway/api-gateway/src/security/jwt-service.js`
   - `gateway/api-gateway/src/middleware/rate-limit.js`
   - `gateway/api-gateway/src/middleware/validation.js`
   - `gateway/api-gateway/docs/05-security-zero-trust.md`
   - `gateway/api-gateway/docs/11-observability-tracing.md`
   - `infra/docker-swarm/docker-stack.yml`
4. So sánh với checklist.
5. Với mỗi control, đánh dấu đúng một trạng thái:
   - `Implemented`
   - `Expected by architecture`
   - `Missing evidence`
   - `Observed runtime differs from architecture`
6. Không mô tả serving/training/feature-store/admin-debug runtime như thể đã có nếu repo chưa chứng minh.
7. Ghi findings theo template.

### AI Review Prompt

```text
Bạn là security reviewer cho matching-service của CAB-BOOKING.

Ưu tiên đọc:
- platform/architecture/ai-topology.js
- platform/ml/feature-store-topology.json
- platform/node/ai-layer.js
- platform/architecture/security-topology.js
- platform/architecture/ai-machine-learning-architecture.mmd
- platform/architecture/security-zero-trust-architecture.mmd
- platform/architecture/system-requirements.js
- platform/architecture/topology.js
- gateway/api-gateway/src/security/jwt-service.js
- gateway/api-gateway/src/middleware/rate-limit.js
- gateway/api-gateway/src/middleware/validation.js
- gateway/api-gateway/docs/05-security-zero-trust.md
- gateway/api-gateway/docs/11-observability-tracing.md
- infra/docker-swarm/docker-stack.yml
- services/ride-service/src/services/eta.service.js
- services/pricing-service/src/controllers/pricingController.js

Tập trung bắt:
- model serving không auth
- data/feature leak
- poisoned data path
- secret leak
- debug endpoint exposure
- thiếu audit model lifecycle
- feature provenance không rõ
- thiếu client/edge/gateway security cho serving/admin/debug path
- thiếu scope/role/permission cho inference, dataset, feature store, training, publish, rollback, admin/debug
- thiếu data security/privacy cho dataset, feature, model artifact
- thiếu mTLS/service identity/service authz ở inference path
- thiếu logging/SIEM/alerting cho suspicious inference và poisoned data path
- thiếu failure-mode security cho serving/fallback/rollback

Rules:
- Đây là expected architecture workflow; phải tách rõ:
  - `Observed runtime`
  - `Target architecture`
  - `Observed runtime differs from architecture`
- Nếu repo chưa có runtime service thì ghi `Missing evidence` rõ ràng.
- Không assume AI/ML internal path là trusted.
- Chỉ PASS khi có evidence trong code/config/runtime artifact.
- Nếu chỉ có topology/doc thì ghi `Expected by architecture`.

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

