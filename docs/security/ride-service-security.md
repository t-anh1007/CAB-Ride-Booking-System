# CAB-BOOKING Security Review Workflow ? WORKFLOW 08 — RIDE-SERVICE

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

## 11. WORKFLOW 08 — RIDE-SERVICE

### Service Security Context

- Business role: quản lý lifecycle chuyến đi, driver assignment, realtime GPS update, ETA nội bộ, ride history, ride tracking và realtime subscription.
- Security role: bảo vệ state transition, ownership passenger/driver, GPS integrity, WebSocket auth, Redis Geo/event safety, và chống leak ride tracking.
- Inbound HTTP interfaces observed trong repo:
  - `POST /api/v1/rides`
  - `GET /api/v1/rides/stats`
  - `GET /api/v1/rides/user/:userId`
  - `GET /api/v1/rides/:rideId`
  - `POST /api/v1/rides/:rideId/assign-driver`
  - `POST /api/v1/rides/:rideId/location`
  - `POST /api/v1/rides/:rideId/start`
  - `POST /api/v1/rides/:rideId/complete`
  - `POST /api/v1/rides/:rideId/cancel`
  - `GET /api/v1/users/:userId/rides`
- Inbound WebSocket paths observed:
  - gateway realtime hub tại `gateway/api-gateway/src/realtime/hub.js` với endpoint `/realtime`
  - direct WebSocket server trong `services/ride-service/src/realtime/socket.js`
  - message types observed:
    - gateway: `driver.location.update`
    - ride-service direct socket: `driver_register`, `driver_location`, `ride_subscribe`, `ride_unsubscribe`
- Admin/support override actions:
  - `Missing evidence`
  - Lý do: chưa thấy route override riêng trong `services/ride-service/src/routes/ride.routes.js`, `services/ride-service/src/controllers/ride.controller.js`, hoặc policy riêng trong `gateway/api-gateway/src/route-registry.js`
- Outbound dependencies observed:
  - `ride-service -> MongoDB` khi `isMongoConnected()` trả true
  - `ride-service -> in-memory Map fallback` khi Mongo không available
  - `ride-service -> location in-memory store` trong `services/ride-service/src/services/location.service.js`
  - `ride-service -> Redis Geo` là `Expected by architecture` theo `data-layer/redis/geo-topology.json`, chưa thấy runtime writer thực
  - `ride-service -> Kafka ride.status.changed` là `Expected by architecture` theo `platform/architecture/event-contracts.js` và `message-broker/kafka/topology.json`, chưa thấy producer runtime thực
  - `ride-service -> ETA path` qua `services/ride-service/src/services/eta.service.js`
  - `ride-service -> monitoring consumers` là `Expected by architecture`, chưa thấy runtime artifact
- Dữ liệu nhạy cảm trong scope workflow này:
  - ride ownership
  - `driverId`
  - live location
  - ETA
  - tracking payload
  - lifecycle mutation
  - location history / ride tracking log / audit trail nếu có
- Observed in repo:
  - `services/ride-service/src/controllers/ride.controller.js`
  - `services/ride-service/src/services/ride.service.js`
  - `services/ride-service/src/services/location.service.js`
  - `services/ride-service/src/realtime/socket.js`
  - `services/ride-service/src/models/ride.model.js`
  - `services/ride-service/index.js`
  - `gateway/api-gateway/src/realtime/hub.js`
  - `gateway/api-gateway/src/security/abac.js`
- Expected by CAB architecture:
  - driver chỉ update GPS khi ride `ACTIVE`
  - WebSocket auth qua gateway
  - Redis Geo primary writer là `ride-service`
  - event publish `ride.status.changed`
  - mTLS + service identity cho trust nội bộ
- Preliminary repo-backed concerns:
  - service logic hiện cho update location ở `DRIVER_ASSIGNED` và `DRIVER_ARRIVING`
  - gateway ABAC yêu cầu ride status `ACTIVE`
  - ride-service có WebSocket server riêng chưa thấy JWT handshake, rate limit, hoặc subscription ownership
  - controller/service nhận trực tiếp `userId`/`driverId` từ body/path
  - Redis/Kafka integration trong code service còn thiếu bằng chứng mạnh

### Trust Boundaries

- `Client -> Edge -> Gateway -> ride-service`
- `Client -> Gateway WebSocket -> realtime hub`
- `Client -> direct ride-service WebSocket` nếu bị expose
- `ride-service -> MongoDB`
- `ride-service -> Redis Geo`
- `ride-service -> Kafka producer`
- `ride-service -> ETA path`
- `ride-service -> monitoring consumers / log pipeline`

### Status Legend for This Workflow

- `Implemented`: có evidence trong code/config/runtime artifact trong repo.
- `Expected by architecture`: có trong architecture/topology, chưa thấy runtime implementation đủ mạnh.
- `Missing evidence`: chưa thấy evidence trong code/config/runtime artifact.
- `Observed runtime differs from architecture`: repo/runtime artifact hiện có dấu hiệu khác với architecture mong đợi.
- `Security inconsistency`: có evidence cho thấy hai lớp control đang enforce khác nhau và tạo security ambiguity hoặc bypass risk.

### Files/Paths To Review First

- `services/ride-service/index.js`
- `services/ride-service/src/app.js`
- `services/ride-service/src/routes/ride.routes.js`
- `services/ride-service/src/controllers/ride.controller.js`
- `services/ride-service/src/services/ride.service.js`
- `services/ride-service/src/services/location.service.js`
- `services/ride-service/src/services/eta.service.js`
- `services/ride-service/src/realtime/socket.js`
- `services/ride-service/src/models/ride.model.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/middleware/authorization.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `gateway/api-gateway/src/middleware/request-context.js`
- `gateway/api-gateway/src/realtime/hub.js`
- `gateway/api-gateway/src/security/abac.js`
- `gateway/api-gateway/src/validation-schemas.js`
- `platform/architecture/security-topology.js`
- `platform/architecture/realtime-topology.js`
- `platform/architecture/service-manifests.js`
- `platform/architecture/event-contracts.js`
- `data-layer/redis/geo-topology.json`
- `message-broker/kafka/topology.json`
- `infra/docker-swarm/docker-stack.yml`

### Architecture Alignment Snapshot

| Control area | Status | Evidence | Review note |
| --- | --- | --- | --- |
| Edge `HTTPS/TLS 1.3` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chưa thấy ingress/TLS runtime artifact cho ride HTTP/WS paths |
| Edge `WAF` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chưa thấy WAF config/rule runtime |
| Gateway HTTP authn/authz | `Implemented` generic, `Missing evidence` ride-specific | `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/authorization.js` | Family `ride-service` có authRequired và role gate chung, chưa có policy riêng cho từng ride action |
| Gateway HTTP rate limit / validation / quota | `Implemented` generic, `Missing evidence` ride-specific | `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/validation-schemas.js` | Chưa có ride HTTP schema/rate/quota policy riêng |
| Gateway WebSocket handshake auth | `Implemented` | `gateway/api-gateway/src/realtime/hub.js` | Hub verify JWT khi upgrade |
| Gateway WebSocket per-message authz | `Implemented` cho `driver.location.update` tại gateway hub | `gateway/api-gateway/src/realtime/hub.js`, `gateway/api-gateway/src/security/abac.js` | Chỉ cover message type gateway hub đang parse |
| Direct ride-service WebSocket exposure | `Observed runtime differs from architecture` | `services/ride-service/index.js`, `services/ride-service/src/realtime/socket.js`, `infra/docker-swarm/docker-stack.yml` | Service khởi tạo direct WebSocket server trên cùng HTTP server; stack không publish port trực tiếp nhưng code/runtime path vẫn tồn tại |
| GPS ABAC rule | `Security inconsistency` | `gateway/api-gateway/src/security/abac.js`, `services/ride-service/src/services/ride.service.js`, `services/ride-service/src/models/ride.model.js` | Gateway yêu cầu `ACTIVE`, service cho update ở `DRIVER_ASSIGNED` / `DRIVER_ARRIVING` / `IN_PROGRESS`; enum service không có `ACTIVE` |
| Redis Geo primary writer | `Expected by architecture` | `data-layer/redis/geo-topology.json`, `platform/architecture/realtime-topology.js` | Chưa thấy Redis writer runtime thực |
| Kafka `ride.status.changed` producer | `Expected by architecture` | `platform/architecture/event-contracts.js`, `message-broker/kafka/topology.json`, `platform/architecture/service-manifests.js` | Chưa thấy runtime producer |
| Location / ride fallback storage | `Observed runtime differs from architecture` | `services/ride-service/src/services/location.service.js`, `services/ride-service/src/services/ride.service.js`, `platform/architecture/realtime-topology.js` | Runtime hiện dùng in-memory fallback thay vì Redis Geo primary path |

### 11.1 Client / Edge / Gateway security on all ride paths

Áp dụng cho:

- toàn bộ HTTP ride paths
- gateway WebSocket `/realtime`
- direct ride-service WebSocket nếu có thể bị expose
- polling/fallback paths nếu có

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| `HTTPS/TLS 1.3` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có ingress/runtime TLS artifact cho HTTP và WebSocket |
| `WAF` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có WAF config/rule binding runtime |
| rate limiting | `Implemented` generic, `Missing evidence` ride-specific | `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/realtime/hub.js`, `gateway/api-gateway/src/route-registry.js` | Gateway hub có WS rate limit cho `driver.location.update`; HTTP ride paths chưa thấy policy riêng |
| quota | `Expected by architecture` | `platform/architecture/security-topology.js` | Chưa thấy quota artifact cho ride HTTP/WS |
| request validation | `Implemented` generic, `Missing evidence` ride-specific | `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/validation-schemas.js` | Gateway có validation middleware và WS schema cho driver location; chưa có ride HTTP schema |
| authn qua gateway cho HTTP | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Family `ride-service` đang `authRequired: true` |
| authz qua gateway cho HTTP | `Implemented` generic, `Missing evidence` chi tiết | `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/route-registry.js` | Chưa có scope/permission/ownership từng ride action |
| authn qua gateway cho WebSocket | `Implemented` | `gateway/api-gateway/src/realtime/hub.js` | Hub verify JWT token ở handshake |
| authz qua gateway cho WebSocket | `Implemented` cho GPS update, `Missing evidence` cho subscribe/unsubscribe qua gateway | `gateway/api-gateway/src/realtime/hub.js`, `gateway/api-gateway/src/security/abac.js` | Hub hiện không xử lý ride subscribe/unsubscribe flow như direct service WS |

### 11.2 Endpoint-by-endpoint scope / role / permission / ownership review

#### Create ride `POST /api/v1/rides`

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Authentication required | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Request không auth phải bị reject ở gateway/runtime |
| Role gate | `Implemented` generic | `gateway/api-gateway/src/route-registry.js` | Family `ride-service` cho phép `Customer`, `Driver`, `Admin`; cần xác minh business intent |
| Scope / permission check | `Missing evidence` | gateway/runtime chưa có control chi tiết | Không thấy `rides:create` hay equivalent |
| Ownership of `userId` | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `services/ride-service/src/services/ride.service.js` | Controller nhận `userId` từ body; chưa bind với auth context |
| Driver pre-assignment integrity | `Missing evidence` | same files | `driverId` có thể đi từ body khi create, chưa thấy trusted source verify |
| Request validation | `Missing evidence` | `gateway/api-gateway/src/validation-schemas.js`, `services/ride-service/src/controllers/ride.controller.js` | Chưa có gateway schema ride create; service chỉ check field presence |

#### Get ride / get user rides / stats

| Path | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| `GET /api/v1/rides/:rideId` ownership | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `services/ride-service/src/services/ride.service.js` | Chưa check actor có thuộc ride đó hay admin/support được phép |
| `GET /api/v1/rides/user/:userId` ownership | `Missing evidence` | same files | Path dựa vào `userId` param; chưa bind với actor identity |
| `GET /api/v1/users/:userId/rides` ownership | `Missing evidence` | `services/ride-service/src/app.js`, `services/ride-service/src/controllers/ride.controller.js` | Duplicate read path, chưa có ownership guard |
| `GET /api/v1/rides/stats` role/scope | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `gateway/api-gateway/src/route-registry.js` | Family role gate cho phép cả `Customer` và `Driver`; chưa thấy stats-specific restriction |
| Minimization for read responses | `Missing evidence` | `services/ride-service/src/models/ride.model.js` | Response trả raw `userId`, `driverId`, `currentLocation`, `etaMinutes` |

#### Assign-driver `POST /api/v1/rides/:rideId/assign-driver`

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Role / permission check | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `gateway/api-gateway/src/route-registry.js` | Chưa thấy chỉ admin/dispatcher/service được assign |
| Ownership / dispatch authority | `Missing evidence` | same files | Chưa thấy trusted source xác minh ai được assign driver |
| State guard | `Implemented` | `services/ride-service/src/services/ride.service.js` | Chỉ cho assign khi `SEARCHING` |
| Driver identity integrity | `Missing evidence` | controller/service files | `driverId` nhận từ body, chưa thấy validate với trusted driver source |

#### Start / complete / cancel

| Action | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| `POST /:rideId/start` role/scope/permission | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `gateway/api-gateway/src/route-registry.js` | Chưa có gateway/service authz chi tiết |
| `POST /:rideId/start` ownership | `Missing evidence` | controller/service files | `driverId` nhận từ body; service chỉ match với ride.driverId |
| `POST /:rideId/start` state guard | `Implemented` | `services/ride-service/src/services/ride.service.js` | Chỉ cho start từ `DRIVER_ASSIGNED` hoặc `DRIVER_ARRIVING` |
| `POST /:rideId/complete` role/scope/permission | `Missing evidence` | same files | Chưa thấy endpoint-specific policy |
| `POST /:rideId/complete` ownership | `Missing evidence` | same files | `driverId` nhận từ body |
| `POST /:rideId/complete` state guard | `Implemented` | `services/ride-service/src/services/ride.service.js` | Chỉ cho complete từ `IN_PROGRESS` |
| `POST /:rideId/cancel` role/scope/permission | `Missing evidence` | same files | Chưa thấy policy rõ cho customer/driver/admin/support |
| `POST /:rideId/cancel` ownership | `Implemented` có phần, nhưng chưa đủ Zero Trust | `services/ride-service/src/services/ride.service.js` | Service check `ride.userId === userId` hoặc `ride.driverId === driverId`, nhưng identity vẫn đi từ body |
| `POST /:rideId/cancel` reason/audit handling | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `services/ride-service/src/services/ride.service.js` | Có nhận `reason`, nhưng chưa thấy audit/log retention |

#### Ride subscription / unsubscription

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Gateway subscription path | `Missing evidence` | `gateway/api-gateway/src/realtime/hub.js` | Hub chưa có ride subscribe/unsubscribe flow tương đương direct service WS |
| Direct service `ride_subscribe` ownership | `Missing evidence` | `services/ride-service/src/realtime/socket.js` | Subscribe chỉ cần `rideId`, chưa có auth/ownership check |
| Direct service `ride_unsubscribe` auth | `Missing evidence` | same file | Unsubscribe không check identity |
| Subscription visibility | `Missing evidence` | same file | Chưa giới hạn ai được nhận tracking của ride nào |

#### Driver GPS update

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Gateway WS handshake auth | `Implemented` | `gateway/api-gateway/src/realtime/hub.js` | JWT verified at upgrade |
| Gateway WS per-message authz | `Implemented` | `gateway/api-gateway/src/realtime/hub.js`, `gateway/api-gateway/src/security/abac.js` | Driver only + ride status check tại gateway hub |
| Direct service WS auth | `Missing evidence` | `services/ride-service/src/realtime/socket.js` | `driver_register` chỉ cần gửi `driverId` |
| Direct service per-message authorization | `Missing evidence` | same file | Không có JWT, scope, permission, replay guard |
| GPS ownership | `Implemented` có phần, nhưng chưa đủ Zero Trust | `services/ride-service/src/services/ride.service.js`, `services/ride-service/src/realtime/socket.js` | Service check `ride.driverId === driverId`, nhưng `driverId` nguồn direct WS/body chưa được authenticate |
| GPS ABAC rule | `Security inconsistency` | `gateway/api-gateway/src/security/abac.js`, `services/ride-service/src/services/ride.service.js` | Gateway yêu cầu `ACTIVE`, service cho update tại `DRIVER_ASSIGNED` / `DRIVER_ARRIVING` / `IN_PROGRESS` |

#### Admin / support override

| Control | Status | Evidence | What reviewer must verify |
| --- | --- | --- | --- |
| Route existence | `Missing evidence` | `services/ride-service/src/routes/ride.routes.js`, `gateway/api-gateway/src/route-registry.js` | Không thấy override path |
| Scope / role / permission / ownership | `Missing evidence` | no runtime path | Nêu thẳng là chưa có evidence |
| Audit trail | `Missing evidence` | no runtime path | Nêu thẳng là chưa có evidence |

### 11.3 Data security / privacy checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| encryption at-rest | `Expected by architecture` | `platform/architecture/security-topology.js`, `platform/architecture/service-manifests.js` | Chưa thấy ride-specific storage encryption artifact |
| encryption in-transit `client -> edge -> gateway` | `Expected by architecture` | `platform/architecture/security-topology.js` | Chưa thấy ingress/runtime TLS config |
| encryption in-transit `gateway -> ride-service` | `Observed runtime differs from architecture` | `infra/docker-swarm/docker-stack.yml`, `platform/architecture/security-topology.js` | Stack dùng `http://ride-service:3109`, không thấy mTLS/internal TLS |
| masking/minimization cho live location | `Missing evidence` | `services/ride-service/src/models/ride.model.js`, `services/ride-service/src/controllers/ride.controller.js` | Response trả `currentLocation` raw |
| masking/minimization cho ETA | `Missing evidence` | same files | Chưa thấy policy nào cho exposure ETA |
| masking/minimization cho `driverId` | `Missing evidence` | same files | Response trả raw `driverId` |
| masking/minimization cho ride ownership | `Missing evidence` | same files | Response trả raw `userId` và full ride object |
| masking/minimization cho tracking payload | `Missing evidence` | `services/ride-service/src/realtime/socket.js`, `gateway/api-gateway/src/realtime/hub.js` | Chưa thấy redaction/filtering trước khi push tracking data |
| retention policy cho location history | `Missing evidence` | `services/ride-service/src/services/location.service.js` | `getLocationHistory` chỉ trả current location; chưa có retention policy |
| retention policy cho ride tracking log | `Missing evidence` | no runtime artifact | Không thấy |
| retention policy cho audit trail | `Missing evidence` | no runtime artifact | Không thấy |

### 11.4 Service-to-service trust checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| mTLS | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có mesh/cert/runtime config |
| service identity | `Expected by architecture` | `platform/architecture/security-topology.js` | Chỉ đánh `Implemented` khi có identity-bound internal call evidence |
| authorization giữa gateway và ride-service | `Missing evidence` | `gateway/api-gateway/src/route-registry.js`, `infra/docker-swarm/docker-stack.yml` | Có proxy HTTP nội bộ, nhưng chưa thấy signed internal identity hoặc downstream verification |
| trust boundary tới Redis Geo | `Expected by architecture` | `data-layer/redis/geo-topology.json`, `platform/architecture/realtime-topology.js` | Chưa thấy runtime authz/ACL/writer implementation |
| trust boundary tới Kafka producer | `Expected by architecture` | `platform/architecture/event-contracts.js`, `message-broker/kafka/topology.json` | Chưa thấy runtime producer/authz path |
| trust boundary tới ETA path | `Missing evidence` | `services/ride-service/src/services/eta.service.js` | Chưa thấy authz/trust gating nếu ETA source sau này đi external/internal service |
| trust boundary tới monitoring consumers | `Missing evidence` | no runtime consumer contract | Không thấy |
| internal network trust-by-default | `Observed runtime differs from architecture` | `infra/docker-swarm/docker-stack.yml` | Overlay network + plain HTTP + Kafka `PLAINTEXT` |

### 11.5 Event-driven security checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| schema/envelope validation cho `driver.location.updated` | `Expected by architecture` ở topology, `Missing evidence` runtime producer path | `platform/architecture/event-contracts.js`, `message-broker/kafka/topology.json`, `platform/architecture/realtime-topology.js` | Chưa thấy ride-service emit event này; runtime schema/envelope chưa có |
| schema/envelope validation cho `ride.status.changed` | `Expected by architecture` ở topology, `Missing evidence` runtime producer path | same sources | Chưa thấy runtime producer hoặc schema validation |
| replay protection | `Missing evidence` | no producer idempotency/event dedupe artifact | Không thấy event replay guard |
| topic allowlist | `Expected by architecture` | `platform/architecture/event-contracts.js`, `message-broker/kafka/topology.json` | Chỉ có topology; chưa thấy runtime allowlist enforcement |
| forged-event impact | `Missing evidence` | no consumer/producer threat handling artifact | Không thấy |
| correlation giữa HTTP/WS input và emitted event | `Missing evidence` | `services/ride-service/src/controllers/ride.controller.js`, `services/ride-service/src/realtime/socket.js`, `gateway/api-gateway/src/middleware/request-context.js` | Controller tự sinh `requestId`; service WS/direct WS không propagate correlation vào event path |

### 11.6 WebSocket security checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| handshake auth tại gateway hub | `Implemented` | `gateway/api-gateway/src/realtime/hub.js` | JWT verified at upgrade |
| handshake auth tại direct service WS | `Missing evidence` | `services/ride-service/src/realtime/socket.js` | Connection accepted không auth |
| per-message authorization tại gateway hub | `Implemented` cho `driver.location.update` | `gateway/api-gateway/src/realtime/hub.js`, `gateway/api-gateway/src/security/abac.js` | Chỉ cover GPS message type |
| per-message authorization tại direct service WS | `Missing evidence` | `services/ride-service/src/realtime/socket.js` | Không có scope/permission/ownership per message |
| subscription ownership | `Missing evidence` | same file | `ride_subscribe` chỉ check ride exists |
| replay / forgery protection | `Missing evidence` | gateway hub và direct service WS | Gateway hub có rate limit nhưng chưa thấy nonce/replay guard; direct WS không có |
| direct service WebSocket exposure assessment | `Observed runtime differs from architecture` | `services/ride-service/index.js`, `services/ride-service/src/realtime/socket.js`, `infra/docker-swarm/docker-stack.yml` | Code bật direct WS server; stack không publish port riêng nhưng path vẫn tồn tại nội bộ |
| rate limiting / abuse control | `Implemented` tại gateway hub cho GPS, `Missing evidence` nơi khác | `gateway/api-gateway/src/realtime/hub.js`, `services/ride-service/src/realtime/socket.js` | Direct WS không rate limit; subscribe/unsubscribe cũng không rate limit |

### 11.7 Logging / audit / SIEM / alerting checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| audit lifecycle mutation | `Missing evidence` | `services/ride-service/src/services/ride.service.js`, `services/ride-service/src/controllers/ride.controller.js` | Có state mutation nhưng chưa thấy audit trail immutable |
| audit sensitive driver/passenger action | `Missing evidence` | same files | Create/cancel/start/complete/location update chưa thấy audit path |
| centralized logging | `Expected by architecture` | `platform/architecture/security-topology.js` | Service hiện chỉ console log/request log local |
| correlation/tracing fields | `Implemented` ở gateway, `Missing evidence` downstream propagation | `gateway/api-gateway/src/middleware/request-context.js`, `services/ride-service/src/controllers/ride.controller.js`, `services/ride-service/src/realtime/socket.js` | Controller tự sinh requestId mới; direct WS không có correlation model |
| detection forged GPS | `Missing evidence` | no SIEM/alert/runtime detector | Không thấy |
| detection anomalous location jump | `Missing evidence` | `services/ride-service/src/services/location.service.js` | Chỉ validate range lat/lng, không có anomaly detection |
| detection unauthorized subscribe | `Missing evidence` | `services/ride-service/src/realtime/socket.js` | Không thấy |
| detection invalid transition attempts | `Missing evidence` | `services/ride-service/src/services/ride.service.js` | Có reject bằng exception, nhưng chưa thấy audit/alert |

### 11.8 Resilience security checklist

| Control | Status | Evidence | Review requirement |
| --- | --- | --- | --- |
| fallback polling vẫn giữ authz | `Missing evidence` | no runtime polling path | Không thấy fallback polling implementation để verify authz |
| last-known-location không bị abuse | `Missing evidence` | `services/ride-service/src/services/location.service.js` | In-memory location store không có access control/TTL/abuse guard |
| retry/replay không gây duplicate state mutation | `Missing evidence` | `gateway/api-gateway/src/route-registry.js`, `services/ride-service/src/services/ride.service.js` | Không thấy idempotency cho ride mutation endpoints |
| degraded mode không làm lộ ride tracking hoặc bypass control | `Missing evidence` | `services/ride-service/src/services/ride.service.js`, `services/ride-service/src/services/location.service.js` | Mongo fallback và direct WS path chưa chứng minh fail-closed |
| graceful degradation vẫn giữ integrity của lifecycle và GPS rule | `Missing evidence`, với GPS rule có `Security inconsistency` | `services/ride-service/src/services/ride.service.js`, `gateway/api-gateway/src/security/abac.js` | Không được assume fallback/direct WS vẫn giữ ABAC đúng |

### Step-by-step Review Workflow

1. Review `Client -> Edge -> Gateway` controls cho tất cả ride HTTP/WS paths.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`, `gateway/api-gateway/src/realtime/hub.js`, `infra/docker-swarm/docker-stack.yml`
   - Ghi riêng từng control: `HTTPS/TLS 1.3`, `WAF`, `rate limiting`, `quota`, `request validation`, `authn/authz` cho HTTP và WebSocket.
2. Review từng ride action theo chuỗi `scope -> role -> permission -> ownership`.
   - Bắt buộc check riêng cho:
     - create ride
     - get ride / get user rides / stats
     - assign-driver
     - start / complete / cancel
     - ride subscription / unsubscription
     - driver GPS update
     - admin/support override nếu có
   - Không được suy diễn role family ở gateway là đủ.
3. Review lifecycle guard và ABAC.
   - Đọc: `services/ride-service/src/services/ride.service.js`, `services/ride-service/src/models/ride.model.js`, `gateway/api-gateway/src/security/abac.js`
   - Bắt buộc làm rõ rule:
     - driver chỉ được update GPS khi ride `ACTIVE/IN_PROGRESS`
     - nếu gateway và service enforce khác nhau thì gắn `Security inconsistency`
4. Review WebSocket security.
   - Đọc: `gateway/api-gateway/src/realtime/hub.js`, `services/ride-service/src/realtime/socket.js`, `services/ride-service/index.js`
   - Bắt buộc check:
     - handshake auth
     - per-message authorization
     - subscription ownership
     - replay/forgery protection
     - direct service WebSocket exposure assessment
     - rate limiting / abuse control
5. Review data security/privacy.
   - Đọc: ride model/controller/service, Redis/Kafka topology, stack config
   - Bắt buộc ghi rõ:
     - encryption at-rest
     - encryption in-transit
     - masking/minimization cho live location, ETA, driverId, ride ownership, tracking payload
     - retention policy cho location history, ride tracking log, audit trail
6. Review service-to-service trust.
   - Đọc: `platform/architecture/security-topology.js`, `data-layer/redis/geo-topology.json`, `platform/architecture/realtime-topology.js`, `infra/docker-swarm/docker-stack.yml`
   - Bắt buộc check:
     - mTLS
     - service identity
     - authorization giữa gateway và ride-service
     - trust boundary tới Redis Geo, Kafka producer, ETA path, monitoring consumers
7. Review event-driven security.
   - Đọc: `platform/architecture/event-contracts.js`, `message-broker/kafka/topology.json`, runtime producer code nếu có
   - Bắt buộc check:
     - schema/envelope validation cho `driver.location.updated` và `ride.status.changed`
     - replay protection
     - topic allowlist
     - forged-event impact
     - correlation giữa HTTP/WS input và emitted event
8. Review logging/audit/SIEM/alerting và resilience.
   - Bắt buộc ghi rõ:
     - audit lifecycle mutation
     - audit sensitive driver/passenger action
     - centralized logging
     - correlation/tracing fields
     - detection forged GPS / anomalous location jump / unauthorized subscribe / invalid transition attempts
     - fallback polling vẫn giữ authz
     - last-known-location không bị abuse
     - retry/replay không gây duplicate state mutation
     - degraded mode không làm lộ ride tracking hoặc bypass control
     - graceful degradation vẫn giữ integrity của lifecycle và GPS rule

### PASS/FAIL Checklist

- HTTP ride paths
  - `Implemented`: authn generic qua gateway family path
  - `Missing evidence`: ride-specific scope/permission/ownership policy cho create/get/stats/assign/start/complete/cancel
  - `Missing evidence`: gateway validation/rate-limit/quota policy riêng cho ride HTTP endpoints
- Create / read / stats
  - `Missing evidence`: bind `userId` path/body với actor identity
  - `Missing evidence`: stats endpoint restriction cho admin/support/internal only
  - `Missing evidence`: response minimization cho `driverId`, `userId`, `currentLocation`, `etaMinutes`
- Lifecycle mutation
  - `Implemented`: state guards cho assign/start/complete/cancel có tồn tại ở service
  - `Missing evidence`: mutation permission dựa trên authenticated actor thay vì ID trong body
  - `Missing evidence`: idempotency/replay defense cho mutation endpoints
- GPS / WebSocket
  - `Implemented`: gateway WS handshake auth
  - `Implemented`: gateway WS rate limit và ABAC cho `driver.location.update`
  - `Missing evidence`: direct service WS handshake auth, per-message authz, subscription ownership, replay guard, rate limit
  - `Security inconsistency`: gateway GPS rule `ACTIVE`, service GPS rule cho phép `DRIVER_ASSIGNED` / `DRIVER_ARRIVING` / `IN_PROGRESS`
- Data / trust / events
  - `Expected by architecture`: `HTTPS/TLS 1.3`, `WAF`, `quota`, `mTLS`, `service identity`, Redis Geo primary writer, Kafka `ride.status.changed`, encryption at-rest, centralized logging, SIEM
  - `Observed runtime differs from architecture`: runtime dùng plain internal HTTP, Kafka `PLAINTEXT`, in-memory ride/location fallback, direct service WS server tồn tại
  - `Missing evidence`: retention, audit trail, anomaly detection, event schema/replay/correlation controls

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

- Evidence direct service WS có bị expose ở production hay chỉ để local dev.
- Evidence Redis Geo writer và Kafka publisher thực.
- Evidence ownership/auth context propagation từ gateway sang ride-service.

### Fix Priority

- P0: socket auth bypass, forged GPS, invalid ride transition, passenger/driver IDOR.
- P1: replay/event integrity gap, fallback authz gap, missing audit/monitoring.
- P2: topology/docs alignment, observability hardening.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/ride-service/src/services/ride.service.js`
   - `services/ride-service/src/realtime/socket.js`
   - `services/ride-service/src/services/location.service.js`
   - `gateway/api-gateway/src/realtime/hub.js`
   - `gateway/api-gateway/src/security/abac.js`
4. So sánh với checklist.
5. Ghi findings theo template.

### AI Review Prompt

```text
Bạn là security reviewer cho ride-service của CAB-BOOKING.

Ưu tiên đọc:
- services/ride-service/src/routes/ride.routes.js
- services/ride-service/src/controllers/ride.controller.js
- services/ride-service/src/services/ride.service.js
- services/ride-service/src/realtime/socket.js
- services/ride-service/src/services/location.service.js
- services/ride-service/src/services/eta.service.js
- gateway/api-gateway/src/realtime/hub.js
- gateway/api-gateway/src/security/abac.js

Tập trung bắt:
- socket auth bypass
- forged GPS
- invalid ride transition
- passenger/driver IDOR
- replay event/location
- auth bypass qua direct service websocket hoặc fallback polling
- rule driver chỉ update GPS khi ride ACTIVE/IN_PROGRESS

Rules:
- Không assume gateway đã chặn hết nếu service WS tồn tại riêng.
- Nếu gateway và service enforce rule khác nhau, ghi đây là security inconsistency.

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

