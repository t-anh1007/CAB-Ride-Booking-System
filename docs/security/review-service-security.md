# CAB-BOOKING Security Review Workflow ? WORKFLOW 07 — REVIEW-SERVICE

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

## 10. WORKFLOW 07 — REVIEW-SERVICE

### Service Security Context

- Business role: tạo review sau chuyến đi, xem review theo ride/driver, tính điểm trung bình, và có thể có moderation/admin/support actions nếu expose sau này.
- Security role: chặn fake review, duplicate review, stored XSS, unauthorized read, unauthorized aggregation, forged event, và moderation không audit.
- Inbound interfaces observed trong repo:
  - `POST /api/v1/reviews`
  - `GET /api/v1/reviews/ride/:rideId`
  - `GET /api/v1/reviews/driver/:driverId`
  - `GET /api/v1/reviews/driver/:driverId/average`
- Moderation/admin/support actions:
  - `Missing evidence`
  - Lý do: chưa thấy route moderation/admin/support trong `services/review-service/src/routes.js` hoặc policy riêng trong `gateway/api-gateway/src/route-registry.js`
- Outbound dependencies observed:
  - `review-service -> store` qua `services/review-service/src/store.js`
  - `review-service -> broker` có helper `publishReviewCreated`, nhưng chưa thấy publish thực sự qua broker API trong `services/review-service/src/routes.js`
  - `review-service -> trusted source để verify completed ride` là `Expected by architecture`, chưa thấy runtime call
- Dữ liệu nhạy cảm trong scope workflow này:
  - comment free-text
  - rating
  - quan hệ `rideId/userId/driverId`
  - review history
  - moderation log / abuse investigation log nếu có
- Observed in repo:
  - `services/review-service/src/routes.js`
  - `services/review-service/src/store.js`
  - `services/review-service/src/index.js`
- Expected by CAB architecture:
  - completed-ride eligibility từ trusted source
  - sanitize/masking cho comment
  - moderation audit
  - persistent database
- Preliminary repo-backed concerns:
  - Không thấy kiểm tra ride completed từ trusted source
  - Comment hiện lưu thẳng, chưa thấy sanitize/escape
  - Route create nhận trực tiếp `userId` và `driverId` từ body
  - Persistence đang là in-memory

### Trust Boundaries

- `Client -> Edge -> Gateway -> review-service`
- `Gateway -> review-service`
- `review-service -> trusted source verify completed ride`
- `review-service -> data store`
- `review-service -> broker`
- `review-service -> logging/audit/SIEM pipeline`

### Status Legend for This Workflow

- `Implemented`: có evidence trong code/config/runtime artifact trong repo.
- `Expected by architecture`: có trong architecture/topology, chưa thấy runtime implementation đủ mạnh.
- `Missing evidence`: chưa thấy evidence trong code/config/runtime artifact.
- `Observed runtime differs from architecture`: repo/runtime artifact hiện có dấu hiệu khác với architecture mong đợi.

### Files/Paths To Review First

- `services/review-service/src/routes.js`
- `services/review-service/src/store.js`
- `services/review-service/src/index.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/middleware/authorization.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `gateway/api-gateway/src/middleware/request-context.js`
- `gateway/api-gateway/src/validation-schemas.js`
- `platform/architecture/security-topology.js`
- `platform/architecture/security-zero-trust-architecture.mmd`
- `platform/architecture/service-manifests.js`
- `platform/architecture/event-contracts.js`
- `infra/docker-swarm/docker-stack.yml`

### Architecture Alignment Snapshot

| Control area | Status | Evidence | Review note |
| --- | --- | --- | --- |
| Edge `HTTPS/TLS 1.3` | `Expected by architecture` | `platform/architecture/security-topology.js`, `platform/architecture/security-zero-trust-architecture.mmd` | Chưa thấy ingress/TLS runtime artifact cho review paths |
| Edge `WAF` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chưa thấy WAF rule/config runtime |
| Gateway rate limit / validation | `Implemented` generic, `Missing evidence` cho review-specific policy | `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/route-registry.js` | Gateway có middleware chung, nhưng chưa có policy/schema riêng cho review endpoints |
| Gateway authn/authz | `Implemented` generic, `Missing evidence` cho scope/permission/ownership chi tiết | `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/route-registry.js`, `platform/architecture/security-topology.js` | Family `review-service` cho phép `Customer/Driver/Admin`, chưa thấy endpoint-specific policy |
| Review persistence | `Observed runtime differs from architecture` | `services/review-service/src/store.js`, `platform/architecture/service-manifests.js` | Manifest khai báo `postgresql`, nhưng runtime store hiện là in-memory `Map` |
| Completed-ride verification từ trusted source | `Expected by architecture` | `services/review-service/src/index.js`, Zero Trust docs | Code có comment “for future eligibility validation”, chưa thấy runtime implementation |
| Event `review.created` | `Observed runtime differs from architecture` | `services/review-service/src/routes.js`, `platform/architecture/event-contracts.js`, `platform/architecture/service-manifests.js` | Route có helper log `review.created`, nhưng event contract chưa khai báo và manifest `publishes: []` |
| mTLS / service identity | `Expected by architecture` | `platform/architecture/security-topology.js`, `platform/architecture/security-zero-trust-architecture.mmd` | `infra/docker-swarm/docker-stack.yml` chưa có mesh/mTLS evidence; dùng HTTP nội bộ |
| Centralized logging / SIEM | `Expected by architecture` | `platform/architecture/security-topology.js` | Gateway có request context/log, nhưng chưa thấy centralized logging/SIEM runtime artifact riêng cho review workflow |

### 10.1 Client / Edge / Gateway security on all review paths

Áp dụng cho:

- `POST /api/v1/reviews`
- `GET /api/v1/reviews/ride/:rideId`
- `GET /api/v1/reviews/driver/:driverId`
- `GET /api/v1/reviews/driver/:driverId/average`
- moderation/admin/support paths nếu có expose

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| `HTTPS/TLS 1.3` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có ingress/reverse proxy/runtime TLS artifact cho review path |
| `WAF` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có WAF config/rule binding runtime |
| rate limiting | `Implemented` generic, `Missing evidence` review-specific | `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/route-registry.js` | Chưa thấy policy riêng cho create/read/average review paths |
| quota | `Expected by architecture` | `platform/architecture/security-topology.js` | Chưa thấy quota artifact trong gateway/runtime |
| request validation | `Implemented` generic, `Missing evidence` review-specific | `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/validation-schemas.js` | Chưa có review schema trong `httpSchemas` |
| authn qua gateway | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Family `review-service` đang `authRequired: true` |
| authz qua gateway cho create/read/average/moderation | `Implemented` generic, `Missing evidence` chi tiết | `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/route-registry.js` | Chưa có endpoint-specific scope/role/permission/ownership policy |

### 10.2 Endpoint-by-endpoint authn / authz / ownership review

#### `POST /api/v1/reviews`

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Authentication required | `Implemented` qua gateway family rule | `gateway/api-gateway/src/route-registry.js` | Xác nhận request không auth bị reject ở gateway/runtime |
| Gateway role gate | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Allowed roles hiện là `Customer`, `Driver`, `Admin`; cần xác minh business intent |
| Scope check | `Missing evidence` | `platform/architecture/security-topology.js` nêu `scope`, nhưng gateway/runtime chưa có | Không được suy diễn scope đã enforce |
| Permission check | `Missing evidence` | `platform/architecture/security-topology.js` nêu `permission`, nhưng gateway/runtime chưa có | Không được coi role check là đủ |
| Ownership: actor có đúng là reviewer hay không | `Missing evidence` | `services/review-service/src/routes.js` | Route đang nhận `userId` từ body, chưa bind với `request.auth.userId` |
| Driver relation integrity | `Missing evidence` | `services/review-service/src/routes.js` | Route đang nhận `driverId` từ body, chưa cross-check với trusted ride record |
| Completed-ride eligibility | `Missing evidence` | `services/review-service/src/routes.js`, `services/review-service/src/index.js` | Không thấy verify ride đã completed từ trusted source |
| One-review-per-ride | `Implemented` có phần, nhưng chưa đủ Zero Trust | `services/review-service/src/store.js`, `services/review-service/src/routes.js` | Có `findExistingReview(rideId, userId)`, nhưng `userId` đi từ body nên vẫn có risk giả mạo identity |
| Rating validation `1..5` | `Implemented` | `services/review-service/src/routes.js` | Service validate integer 1..5 |
| Comment validation / length / content policy | `Missing evidence` | `services/review-service/src/routes.js`, `gateway/api-gateway/src/validation-schemas.js` | Chưa thấy schema, sanitize, hoặc moderation gate |

#### `GET /api/v1/reviews/ride/:rideId`

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Authentication required | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Review runtime reject anonymous access |
| Role check | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Hiện cho phép `Customer`, `Driver`, `Admin` qua family rule |
| Scope / permission check | `Missing evidence` | gateway/runtime chưa có control chi tiết | Không thấy `reviews:read` hay equivalent |
| Ownership theo ride | `Missing evidence` | `services/review-service/src/routes.js` | Chưa kiểm tra actor có thuộc ride đó hay là admin/support được phép |
| Visibility filtering | `Missing evidence` | `services/review-service/src/routes.js` | Route trả toàn bộ review theo `rideId`; chưa thấy redaction/visibility rule |

#### `GET /api/v1/reviews/driver/:driverId`

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Authentication required | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Review runtime reject anonymous access |
| Role check | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Family-level only |
| Scope / permission check | `Missing evidence` | gateway/runtime chưa có control chi tiết | Không thấy `reviews:read-driver` hay equivalent |
| Ownership / visibility | `Missing evidence` | `services/review-service/src/routes.js` | Chưa xác định ai được xem full comment list cho một driver |
| Minimization | `Missing evidence` | `services/review-service/src/routes.js`, `services/review-service/src/store.js` | Route trả cả `userId`, `rideId`, `comment`; chưa thấy masking/minimization |

#### `GET /api/v1/reviews/driver/:driverId/average`

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Authentication required | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Review runtime reject anonymous access |
| Role check | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Family-level only |
| Scope / permission check | `Missing evidence` | gateway/runtime chưa có control chi tiết | Không thấy policy riêng cho aggregate endpoint |
| Data minimization | `Implemented` cho response aggregate, `Missing evidence` cho expose policy | `services/review-service/src/routes.js` | Endpoint chỉ trả average + count, nhưng chưa thấy evidence path này nên public/internal/admin thế nào |

#### Moderation / admin / support actions

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Route existence | `Missing evidence` | `services/review-service/src/routes.js`, `gateway/api-gateway/src/route-registry.js` | Không thấy create/update/delete/hide/flag/moderate review endpoint |
| Scope / role / permission / ownership | `Missing evidence` | no runtime path | Nêu thẳng là chưa có evidence |
| Audit cho moderation decision | `Missing evidence` | no runtime path | Nêu thẳng là chưa có evidence |

### 10.3 Data security / privacy checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| encryption in-transit `client -> edge -> gateway` | `Expected by architecture` | `platform/architecture/security-topology.js` | Cần runtime TLS evidence; repo chưa có ingress/TLS config cho review workflow |
| encryption in-transit `gateway -> review-service` | `Observed runtime differs from architecture` | `infra/docker-swarm/docker-stack.yml`, `platform/architecture/security-topology.js` | Stack dùng `http://review-service:3106`, không thấy mTLS/internal TLS |
| encryption at-rest cho review data | `Expected by architecture` | `platform/architecture/security-topology.js`, `platform/architecture/service-manifests.js` | Chưa có persistent review DB implementation/config để verify |
| masking/minimization cho `comment` | `Missing evidence` | `services/review-service/src/routes.js`, `services/review-service/src/store.js` | Chưa thấy sanitize/redaction/content filtering |
| masking/minimization cho `rating` | `Missing evidence` | `services/review-service/src/routes.js` | Chưa thấy policy nào cho exposed granularity ngoài aggregate |
| masking/minimization cho quan hệ `ride/user/driver` | `Missing evidence` | `services/review-service/src/routes.js`, `services/review-service/src/store.js` | Response hiện trả raw IDs |
| retention policy cho review history | `Missing evidence` | no review persistence policy in repo | Không thấy TTL/retention/schema/purge job |
| retention policy cho moderation log | `Missing evidence` | no moderation runtime path | Không thấy |
| retention policy cho abuse investigation log | `Missing evidence` | no runtime artifact | Không thấy |

### 10.4 Service-to-service trust checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| mTLS giữa `review-service` và trusted source | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có mesh/cert/runtime config |
| service identity | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có SPIFFE/service account/cert identity hoặc equivalent |
| authorization cho internal eligibility check | `Missing evidence` | chưa thấy call/runtime path | Không thấy contract nào xác minh `review-service` được quyền hỏi trusted source |
| internal network trust-by-default | `Observed runtime differs from architecture` | `infra/docker-swarm/docker-stack.yml` | Stack hiện dùng network overlay + plain HTTP, không có identity-bound call protection evidence |

### 10.5 Event-driven security checklist

Áp dụng khi review `review.created` publish path, kể cả khi hiện tại path này chưa publish thật.

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| schema/envelope validation cho `review.created` | `Missing evidence` | `services/review-service/src/routes.js`, `platform/architecture/event-contracts.js` | Chưa có contract/schema cho `review.created` |
| replay protection | `Missing evidence` | no event id / dedupe / producer idempotency for review event | Non-blocking helper hiện không phải replay defense |
| topic allowlist | `Missing evidence` | `platform/architecture/event-contracts.js` | Topology hiện chưa khai báo `review.created` |
| forged-event impact | `Missing evidence` | no consumer/producer threat handling artifact | Cần ghi rõ chưa có evidence |
| event publish không bypass security check | `Missing evidence` | `services/review-service/src/routes.js` | Review create chưa verify completed ride/ownership trước khi gọi helper publish |
| broker transport security | `Observed runtime differs from architecture` | `infra/docker-swarm/docker-stack.yml`, `platform/architecture/security-topology.js` | Kafka listener `PLAINTEXT`, không có broker TLS/mTLS evidence |

### 10.6 Logging / audit / SIEM / alerting checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| audit create review | `Missing evidence` | `services/review-service/src/routes.js`, `services/review-service/src/store.js` | Có console error/log, nhưng không thấy audit trail immutable cho create |
| audit moderation action | `Missing evidence` | no moderation runtime path | Không thấy |
| audit visibility change | `Missing evidence` | no moderation/runtime path | Không thấy |
| centralized logging | `Expected by architecture` | `platform/architecture/security-topology.js` | Gateway có structured request log; chưa thấy centralized pipeline artifact |
| correlation/tracing fields | `Implemented` ở gateway, `Missing evidence` downstream propagation | `gateway/api-gateway/src/middleware/request-context.js`, `services/review-service/src/routes.js` | Gateway set `x-request-id` / `x-correlation-id`; review-service tự sinh UUID mới thay vì propagate request context |
| detection fake review storm | `Missing evidence` | no rule/alert/SIEM artifact | Không thấy |
| detection duplicate abuse | `Missing evidence` | no detection pipeline | `findExistingReview` không tạo alert/detection |
| detection XSS probing | `Missing evidence` | no WAF rule/log analytics/runtime detector | Không thấy |

### 10.7 Resilience security checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| trusted source verify completed ride unavailable thì xử lý thế nào | `Missing evidence` | chưa thấy integration/runtime path | Workflow phải coi đây là blocker cho create |
| degraded mode không cho tạo review khi chưa verify eligibility | `Missing evidence` | `services/review-service/src/routes.js` | Hiện create vẫn chấp nhận nếu body hợp lệ và chưa duplicate |
| retry/replay không bypass one-review-per-ride | `Missing evidence` | `services/review-service/src/store.js`, `gateway/api-gateway/src/route-registry.js` | Chưa thấy gateway idempotency cho review create; duplicate check dựa vào userId từ body |
| graceful degradation vẫn giữ integrity | `Missing evidence` | no resilience guard for trusted-source failure | Không được assume eventual consistency là an toàn |

### Step-by-step Review Workflow

1. Review `Client -> Edge -> Gateway` controls cho tất cả review paths.
   - Đọc: `platform/architecture/security-topology.js`, `platform/architecture/security-zero-trust-architecture.mmd`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `infra/docker-swarm/docker-stack.yml`
   - Ghi riêng từng control: `HTTPS/TLS 1.3`, `WAF`, `rate limiting`, `quota`, `request validation`, `authn/authz`.
   - Nếu chỉ thấy architecture doc thì ghi `Expected by architecture`.
   - Nếu gateway có middleware chung nhưng review path chưa có policy/schema riêng thì ghi `Missing evidence`, không ghi `Implemented`.
2. Review `POST /api/v1/reviews` theo chuỗi `scope -> role -> permission -> ownership -> eligibility`.
   - Đọc: `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/authorization.js`, `services/review-service/src/routes.js`, `services/review-service/src/store.js`
   - Bắt buộc trả lời:
     - actor có authenticated không
     - actor role nào được create review
     - có scope/permission chi tiết không
     - `userId` có bind với identity thật không
     - `driverId`/`rideId` có được xác minh từ trusted source không
     - ride completed có được verify không
3. Review các read paths `GET /ride/:rideId`, `GET /driver/:driverId`, `GET /driver/:driverId/average`.
   - Đọc: `services/review-service/src/routes.js`, gateway authz files, validation files
   - Bắt buộc check:
     - ai được đọc theo ride
     - ai được đọc full review list theo driver
     - ai được đọc aggregate
     - có minimization/masking/redaction không
4. Review data security/privacy.
   - Đọc: `services/review-service/src/routes.js`, `services/review-service/src/store.js`, `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`
   - Bắt buộc ghi rõ:
     - encryption at-rest
     - encryption in-transit
     - masking/minimization cho comment/rating/ride-user-driver relation
     - retention cho review history / moderation log / abuse investigation log
5. Review service-to-service trust cho eligibility verification.
   - Đọc: `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`, runtime integration code nếu có
   - Bắt buộc check:
     - mTLS
     - service identity
     - internal authorization
     - internal call có trust-by-network hay không
6. Review event-driven security cho `review.created`.
   - Đọc: `services/review-service/src/routes.js`, `platform/architecture/event-contracts.js`, `platform/architecture/service-manifests.js`, `infra/docker-swarm/docker-stack.yml`
   - Bắt buộc check:
     - schema/envelope validation
     - replay protection
     - topic allowlist
     - forged-event impact
     - publish có bypass security check không
7. Review logging/audit/SIEM/alerting.
   - Đọc: `gateway/api-gateway/src/middleware/request-context.js`, review-service logging path, security topology
   - Bắt buộc ghi rõ:
     - audit create
     - audit moderation
     - audit visibility change
     - centralized logging
     - correlation/tracing fields
     - detection fake review storm / duplicate abuse / XSS probing
8. Review resilience security.
   - Đọc: `services/review-service/src/routes.js`, `services/review-service/src/index.js`, `platform/architecture/resilience-topology.js` nếu liên quan
   - Bắt buộc check:
     - trusted source unavailable thì create review xử lý ra sao
     - degraded mode có fail-closed không
     - retry/replay có bypass one-review-per-ride không
     - graceful degradation có giữ integrity không

### PASS/FAIL Checklist

- `POST /api/v1/reviews`
  - `Implemented`: authn generic qua gateway family path
  - `Missing evidence`: scope/permission chi tiết
  - `Missing evidence`: ownership bind `request.auth.userId == review.userId`
  - `Missing evidence`: verify completed ride từ trusted source
  - `Implemented`: rating integer `1..5`
  - `Implemented` có phần, nhưng chưa đủ: one-review-per-user-per-ride vì duplicate check dựa trên `userId` từ body
  - `Missing evidence`: sanitize/escape/masking comment
  - `Missing evidence`: idempotency/replay defense tại gateway hoặc service
- `GET /api/v1/reviews/ride/:rideId`
  - `Implemented`: authn generic qua gateway family path
  - `Missing evidence`: role/scope/permission endpoint-specific
  - `Missing evidence`: ownership/visibility policy theo ride
  - `Missing evidence`: minimization/redaction response
- `GET /api/v1/reviews/driver/:driverId`
  - `Implemented`: authn generic qua gateway family path
  - `Missing evidence`: role/scope/permission endpoint-specific
  - `Missing evidence`: full-comment visibility policy
  - `Missing evidence`: masking `rideId/userId/comment`
- `GET /api/v1/reviews/driver/:driverId/average`
  - `Implemented`: authn generic qua gateway family path
  - `Missing evidence`: endpoint-specific scope/permission
  - `Implemented`: response aggregate giảm exposure hơn full list
  - `Missing evidence`: expose policy cho aggregate endpoint
- Moderation/admin/support
  - `Missing evidence`: route
  - `Missing evidence`: authz model
  - `Missing evidence`: audit trail
- Cross-cutting
  - `Expected by architecture`: `HTTPS/TLS 1.3`, `WAF`, `quota`, `mTLS`, `service identity`, `encryption at-rest`, `centralized logging`, `SIEM`
  - `Observed runtime differs from architecture`: review persistence vì manifest nêu `postgresql` nhưng runtime store là in-memory
  - `Observed runtime differs from architecture`: internal transport/broker transport chưa khớp mTLS/encrypted trust model do Swarm dùng plain HTTP và Kafka `PLAINTEXT`

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

- Evidence completed-ride check từ ride-service hoặc trusted read model.
- Evidence sanitize/escape comment.
- Evidence moderation/audit flow.

### Fix Priority

- P0: fake review, duplicate review bypass, stored XSS.
- P1: missing completed-ride validation, thiếu moderation audit.
- P2: persistence hardening, observability, docs cleanup.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/review-service/src/routes.js`
   - `services/review-service/src/store.js`
   - `services/review-service/src/index.js`
4. So sánh với checklist.
5. Ghi findings theo template.

### AI Review Prompt

```text
Bạn là security reviewer cho review-service của CAB-BOOKING.

Ưu tiên đọc:
- services/review-service/src/routes.js
- services/review-service/src/store.js
- services/review-service/src/index.js
- platform/architecture/service-manifests.js

Tập trung bắt:
- fake review
- duplicate review
- stored XSS
- missing completed-ride validation
- moderation thiếu audit
- in-memory persistence risk

Rules:
- Không assume ride đã completed nếu service không tự kiểm tra.
- Không assume free-text comment an toàn nếu không thấy sanitize.

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

