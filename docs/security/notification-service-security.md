# CAB-BOOKING Security Review Workflow ? WORKFLOW 04 — NOTIFICATION-SERVICE

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

## 7. WORKFLOW 04 — NOTIFICATION-SERVICE

### Service Security Context

- Business role: nhận event domain hoặc internal request để gửi notification email/SMS/push/in-app.
- Security role: chặn open relay nội bộ, forged event, spam abuse, unauthorized notification read, leak provider secret, leak PII/message content, và callback forgery.
- Inbound interfaces observed trong repo:
  - `GET /health`
  - `GET /architecture`
  - `GET /api/v1/notifications?userId=...`
  - `POST /internal/notifications/send`
  - Kafka consumer cho nhiều topic trong `NOTIFICATION_EVENT_TOPICS`
- Outbound dependencies observed trong repo:
  - Kafka consumer: `services/notification-service/src/kafka-consumer.js`
  - MongoDB hoặc fallback in-memory: `services/notification-service/src/notification-repository.js`
  - Channel dispatcher/provider adapter: `services/notification-service/src/channel-dispatcher.js`
- Dữ liệu nhạy cảm phải coi là protected:
  - `userId`
  - destination `email`, `phoneNumber`
  - `title`, `message`
  - provider response / `deliveryReference`
  - `metadata`, `eventId`, `relatedEntityId`
- Observed in repo:
  - `services/notification-service/src/app.js`
  - `services/notification-service/src/kafka-consumer.js`
  - `services/notification-service/src/event-mapper.js`
  - `services/notification-service/src/notification-service.js`
  - `services/notification-service/src/channel-dispatcher.js`
  - `services/notification-service/src/notification-repository.js`
  - `services/notification-service/.env.example`
- Expected by architecture:
  - `platform/architecture/security-topology.js`
  - `platform/architecture/security-zero-trust-architecture.mmd`
  - `platform/architecture/resilience-topology.js`
  - `docs/architecture/01-overall-architecture.md`
- Preliminary repo-backed concerns:
  - `GET /api/v1/notifications?userId=...` chỉ kiểm tra presence của `userId`; chưa có ownership check, `scope/role/permission` check, hay downstream authz trong `services/notification-service/src/app.js`.
  - `POST /internal/notifications/send` chưa có authn/authz, caller identity, quota, hay internal trust proof trong `services/notification-service/src/app.js`.
  - Kafka consumer chỉ parse JSON và forward payload; chưa thấy schema validation envelope, signature, hay service identity cho producer path trong `services/notification-service/src/kafka-consumer.js`.
  - Runtime có fallback sang in-memory khi MongoDB unavailable trong `services/notification-service/src/notification-repository.js`; điều này phải được review như security-relevant degradation, không được assume là safe.

### Status Labels Bắt Buộc

- `Implemented`: có evidence trực tiếp trong code/config/test/runtime artifact của repo.
- `Expected by architecture`: chỉ mới thấy ở tài liệu kiến trúc/topology, chưa có runtime implementation đủ mạnh để kết luận đã có control.
- `Missing evidence`: chưa thấy code/config/runtime artifact chứng minh control tồn tại.
- `Observed runtime differs from architecture`: tài liệu kiến trúc yêu cầu control, nhưng runtime/config trong repo cho thấy trạng thái khác hoặc yếu hơn.

### Trust Boundaries Phải Review

- `Client -> Edge -> Gateway -> notification-service` cho path expose qua `/api/v1/notifications`.
- `Internal caller -> notification-service` cho `POST /internal/notifications/send`.
- `Kafka -> notification-service consumer`.
- `notification-service -> MongoDB`.
- `notification-service -> in-memory fallback runtime`.
- `notification-service -> external provider dispatcher`.
- `External provider -> provider callback/webhook endpoint` nếu path này tồn tại hoặc được kỳ vọng theo kiến trúc.

### Files/Paths To Review First

- `services/notification-service/src/app.js`
- `services/notification-service/src/kafka-consumer.js`
- `services/notification-service/src/event-mapper.js`
- `services/notification-service/src/notification-service.js`
- `services/notification-service/src/channel-dispatcher.js`
- `services/notification-service/src/notification-repository.js`
- `services/notification-service/.env.example`
- `platform/architecture/security-topology.js`
- `platform/architecture/resilience-topology.js`
- `gateway/api-gateway/src/app.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/middleware/authorization.js`
- `gateway/api-gateway/src/middleware/rate-limit.js`
- `gateway/api-gateway/src/middleware/validation.js`
- `infra/docker-swarm/docker-stack.yml`

### Notification Path Security Matrix

#### A. Client / Edge / Gateway controls cho `GET /api/v1/notifications?userId=...`

- `HTTPS/TLS 1.3`
  - `Expected by architecture`: `platform/architecture/security-topology.js` và `docs/architecture/01-overall-architecture.md` yêu cầu HTTPS/TLS 1.3 cho client/edge/gateway.
  - `Missing evidence`: chưa thấy TLS termination/runtime certificate config trong `gateway/api-gateway/src/*` hay `infra/docker-swarm/docker-stack.yml`.
- `WAF`
  - `Expected by architecture`: `platform/architecture/security-topology.js` liệt kê WAF ở client/edge.
  - `Missing evidence`: chưa thấy WAF config/runtime artifact trong gateway hay swarm stack.
- `Rate limiting / quota`
  - `Expected by architecture`: security topology và gateway docs yêu cầu rate limit/quota.
  - `Missing evidence`: `gateway/api-gateway/src/route-registry.js` không có policy riêng cho `GET /api/v1/notifications`; family-level route của notification-service hiện không có rate limit cụ thể.
- `Request validation`
  - `Expected by architecture`: gateway có middleware validation chung trong `gateway/api-gateway/src/middleware/validation.js`.
  - `Missing evidence`: không có schema policy riêng cho query `userId`, `status`, `channel`, `limit` của notification read path trong `gateway/api-gateway/src/route-registry.js`.
- `Authn/Authz qua gateway nếu endpoint được expose`
  - `Implemented`: gateway family `notification-service` mặc định `authRequired: true` và `allowedRoles: ["Customer", "Driver", "Admin"]` trong `gateway/api-gateway/src/route-registry.js`.
  - `Missing evidence`: gateway chỉ check `role`, chưa có `scope` hay `permission` enforcement cụ thể cho notification read path trong `gateway/api-gateway/src/middleware/authorization.js`.
  - `Missing evidence`: downstream service chưa re-check ownership/resource authorization trong `services/notification-service/src/app.js`.

#### B. Internal API controls cho `POST /internal/notifications/send`

- `HTTPS/TLS 1.3`
  - `Expected by architecture`: client/edge/gateway dùng TLS 1.3; internal transport kỳ vọng encrypted theo Zero Trust.
  - `Observed runtime differs from architecture`: `infra/docker-swarm/docker-stack.yml` cấu hình `NOTIFICATION_SERVICE_URL: http://notification-service:3108`, chưa phải HTTPS.
- `WAF`
  - `Expected by architecture`: edge WAF là control ở mức kiến trúc.
  - `Missing evidence`: internal endpoint không đi qua WAF artifact nào trong repo.
- `Rate limiting / quota`
  - `Missing evidence`: `services/notification-service/src/app.js` không có rate limit/quota cho `/internal/notifications/send`.
- `Request validation`
  - `Implemented`: `NotificationService.submitNotification()` gọi `normalizeNotificationInput()` để enforce field required và channel-specific validation trong `services/notification-service/src/notification-service.js`.
  - `Missing evidence`: validation này chỉ ở service payload level; chưa có schema cho caller identity, trust context, hay authorization intent.
- `Authn/Authz qua gateway nếu endpoint được expose`
  - `Missing evidence`: path này không nằm dưới gateway manifest path `/api/v1/notifications`, và service code không có auth middleware riêng cho endpoint nội bộ.
  - `Missing evidence`: chưa có evidence endpoint này chỉ callable bởi gateway hoặc trusted internal caller.

#### C. Kafka event ingress

- `Transport security`
  - `Expected by architecture`: internal transport phải theo Zero Trust.
  - `Observed runtime differs from architecture`: Kafka đang chạy `PLAINTEXT` trong `infra/docker-swarm/docker-stack.yml`.
- `Topic allowlist`
  - `Implemented`: topics được parse từ `NOTIFICATION_EVENT_TOPICS` trong `services/notification-service/src/kafka-consumer.js`.
  - `Missing evidence`: allowlist này là config string; chưa thấy ràng buộc producer identity hay signed event envelope.
- `Payload validation`
  - `Implemented`: bad JSON bị drop qua `safeParseJson()`.
  - `Missing evidence`: chưa có schema validation cho event envelope/payload beyond JSON parse.
- `Forged event / replay control`
  - `Missing evidence`: chưa thấy signature, source authenticity, replay window, hay anti-forgery control cho Kafka event ingress.

### Endpoint Authorization Checklist Bắt Buộc

#### `GET /api/v1/notifications?userId=...`

- Kiểm tra `authn`
  - `Implemented`: gateway yêu cầu auth cho family notification-service.
- Kiểm tra `role`
  - `Implemented`: gateway cho phép `Customer`, `Driver`, `Admin`.
- Kiểm tra `scope`
  - `Missing evidence`: chưa thấy scope như `notifications:read:self`, `notifications:read:any`, `support:notifications:read`.
- Kiểm tra `permission`
  - `Missing evidence`: chưa thấy permission-level guard cho read history.
- Kiểm tra ownership / resource binding
  - `Missing evidence`: `services/notification-service/src/app.js` dùng trực tiếp `request.query.userId` để list notifications.
  - `Risk`: IDOR đọc notification history của user khác nếu request vượt qua gateway với token hợp lệ nhưng thiếu downstream ownership check.
- Kiểm tra admin/support/internal service access
  - `Admin`: `Expected by architecture` vì gateway cho role `Admin`, nhưng `Missing evidence` cho permission giới hạn phạm vi, purpose, audit.
  - `Support`: `Missing evidence` vì không thấy role/support permission trong gateway hay service.
  - `Internal service`: `Missing evidence` vì endpoint này là public gateway path, chưa có model service account read history.

#### `POST /internal/notifications/send`

- Kiểm tra `authn`
  - `Missing evidence`: không có auth middleware.
- Kiểm tra `service identity`
  - `Missing evidence`: chưa có service identity token, mTLS principal, hay signed internal request.
- Kiểm tra `role`
  - `Missing evidence`: chưa có role/admin/support/internal service role check.
- Kiểm tra `scope`
  - `Missing evidence`: chưa thấy scope như `notifications:send`, `notifications:send:system`, `notifications:send:admin`.
- Kiểm tra `permission`
  - `Missing evidence`: chưa thấy permission phân biệt send giao dịch, send marketing, resend, admin override.
- Kiểm tra admin/support/internal service access
  - `Admin`: `Missing evidence`
  - `Support`: `Missing evidence`
  - `Internal service`: `Missing evidence`
- Kết luận review bắt buộc
  - Không được ghi `Implemented` cho internal send authz nếu chỉ thấy endpoint hoạt động trong test.
  - Test `services/notification-service/test/notification-service.test.js` chỉ chứng minh endpoint callable, không chứng minh secure.

### Data Security / Privacy Checklist

- `Encryption at-rest`
  - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu encryption at-rest.
  - `Missing evidence`: chưa thấy MongoDB encryption-at-rest config/key management artifact cho notification data.
- `Encryption in-transit`
  - `Expected by architecture`: security topology yêu cầu encryption in-transit.
  - `Observed runtime differs from architecture`: service URLs trong swarm là `http://...`; Kafka là `PLAINTEXT`.
- `Masking / minimization cho email`
  - `Missing evidence`: repo lưu `destination.email` nguyên vẹn trong notification object; chưa thấy masking/pseudonymization trước khi persist hoặc present.
- `Masking / minimization cho phone`
  - `Missing evidence`: repo lưu `destination.phoneNumber` nguyên vẹn; chưa thấy masking.
- `Masking / minimization cho message content`
  - `Missing evidence`: `message` và `title` được lưu và trả ra trực tiếp qua `presentNotification()`.
- `Masking / minimization cho event metadata`
  - `Missing evidence`: `metadata` được copy thẳng từ payload qua `sanitizeObject()`; chưa có allowlist/minimization.
- `Notification history retention policy`
  - `Missing evidence`: chưa thấy TTL index, archive policy, delete policy, hay retention config cho collection notifications.
- `Provider payload retention policy`
  - `Missing evidence`: chưa thấy retention rule cho `delivery`, provider response, `deliveryReference`, callback payload.
- `PII exposure qua API`
  - `Implemented`: response của `presentNotification()` hiện không trả raw `destination`.
  - `Missing evidence`: vẫn trả `message`, `title`, `lastError`; chưa có phân loại sensitivity hoặc view-specific redaction.

### Service-to-Service Trust Checklist

- `Service identity cho internal caller`
  - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu `per-service identity`.
  - `Missing evidence`: chưa thấy service credential / service account verification trong notification-service runtime.
- `mTLS / internal authn giữa caller service và notification-service`
  - `Expected by architecture`: topology yêu cầu `mTLS`.
  - `Observed runtime differs from architecture`: swarm stack đang dùng `http://notification-service:3108`.
- `Trust boundary tới Kafka`
  - `Expected by architecture`: internal traffic không được implicit trust.
  - `Observed runtime differs from architecture`: Kafka `PLAINTEXT`; chưa có identity-bound producer/consumer channel.
- `Trust boundary tới external provider`
  - `Expected by architecture`: external provider là untrusted boundary, cần authn/authz/secret management/callback verification.
  - `Missing evidence`: dispatcher hiện là simulator trong `services/notification-service/src/channel-dispatcher.js`; chưa có artifact cho provider auth, TLS pinning, callback trust, IP allowlist, signature verification.

### Logging / Audit / SIEM / Alerting Checklist

- `Audit internal send`
  - `Missing evidence`: chưa thấy audit record cho ai gửi, gửi thay ai, source service nào, purpose nào.
- `Audit provider callback / delivery status change`
  - `Missing evidence`: chưa thấy callback path hay audit path cho delivery status transition.
- `Spam storm / retry storm / forged event storm detection`
  - `Expected by architecture`: `platform/architecture/security-topology.js` yêu cầu SIEM/real-time alerts.
  - `Missing evidence`: chưa thấy counters, anomaly rules, alert hooks, hay detection logic trong notification-service runtime.
- `Correlation ID / traceability phục vụ điều tra`
  - `Missing evidence`: notification-service responses không thêm `requestId`/`correlationId`; service code cũng không propagate correlation context.
- `Centralized logging / SIEM`
  - `Expected by architecture`: ELK/OpenSearch + SIEM có trong security topology.
  - `Missing evidence`: chưa thấy notification-service integration artifact.
- `Sensitive logging hygiene`
  - `Implemented`: logger hiện chủ yếu log error message/warn message, chưa thấy log trực tiếp raw destination trong code path đã đọc.
  - `Missing evidence`: chưa có explicit redaction policy, structured audit schema, hay test chứng minh không log PII/provider secret.

### Resilience Security Checklist

- `Timeout / circuit breaker với provider`
  - `Expected by architecture`: `platform/architecture/resilience-topology.js` yêu cầu timeout/circuit breaker.
  - `Missing evidence`: `services/notification-service/src/channel-dispatcher.js` không có timeout/circuit breaker/provider client control.
- `Retry không gây spam amplification`
  - `Implemented`: `NotificationService` có `maxAttempts`, exponential backoff, dedupe window trong `services/notification-service/src/notification-service.js`.
  - `Missing evidence`: chưa thấy per-user/per-destination anti-spam quota hoặc retry budget theo channel/provider.
- `Graceful degradation khi provider down`
  - `Expected by architecture`: resilience topology yêu cầu graceful degradation.
  - `Missing evidence`: chưa có documented secure degrade mode cho provider outage.
- `Fallback path không bypass control`
  - `Observed runtime differs from architecture`: MongoDB fallback sang in-memory trong `services/notification-service/src/notification-repository.js` giữ service sống nhưng chưa có evidence về retention, audit continuity, durability, hay privacy equivalence.
  - `Missing evidence`: chưa có guard chứng minh fallback path không làm yếu audit/privacy/control expectations.

### Webhook / Provider Callback Security Checklist

- `Signature verification`
  - `Expected by architecture`: external callback phải verify.
  - `Missing evidence`: chưa thấy endpoint hay code path verify signature trong notification-service.
- `Replay protection`
  - `Expected by architecture`: callback replay phải bị chặn.
  - `Missing evidence`: chưa thấy nonce/timestamp window/idempotency cho callback.
- `Callback rate limiting / abuse control`
  - `Expected by architecture`: callback path nếu expose phải có rate limiting / abuse control.
  - `Missing evidence`: chưa thấy endpoint hay control config.
- `Không suy diễn implementation đã tồn tại`
  - Nếu repo không có callback path thì phải ghi thẳng:
    - `Expected by architecture` cho yêu cầu kiến trúc.
    - `Missing evidence` cho runtime implementation.

### Step-by-step Review Workflow

1. Review client/edge/gateway path cho notification read.
   - Đọc: `platform/architecture/security-topology.js`, `gateway/api-gateway/src/app.js`, `gateway/api-gateway/src/route-registry.js`, `gateway/api-gateway/src/middleware/authorization.js`, `gateway/api-gateway/src/middleware/rate-limit.js`, `gateway/api-gateway/src/middleware/validation.js`
   - Kiểm tra: `HTTPS/TLS 1.3`, WAF, rate limit/quota, request validation, authn/authz gateway cho `GET /api/v1/notifications?userId=...`.
   - Chỉ ghi `Implemented` khi có artifact runtime/config cụ thể; không dùng doc gateway để thay cho runtime proof.
2. Review downstream authorization cho notification read path.
   - Đọc: `services/notification-service/src/app.js`, `services/notification-service/src/notification-service.js`, `services/notification-service/src/notification-repository.js`
   - Kiểm tra: ownership, `scope/role/permission`, admin/support/internal access, IDOR risk.
   - FAIL hoặc `Missing evidence` khi service chỉ tin `userId` từ query.
3. Review internal send path.
   - Đọc: `services/notification-service/src/app.js`, `services/notification-service/src/notification-service.js`
   - Kiểm tra: service identity, authn/authz, rate limit/quota, validation, dedupe, admin/support/internal access.
   - FAIL hoặc `Missing evidence` khi endpoint nhận request bất kỳ trên mạng nội bộ.
4. Review Kafka trust boundary.
   - Đọc: `services/notification-service/src/kafka-consumer.js`, `services/notification-service/src/event-mapper.js`, `infra/docker-swarm/docker-stack.yml`
   - Kiểm tra: topic allowlist, schema validation, forged event, replay, plaintext transport, producer authenticity.
5. Review data security / privacy.
   - Đọc: `services/notification-service/src/app.js`, `services/notification-service/src/notification-service.js`, `services/notification-service/src/notification-repository.js`, `services/notification-service/src/channel-dispatcher.js`
   - Kiểm tra: at-rest, in-transit, masking/minimization, retention policy, API exposure of content and metadata.
6. Review service-to-service trust và external provider boundary.
   - Đọc: `platform/architecture/security-topology.js`, `infra/docker-swarm/docker-stack.yml`, `services/notification-service/src/channel-dispatcher.js`
   - Kiểm tra: mTLS, service identity, internal authn, provider trust boundary.
7. Review logging/audit/SIEM/alerting.
   - Đọc: `services/notification-service/src/*`, `platform/architecture/security-topology.js`
   - Kiểm tra: audit send, audit delivery status change, spam/retry/forged event storm detection, correlation ID, traceability.
8. Review resilience security.
   - Đọc: `platform/architecture/resilience-topology.js`, `services/notification-service/src/notification-service.js`, `services/notification-service/src/notification-repository.js`, `services/notification-service/src/channel-dispatcher.js`
   - Kiểm tra: timeout, circuit breaker, retry budget, graceful degradation, secure fallback.
9. Review webhook/provider callback security.
   - Đọc: `services/notification-service/*`, `.env.example`
   - Kiểm tra: signature verification, replay protection, callback rate limiting, abuse control.
   - Nếu không có code path, ghi rõ `Missing evidence`; không tự nâng thành `Implemented`.

### Checklist Kết Luận Cuối

- `GET /api/v1/notifications?userId=...` phải có authn, role gate, ownership check, và nếu kiến trúc yêu cầu thì `scope/permission` check rõ ràng.
- `POST /internal/notifications/send` không được là open relay nội bộ; phải có caller identity, authn/authz, và request validation.
- Tất cả notification paths expose qua edge/gateway phải được review cho `HTTPS/TLS 1.3`, WAF, rate limiting/quota, request validation.
- Kafka path phải coi là untrusted input; JSON parse thôi là chưa đủ.
- Notification data phải có review riêng cho at-rest, in-transit, masking/minimization, retention.
- Runtime internal transport không được ghi `Implemented` cho mTLS/service identity nếu swarm vẫn đang `http://` và Kafka `PLAINTEXT`.
- Logging/audit phải đủ để điều tra ai gửi gì, gửi cho ai, từ event nào, qua provider nào, và chuyện gì xảy ra khi retry/callback.
- Resilience chỉ PASS khi retry/fallback không mở bypass control hay spam amplification.
- Webhook/provider callback security chỉ PASS khi có code/config/test/runtime artifact cho signature, replay, rate limit.

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

- Runtime artifact cho TLS termination / cert management / encrypted internal transport.
- WAF config cho edge/gateway path expose notification API.
- Route policy riêng cho `GET /api/v1/notifications?userId=...` gồm validation, rate limit/quota, permission model.
- Authn/authz và caller identity proof cho `/internal/notifications/send`.
- Scope/permission matrix cho `admin`, `support`, `internal service`.
- Retention policy cho notification history và provider payload.
- Audit schema, correlation ID propagation, SIEM/alerting pipeline.
- Provider integration artifact: timeout, circuit breaker, auth secret handling, callback signature verification, replay protection.

### Fix Priority

- P0: unauthorized read qua `userId`, unauthorized internal send, forged event processing, callback forgery path nếu có expose, plaintext internal trust boundary bị assume safe.
- P1: spam abuse, retry amplification, thiếu audit/traceability, thiếu masking/minimization, thiếu retention policy, insecure fallback posture.
- P2: docs/config alignment, route policy completeness, observability hardening.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan tối thiểu các file:
   - `services/notification-service/src/app.js`
   - `services/notification-service/src/kafka-consumer.js`
   - `services/notification-service/src/event-mapper.js`
   - `services/notification-service/src/notification-service.js`
   - `services/notification-service/src/notification-repository.js`
   - `services/notification-service/src/channel-dispatcher.js`
   - `platform/architecture/security-topology.js`
   - `platform/architecture/resilience-topology.js`
   - `gateway/api-gateway/src/route-registry.js`
   - `infra/docker-swarm/docker-stack.yml`
4. Đánh dấu từng item là `Implemented`, `Expected by architecture`, `Missing evidence`, hoặc `Observed runtime differs from architecture`.
5. Ghi findings theo template; chỗ nào chưa có evidence thì nói thẳng là chưa có.

### AI Review Prompt

```text
Bạn là security reviewer cho notification-service của CAB-BOOKING.

Ưu tiên đọc:
- services/notification-service/src/app.js
- services/notification-service/src/kafka-consumer.js
- services/notification-service/src/event-mapper.js
- services/notification-service/src/notification-service.js
- services/notification-service/src/notification-repository.js
- services/notification-service/src/channel-dispatcher.js
- platform/architecture/security-topology.js
- platform/architecture/resilience-topology.js
- gateway/api-gateway/src/route-registry.js
- gateway/api-gateway/src/middleware/authorization.js
- infra/docker-swarm/docker-stack.yml

Tập trung bắt:
- client/edge/gateway controls cho mọi notification path expose
- authn/authz/scope/role/permission của `GET /api/v1/notifications?userId=...`
- authn/authz/service identity/scope/role/permission của `POST /internal/notifications/send`
- admin/support/internal service access
- forged event / replay / spam storm / retry storm
- data security/privacy: at-rest, in-transit, masking/minimization, retention
- service-to-service trust: service identity, mTLS, provider boundary
- logging/audit/SIEM/alerting, correlation ID, traceability
- resilience security: timeout, circuit breaker, retry amplification, graceful degradation, fallback không bypass control
- webhook/provider callback security: signature verification, replay protection, callback rate limit

Rules:
- Chỉ PASS khi có evidence trong code/config/runtime artifact.
- Nếu chỉ thấy trong doc/topology thì ghi `Expected by architecture`.
- Nếu runtime/config đang khác với kiến trúc thì ghi `Observed runtime differs from architecture`.
- Không suy diễn implementation đã tồn tại.
- Treat Kafka event, internal API input, callback payload, và fallback path như untrusted input.

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

