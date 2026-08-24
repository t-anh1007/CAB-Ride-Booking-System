# CAB-BOOKING Security Review Workflow ? WORKFLOW 02 — BOOKING-SERVICE

Ngày tạo: `2026-04-20`

Phạm vi tài liệu này là tạo một bộ workflow thực chiến để từng thành viên trong team tự rà service của mình theo đúng trust boundary của CAB-BOOKING. Tài liệu này không kết luận hệ thống "an toàn"; nó chỉ định nghĩa cách đọc evidence, cách chấm PASS/FAIL, các gap sơ bộ đã thấy trong repo, và cách chuyển từ review sang fix mode.

## 1. SYSTEM SECURITY OVERVIEW

### 1.1 Booking-service context cần giữ khi review

- CAB-BOOKING là kiến trúc `microservices + event-driven + Zero Trust`.
- Booking-service nằm trong chuỗi nghiệp vụ `gateway -> booking -> ride -> payment`.
- Dependency chính liên quan trực tiếp workflow booking:
  - `gateway/api-gateway`
  - trusted auth context / request context từ gateway
  - `pricing-service`
  - message broker
  - MongoDB
  - `ride-service`
  - `payment-service`

### 1.2 Rule kiến trúc liên quan trực tiếp booking

- Ownership phải bám trusted actor context, không tin `userId` từ client body/query nếu không verify lại.
- `Idempotency-Key` là bắt buộc cho create booking và phải an toàn khi retry/replay.
- `priceSnapshot` là anti-tampering snapshot, chỉ được tin nếu khớp trusted response từ `pricing-service`.
- Booking-service là producer của event `ride.created` theo `message-broker/kafka/topology.json` và `platform/architecture/event-contracts.js`.
- Retry/replay safety phải bảo vệ cả DB write lẫn side effect downstream như publish event hoặc tạo ride.
- Consistency phải được rà xuyên `booking / pricing / ride / payment`, không chỉ từng service đơn lẻ.

### 1.3 Repo-backed observations cho workflow booking

- Observed in repo:
  - `services/booking-service/src/controllers/bookingController.js` nhận `userId` và `priceSnapshot` trực tiếp từ request body; `cancel/get/list` chưa thấy ownership guard theo auth context.
  - `services/booking-service/src/models/Booking.js` có unique `bookingId` và `idempotencyKey`, có `priceSnapshot`, `status`, `rideId`.
  - `services/booking-service/src/utils/messageBroker.js` chỉ là mock logger.
  - `gateway/api-gateway/src/validation-schemas.js` validate shape của `bookingCreate`, nhưng vẫn cho `userId` và `priceSnapshot` đi từ client.
  - `gateway/api-gateway/src/middleware/idempotency.js` enforce `Idempotency-Key` ở gateway cho route booking create.
  - `services/payment-service/src/middlewares/requestMeta.js` đang hard-code `requestId` và `correlationId` là `"uuid"`, nên traceability cross-service với booking/payment chưa đủ mạnh.
- Expected by CAB architecture:
  - gateway truyền auth/request context đáng tin cho booking-service.
  - booking-service chỉ publish `ride.created` qua broker thật, có envelope và source identity rõ.
  - `priceSnapshot` phải ràng buộc với trusted pricing response trước khi ride/payment dùng tiếp.
- Evidence still needed:
  - evidence runtime cho producer thật của `ride.created`.
  - evidence mapping giữa booking record và ride/payment downstream.
  - evidence enforce state-aware ABAC beyond role gating ở gateway.

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

## 5. WORKFLOW 02 — BOOKING-SERVICE

### Service Security Context

- Business role: tạo booking, hủy booking, xem chi tiết và lịch sử booking.
- Security role: bảo vệ ownership của booking, chống duplicate booking, giữ integrity của `priceSnapshot`.
- Inbound interfaces:
  - `POST /api/v1/bookings`
  - `POST /api/v1/bookings/:bookingId/cancel`
  - `GET /api/v1/bookings/:bookingId`
  - `GET /api/v1/bookings?userId=...`
- Outbound dependencies: MongoDB, gateway, pricing result snapshot, broker publish `RideCreated`.
- Dữ liệu nhạy cảm: location pickup/destination, user identity, price snapshot, booking status.
- Observed in repo:
  - `services/booking-service/src/controllers/bookingController.js`
  - `services/booking-service/src/models/Booking.js`
  - `services/booking-service/src/utils/messageBroker.js`
- Expected by CAB architecture:
  - ownership validation, idempotency, anti-tampering price snapshot, real broker event.
- Preliminary repo-backed concerns:
  - `userId` hiện nhận trực tiếp từ body/query.
  - Event publish hiện là mock broker.

### Trust Boundaries

- `Customer/Admin -> Gateway -> booking-service`
- `booking-service -> MongoDB`
- `booking-service -> broker topic ride.created`
- `booking-service -> pricing output snapshot`

### Attack Surface

- HTTP create/cancel/get/list.
- Booking status transition.
- Client-provided `priceSnapshot`.
- Broker publish path `RideCreated`.
- Không thấy consumer riêng hoặc worker riêng trong repo.

### Files/Paths To Review First

- `services/booking-service/src/routes/bookingRoutes.js`
- `services/booking-service/src/controllers/bookingController.js`
- `services/booking-service/src/models/Booking.js`
- `services/booking-service/src/utils/messageBroker.js`
- `gateway/api-gateway/src/route-registry.js`
- `gateway/api-gateway/src/validation-schemas.js`

### Step-by-step Review Workflow

1. Review create booking input boundary.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`, `gateway/api-gateway/src/validation-schemas.js`
   - Kiểm tra: user identity có lấy từ trusted auth context hay từ client body; request có schema validation ở gateway và service.
   - PASS evidence: service không tin `userId` từ body hoặc verify ownership từ auth context.
   - FAIL evidence: create booking chấp nhận `userId` client-controlled mà không verify actor.
2. Review idempotency và duplicate booking.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`, `services/booking-service/src/models/Booking.js`, `gateway/api-gateway/src/middleware/idempotency.js`
   - Kiểm tra: `Idempotency-Key` bắt buộc, uniqueness ở DB, behavior khi replay.
   - PASS evidence: duplicate request trả booking cũ, không tạo bản ghi mới.
   - FAIL evidence: header không bắt buộc, unique không enforced, hoặc side effect vẫn xảy ra nhiều lần.
3. Review price integrity.
   - Đọc: `services/booking-service/src/models/Booking.js`, `services/booking-service/src/controllers/bookingController.js`, `services/pricing-service/src/controllers/pricingController.js`, `gateway/api-gateway/src/validation-schemas.js`
   - Kiểm tra: `priceSnapshot` có được server-side lấy từ pricing hay client tự gửi; booking có giữ đủ dữ liệu để đối chiếu trusted response của `pricing-service` hay không.
   - PASS evidence: booking chỉ chấp nhận snapshot do server trusted source tạo.
   - FAIL evidence: client có thể ghi thẳng `amount/surgeMultiplier`.
   - Evidence still needed: proof mapping giữa booking snapshot đã lưu và pricing response trusted tại runtime.
4. Review ownership + ABAC theo state cho read/cancel/mutate.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`
   - Kiểm tra:
     - get by id, cancel, list by user có ownership/role guard không
     - `cancel` chỉ hợp lệ ở các booking state cho phép
     - không có mutate sau khi booking đã lock hoặc đã phát `ride.created`
     - actor khác nhau (`customer/admin/system`) có transition khác nhau nếu kiến trúc yêu cầu
   - PASS evidence: actor chỉ đọc/hủy booking hợp lệ theo quyền và state transition được enforce rõ.
   - FAIL evidence: chỉ cần biết `bookingId` hoặc `userId` là xem/hủy được booking khác, hoặc state transition không bị chặn.
   - Evidence still needed: evidence rule transition riêng cho `customer/admin/system` nếu service dự kiến hỗ trợ.
5. Review event integrity theo contract `ride.created`.
   - Đọc: `services/booking-service/src/utils/messageBroker.js`, `services/booking-service/src/controllers/bookingController.js`, `message-broker/kafka/topology.json`, `platform/architecture/event-contracts.js`
   - Kiểm tra:
     - event name/topic có khớp `ride.created`
     - envelope có `eventId`, `correlationId`, `timestamp`
     - có producer identity/source trust
     - payload/schema có khớp contract CAB
     - có rủi ro replay hoặc duplicate publish khi retry/create booking
   - PASS evidence: publish qua broker thật, envelope/metadata đầy đủ, source trust rõ, duplicate publish được chặn.
   - FAIL evidence: chỉ log mock event, topic mismatch, hoặc event thiếu metadata/source/schema control.
   - Evidence still needed: nếu broker còn mock thì đây là gap mức kiến trúc/runtime, không được PASS.
6. Review cross-service integrity.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`, `services/booking-service/src/models/Booking.js`, `services/ride-service/src/controllers/ride.controller.js`, `services/ride-service/src/services/ride.service.js`, `services/payment-service/src/controllers/paymentController.js`, `services/payment-service/src/services/paymentService.js`
   - Kiểm tra:
     - mapping `booking -> ride.created` có đầy đủ dữ liệu downstream cần không
     - `priceSnapshot` có khớp trusted response từ `pricing-service` không
     - duplicate booking có thể kéo theo duplicate ride không
     - booking status có được downstream dùng nhất quán không
     - payment có thể charge từ snapshot/state sai không
   - PASS evidence: cross-service mapping, state use, và amount source đều khớp evidence code/runtime.
   - FAIL evidence: downstream tạo/charge từ dữ liệu không trusted hoặc mapping không nhất quán.
   - Evidence still needed: nếu chưa thấy integration evidence thì giữ nguyên `Evidence still needed`, không PASS.
7. Review failure-scenario-driven booking review.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`, `services/booking-service/src/utils/messageBroker.js`, `gateway/api-gateway/src/middleware/idempotency.js`, artifact retry/replay liên quan ở ride/payment nếu có
   - Kiểm tra:
     - client retry có tạo duplicate booking không
     - booking-service crash có làm replay broker không kiểm soát không
     - broker replay có thể kéo theo duplicate ride không
     - fallback / matching fail / retry path có bypass validation hoặc integrity không
   - PASS evidence: các failure path vẫn giữ idempotency, validation, event safety.
   - FAIL evidence: retry/replay/crash path tạo duplicate state hoặc bypass guard.
   - Evidence still needed: nếu chưa có worker/broker/runtime artifact để chứng minh replay safety.
8. Review audit/logging và traceability.
   - Đọc: `services/booking-service/src/controllers/bookingController.js`, log/response helper liên quan, `services/payment-service/src/middlewares/requestMeta.js`
   - Kiểm tra log/audit cho:
     - create booking
     - cancel booking
     - actor
     - `bookingId`
     - `requestId` / `correlationId`
     - state change
     - traceability sang ride/payment nếu có
   - PASS evidence: action nhạy cảm có audit/log đủ mạnh để truy vết cross-service.
   - FAIL evidence: chỉ trả response cho client nhưng không có audit trail đủ dùng.
   - Evidence still needed: nếu chưa thấy log/audit bền vững thì ghi `Evidence still needed`, không PASS.

### PASS/FAIL Checklist

- `POST /bookings` bắt buộc `Idempotency-Key`.
- `bookingId` và `idempotencyKey` có uniqueness ở model/store.
- `userId` không được hoàn toàn client-controlled.
- `GET /bookings/:bookingId` có ownership check hoặc admin-only path.
- `GET /bookings?userId=...` không cho query user khác nếu không có quyền.
- `cancel` chỉ hợp lệ theo state transition hợp lệ.
- Không cho mutate booking sau khi đã lock hoặc đã phát `ride.created`.
- Nếu có nhiều actor (`customer/admin/system`), allowed transition phải tách rõ hoặc phải ghi `Evidence still needed`.
- `priceSnapshot` không được client tự áp đặt không kiểm tra.
- `priceSnapshot` phải đối chiếu được với trusted response từ `pricing-service`, nếu chưa có thì không PASS.
- `ride.created` event phải khớp contract CAB về topic/schema/envelope.
- `ride.created` phải có `eventId`, `correlationId`, `timestamp`, producer identity/source trust.
- Nếu broker còn mock hoặc chưa có evidence runtime replay-safe thì event integrity không PASS.
- Duplicate booking không được kéo theo duplicate ride hoặc duplicate side effect downstream.
- Booking status phải được downstream dùng nhất quán khi tạo ride hoặc charge payment.
- Payment không được charge từ snapshot/state sai hoặc dữ liệu chưa trusted.
- Audit/log phải truy được `actor`, `bookingId`, `requestId` hoặc `correlationId`, `state change`, và liên kết ride/payment nếu có.
- Bất kỳ mục nào còn thiếu evidence phải giữ trạng thái `Evidence still needed`, không suy diễn PASS.

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

- Evidence mapping giữa booking price snapshot và pricing trusted response.
- Evidence broker producer thật thay cho mock, gồm envelope `eventId/correlationId/timestamp` và producer identity.
- Evidence ownership guard từ auth context ở booking-service.
- Evidence state-aware ABAC cho `cancel` và các mutate path sau lock / sau `ride.created`.
- Evidence mapping `booking -> ride.created -> ride-service` để chứng minh duplicate booking không kéo theo duplicate ride.
- Evidence payment chỉ charge từ snapshot/state đúng và có thể trace ngược về booking.
- Evidence audit/log bền vững cho create/cancel booking với actor + correlation.
- Evidence replay/crash safety ở runtime nếu broker hoặc worker thật được bật.

### Fix Priority

- P0: IDOR/ownership bypass, duplicate booking kéo theo duplicate ride, forged hoặc replayable `ride.created`, price tampering, payment charge từ snapshot/state sai.
- P1: state-aware ABAC chưa rõ, mutate sau lock / sau publish chưa chặn, thiếu cross-service consistency check, retry/failure path có nguy cơ bypass integrity.
- P2: audit/logging chưa đủ traceability, event envelope hygiene chưa hoàn chỉnh, docs/runtime alignment chưa khớp.

### Quick Start for Developer

1. Copy AI prompt bên dưới.
2. Paste vào Codex.
3. Scan các file:
   - `services/booking-service/src/controllers/bookingController.js`
   - `services/booking-service/src/models/Booking.js`
   - `services/booking-service/src/utils/messageBroker.js`
   - `gateway/api-gateway/src/route-registry.js`
   - `gateway/api-gateway/src/validation-schemas.js`
   - `gateway/api-gateway/src/middleware/idempotency.js`
   - `services/pricing-service/src/controllers/pricingController.js`
   - `services/ride-service/src/controllers/ride.controller.js`
   - `services/ride-service/src/services/ride.service.js`
   - `services/payment-service/src/controllers/paymentController.js`
   - `services/payment-service/src/services/paymentService.js`
4. So sánh với checklist.
5. Với mỗi step, ghi riêng:
   - `Observed in repo`
   - `Expected by CAB architecture`
   - `Evidence still needed`
6. Không kết luận PASS cho event integrity, cross-service integrity, ABAC theo state, hoặc audit/logging nếu chưa có evidence runtime/code đủ mạnh.
7. Ghi findings theo template.

### AI Review Prompt

```text
Bạn là security reviewer cho booking-service của CAB-BOOKING.

Ưu tiên đọc:
- services/booking-service/src/controllers/bookingController.js
- services/booking-service/src/models/Booking.js
- services/booking-service/src/routes/bookingRoutes.js
- services/booking-service/src/utils/messageBroker.js
- gateway/api-gateway/src/route-registry.js
- gateway/api-gateway/src/validation-schemas.js
- gateway/api-gateway/src/middleware/idempotency.js
- services/pricing-service/src/controllers/pricingController.js
- services/ride-service/src/controllers/ride.controller.js
- services/ride-service/src/services/ride.service.js
- services/payment-service/src/controllers/paymentController.js
- services/payment-service/src/services/paymentService.js
- message-broker/kafka/topology.json
- platform/architecture/event-contracts.js

Tập trung bắt:
- IDOR
- duplicate booking
- missing idempotency
- forged booking event
- price tampering
- status tampering
- client-controlled userId hoặc priceSnapshot
- cross-service integrity giữa booking / pricing / ride / payment
- state-aware ABAC
- replay / duplicate publish risk
- audit / logging gap

Rules:
- Không assume gateway hoặc frontend đã ràng buộc đúng user.
- Không kết luận an toàn nếu chưa thấy ownership check và event evidence.
- Không PASS nếu chưa chứng minh được:
  - `booking -> ride.created` mapping
  - `priceSnapshot` khớp trusted pricing response
  - duplicate booking không tạo duplicate ride
  - downstream dùng booking state nhất quán
  - payment không charge từ snapshot/state sai
- Nếu broker còn mock, phải ghi rõ đây là gap mức kiến trúc/runtime.
- Mỗi phần phải tách rõ:
  - `Observed in repo`
  - `Expected by CAB architecture`
  - `Evidence still needed`

Đầu ra:
- Findings theo template chuẩn
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
- Gap cần tìm:
  - business integrity đứt đoạn giữa giá, thanh toán, lifecycle, event propagation
  - `booking -> ride.created` mapping không đủ dữ liệu hoặc không có trusted source
  - duplicate booking hoặc broker replay kéo theo duplicate ride
  - downstream dùng booking status không nhất quán
  - payment charge theo snapshot/state sai hoặc không trace ngược về booking

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
  - giữ nguyên logic `Observed in repo / Expected by CAB architecture / Evidence still needed`
  - thêm diff/branch hiện tại nếu bạn đang review code mới
  - yêu cầu AI trả kết quả theo findings template
  - không đánh dấu PASS nếu thiếu evidence runtime cho event integrity, cross-service integrity, state-aware ABAC, hoặc audit/logging

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
