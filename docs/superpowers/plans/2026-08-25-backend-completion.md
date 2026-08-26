# Backend Completion Implementation Plan (Sub-plan 1/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện backend đạt Level 1–11 của grading-factor (121 test case), bổ sung AI Agent + MCP, fraud/recommendation/forecast/drift, bỏ Google Maps khỏi ETA, phủ test cho mọi service.

**Architecture:** Giữ nguyên topology hiện có (9 Node service + gateway + 3 AI Python service), thêm 1 service Python `ai-insights-service`, thêm module `agent` vào matching-service. Mọi thay đổi bám pattern file có sẵn trong từng service.

**Tech Stack:** Node 18 ESM + node:test + supertest; Python FastAPI + pytest + httpx; kafkajs/aiokafka; k6; newman.

**Spec:** `docs/superpowers/plans/2026-08-25-master-plan.md` (mục 3 chứa thiết kế chi tiết) + `final_PROJECT_grading-factor.extracted.txt`.

## Global Constraints

- Kế thừa toàn bộ Global Constraints của master plan.
- Test Node đặt tại `<service>/test/*.test.js`, chạy bằng `node --test test/`; thêm script `"test": "node --test test/"` vào package.json service nếu chưa có.
- Test Python đặt tại `<service>/app/tests/test_*.py`, chạy `python -m pytest app/tests -q`; thêm `pytest` + `httpx` vào requirements.txt nếu thiếu.
- Unit test KHÔNG cần DB/Kafka thật: mock tầng repository/broker (pattern có sẵn ở `services/notification-service/test/notification-service.test.js`). Integration = newman chạy trên compose (T18).
- Response lỗi validation: 400 (thiếu field) / 422 (sai kiểu) — khớp grading test 11–12.

---

### Task T1: Baseline xanh — smoke script + CI

**Files:**
- Create: `scripts/smoke.mjs`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (root — thêm scripts `smoke`, `test:all`)

**Interfaces:**
- Produces: `npm run smoke` (kiểm tra health mọi service đang chạy trong compose); CI chạy unit test Node + Python trên push/PR.

- [ ] **Step 1:** Viết `scripts/smoke.mjs`: mảng targets `[{name:"gateway",url:"http://localhost:3000/health"}, ...]` gồm gateway + 9 service (qua gateway `/api/v1/<svc>/health` nếu service không publish port) + `matching:8000/health`. Với mỗi target: `fetch` timeout 5s, in ✅/❌, exit 1 nếu có ❌.
- [ ] **Step 2:** Chạy `docker compose -f infra/docker-compose/docker-compose.local.yml up -d --build`, đợi healthy, chạy `node scripts/smoke.mjs`. Sửa mọi service đỏ cho tới khi toàn xanh (đây là gate — nếu có bug khởi động do gộp datastore thì fix tại đây).
- [ ] **Step 3:** Viết `.github/workflows/ci.yml`: job `node-tests` (matrix các service có test, `npm ci && npm test`), job `python-tests` (`pip install -r requirements.txt && python -m pytest app/tests -q` cho matching + surge). Trigger: push, pull_request.
- [ ] **Step 4:** Commit: `chore: smoke script + CI unit-test workflow`.

---

### Task T2: review-service — Mongo persistence + Kafka publish thật

**Files:**
- Modify: `services/review-service/src/store.js` (in-memory → Mongo, db `cab_booking_review`, collection `reviews`)
- Modify: `services/review-service/src/routes.js` (`publishReviewCreated` → publish Kafka thật topic `review.created`)
- Modify: `services/review-service/src/index.js` (khởi tạo Mongo client + kafkajs producer; env `MONGO_URI`, `KAFKA_BROKERS` — đã có trong `.env.docker`)
- Create: `services/review-service/test/review-routes.test.js`

**Interfaces:**
- Consumes: Mongo `mongodb://mongodb:27017/cab_booking_review`; Kafka `kafka:9092`.
- Produces: API giữ nguyên 4 endpoint hiện có (contract không đổi); event `review.created` payload `{reviewId, rideId, userId, driverId, rating, timestamp}`.

- [ ] **Step 1:** Viết test (mock store + mock broker, pattern notification-service): tạo review 201; thiếu field 400; rating 6 → 400; duplicate (cùng rideId+userId) → 409; GET driver average đúng trung bình.
- [ ] **Step 2:** `node --test test/` → FAIL (store còn in-memory sync, chữ ký đổi sang async).
- [ ] **Step 3:** Chuyển `store.js` sang async Mongo (`mongodb` driver — thêm dependency, cùng version với booking-service); index unique `{rideId:1, userId:1}` để idempotent ở tầng DB. `publishReviewCreated` dùng producer kafkajs (connect lazy, lỗi thì log — non-blocking giữ nguyên hành vi).
- [ ] **Step 4:** `node --test test/` PASS; `docker compose up -d --build review-service` rồi curl POST qua gateway `/api/v1/reviews` xác nhận 201 + document trong Mongo (`docker exec cab-mongodb mongosh cab_booking_review --eval "db.reviews.countDocuments()"`).
- [ ] **Step 5:** Commit: `feat(review): persist to Mongo + publish review.created`.

---

### Task T3: booking-service tests (grading 3, 4, 6, 11, 12, 19, 31)

**Files:**
- Create: `services/booking-service/test/booking-controller.test.js`
- Modify (nếu test lộ gap): `services/booking-service/src/controllers/bookingController.js`

**Interfaces:**
- Consumes: `bookingController` hiện có (`createBooking`, `cancelBooking`, `getBookingById`, `updateBooking`, `getUserBookings`).

- [ ] **Step 1:** Viết test với express app thật + mock model Booking (jest-free, dùng dependency injection hoặc `mock.method` của node:test):
  - POST thiếu `pickup` → 400, message chứa "pickup" (test 11)
  - `pickup.lat = "abc"` → 422 (test 12)
  - POST hợp lệ → 201, `status === "REQUESTED"`, có `booking_id`, `created_at` (tests 3, 6, 31)
  - GET danh sách theo user → 200, mỗi item có `booking_id`, `status` (test 4)
  - 2 request cùng `Idempotency-Key` → cùng kết quả, model.create gọi đúng 1 lần (test 19; nếu controller chưa xử lý key được gateway forward — bổ sung đọc header `x-idempotency-key` và tra Mongo trước khi tạo)
- [ ] **Step 2:** Run FAIL → sửa controller tối thiểu cho pass (chỉ đụng validation/idempotency nếu thiếu).
- [ ] **Step 3:** `node --test test/` PASS. Commit: `test(booking): cover create/validation/idempotency`.

---

### Task T4: payment-service saga tests (grading 33, 34, 36, 37, 86)

**Files:**
- Create: `services/payment-service/test/payment-saga.test.js`

**Interfaces:**
- Consumes: `paymentService.js`, `constants.js` (PAYMENT_STATUSES, PAYMENT_SAGA_STATUSES), `paymentStore.js` (mock).

- [ ] **Step 1:** Viết test mock repository + mock eventPublisher:
  - Create payment → PENDING; confirm success → COMPLETED + publish `payment.completed` (test 36)
  - Confirm với provider fail → FAILED + publish `payment.failed`; saga status FAILED (test 37 phần fail)
  - Refund sau COMPLETED → REFUNDED + `payment.refunded` (compensation — test 37)
  - Gọi confirm 2 lần cùng payment → lần 2 không đổi state, không publish thêm (idempotent/replay — tests 34, 86)
  - `payment_method: "invalid_card"` → 400, provider không được gọi (test 14)
- [ ] **Step 2:** Run FAIL → sửa service tối thiểu nếu lộ gap (không refactor).
- [ ] **Step 3:** PASS + commit: `test(payment): saga transitions, compensation, idempotency`.

---

### Task T5: ride-service lifecycle tests (grading 27, 32)

**Files:**
- Create: `services/ride-service/test/ride-lifecycle.test.js`

**Interfaces:**
- Consumes: `ride.service.js` (state machine REQUESTED→ASSIGNED→ACCEPTED→STARTED→COMPLETED/CANCELLED).

- [ ] **Step 1:** Test (mock repo + mock kafka publisher): accept từ ASSIGNED → ACCEPTED + publish `ride.status.changed` (test 27); chuyển trạng thái không hợp lệ (COMPLETED → STARTED) → error, repo không ghi (test 32 tính nhất quán); complete → COMPLETED có timestamp.
- [ ] **Step 2:** FAIL → fix tối thiểu → PASS → commit: `test(ride): lifecycle state machine`.

---

### Task T6: pricing + surge quy tắc bất biến (grading 8, 16, 22, 42, 63)

**Files:**
- Create: `services/pricing-service/test/pricing-invariants.test.js`
- Modify (nếu vi phạm): `services/pricing-service/src/utils/surge-service.js`

**Interfaces:**
- Consumes: `evaluateSurge({zoneId})`, `getQuote` controller.

- [ ] **Step 1:** Test:
  - `demand=0, supply=1` → `surgeMultiplier === 1` (không < 1, không chia 0 — test 16)
  - `demand=2, supply=1` → surge > 1 và ≤ 3.0 (cap — test 42)
  - Quote luôn `amount > 0` và ≥ baseFare (test 8)
  - Surge-service (AI) timeout → fallback formula, response vẫn hợp lệ với `surgeSource: "formula-fallback"` (tests 30, 63, 72)
- [ ] **Step 2:** FAIL → enforce trong `surge-service.js`: `surge = Math.min(3.0, Math.max(1.0, computed))` → PASS → commit: `test(pricing): surge invariants + fallback`.

---

### Task T7: driver-service + user-service tests (grading 5, 13, 23, 57)

**Files:**
- Create: `services/driver-service/test/driver-controller.test.js`
- Create: `services/user-service/test/user-routes.test.js`

- [ ] **Step 1:** Driver test (mock model + mock redis): go-online → status ONLINE + ghi geo Redis (test 5); go-offline → không xuất hiện trong `GET /available` (tests 13, 57); `PATCH /:id/location` cập nhật `supply:zone:*`.
- [ ] **Step 2:** User test: GET profile tồn tại → 200; không tồn tại → 404; update profile hợp lệ → 200.
- [ ] **Step 3:** FAIL → fix tối thiểu → PASS → commit: `test(driver,user): status & profile coverage`.

---

### Task T8: Kafka contract test — outbox/replay an toàn (grading 25, 38, 73)

**Files:**
- Create: `services/booking-service/test/event-publish.test.js`
- Modify (nếu cần): `services/booking-service/src/utils/messageBroker.js`

- [ ] **Step 1:** Test: tạo booking thành công → publish `ride.created` payload đủ `{event_type|type, ride_id/booking_id, pickup, timestamp}` (test 25); **Kafka down (producer throw)** → booking VẪN tạo thành công, event được đẩy vào retry-buffer trong Mongo collection `outbox_events` và flush khi producer hồi phục (tests 38, 73).
- [ ] **Step 2:** FAIL → thêm outbox tối giản vào `messageBroker.js`: `publish()` catch lỗi → `db.outbox_events.insertOne({topic, payload, createdAt})`; interval 10s đọc outbox → publish → xoá. Không thêm library mới.
- [ ] **Step 3:** PASS → commit: `feat(booking): outbox buffer for kafka outage`.

---

### Task T9: ETA — bỏ Google/Mapbox, mặc định OSRM → Haversine (grading 7, 15, 21, 41, 50)

**Files:**
- Modify: `AI-ML/eta-service/src/providers/routing.providers.js` (xoá googleProvider + mapboxProvider; giữ osrmProvider + haversineProvider)
- Modify: `AI-ML/eta-service/src/eta.config.js` (provider chain `["osrm","haversine"]`, `avgSpeedKmh: 28`, `maxDistanceKm: 500`)
- Create: `AI-ML/eta-service/test/eta-service.test.js`

**Interfaces:**
- Produces: `POST /api/v1/eta/calculate {origin:{lat,lng}, destination:{lat,lng}}` → `{success, data:{distanceKm, etaMinutes, provider}}` (contract hiện có — pricing-service đang gọi, KHÔNG đổi).

- [ ] **Step 1:** Test: same-point → `etaMinutes === 0` không âm (test 15); 5km haversine → eta trong (0, 60) (tests 7, 41); OSRM mock lỗi → fallback haversine, `provider === "haversine"`; distance 1000km → clamp 500km + `clamped: true`, không crash (test 50).
- [ ] **Step 2:** FAIL → xoá 2 provider Google/Mapbox, cấu hình chain, thêm clamp → PASS.
- [ ] **Step 3:** `grep -ri "google\|mapbox" AI-ML/eta-service/src` → 0 kết quả. Commit: `feat(eta)!: replace Google/Mapbox with OSRM+haversine`.

---

### Task T10: ai-insights-service — scaffold + Fraud API (grading 17, 43)

**Files:**
- Create: `AI-ML/ai-insights-service/` (copy skeleton từ `AI-ML/surge-pricing-service`: `app/main.py`, `app/config.py`, `app/database.py`, `app/routers/health.py`, `Dockerfile`, `requirements.txt`, `.env.docker` + `.example`)
- Create: `AI-ML/ai-insights-service/app/routers/fraud.py`
- Create: `AI-ML/ai-insights-service/app/serve/fraud_scorer.py`
- Create: `AI-ML/ai-insights-service/app/tests/test_fraud.py`

**Interfaces:**
- Produces: `POST /api/v1/fraud/score` — request `{user_id, booking_id, amount, payment_method, location?}`; response `{fraud_score: float 0..1, flagged: bool, threshold: 0.7, reasons: [str], model_version: "fraud-rules-1.0.0"}`; thiếu field bắt buộc → 400 `{"detail": "missing required fields: [...]"}`.

- [ ] **Step 1:** Viết `test_fraud.py` (FastAPI TestClient):

```python
def test_missing_fields_returns_400(client):
    r = client.post("/api/v1/fraud/score", json={"user_id": "USR123"})
    assert r.status_code == 400
    assert "missing required fields" in r.json()["detail"]

def test_high_amount_velocity_flagged(client, seeded_history):
    r = client.post("/api/v1/fraud/score", json={
        "user_id": "USR123", "booking_id": "BK9", "amount": 5_000_000, "payment_method": "card"})
    body = r.json()
    assert body["fraud_score"] > 0.7 and body["flagged"] is True

def test_normal_txn_not_flagged(client, seeded_history):
    r = client.post("/api/v1/fraud/score", json={
        "user_id": "USR123", "booking_id": "BK10", "amount": 55_000, "payment_method": "cash"})
    assert r.json()["flagged"] is False
```

- [ ] **Step 2:** `python -m pytest app/tests -q` → FAIL.
- [ ] **Step 3:** Implement `fraud_scorer.py`:

```python
MODEL_VERSION = "fraud-rules-1.0.0"
THRESHOLD = 0.7

def score(amount: float, history_amounts: list[float], txn_last_hour: int,
          distance_km: float | None) -> tuple[float, list[str]]:
    reasons = []
    mean = sum(history_amounts) / len(history_amounts) if history_amounts else amount
    std = (sum((a - mean) ** 2 for a in history_amounts) / len(history_amounts)) ** 0.5 if history_amounts else 1.0
    amount_z = min(1.0, abs(amount - mean) / (3 * std)) if std > 0 else 0.0
    if amount_z > 0.5: reasons.append("amount_anomaly")
    velocity = min(1.0, txn_last_hour / 5.0)
    if velocity > 0.5: reasons.append("velocity_high")
    route_anomaly = min(1.0, (distance_km or 0) / 100.0)
    if route_anomaly > 0.5: reasons.append("route_anomaly")
    return round(0.35 * amount_z + 0.35 * velocity + 0.30 * route_anomaly, 4), reasons
```

  Router validate field bắt buộc thủ công (trả 400 chứ không để Pydantic 422 — khớp wording test 17), lấy history từ Mongo `cab_booking_booking.bookings` (`config.MONGO_URI`), degrade về history rỗng nếu Mongo lỗi.
- [ ] **Step 4:** pytest PASS. Commit: `feat(ai-insights): scaffold + fraud scoring API`.

---

### Task T11: ai-insights — Recommendation + Forecast (grading 44, 45)

**Files:**
- Create: `AI-ML/ai-insights-service/app/routers/recommendations.py`, `app/routers/forecast.py`
- Create: `AI-ML/ai-insights-service/app/serve/recommender.py`, `app/serve/forecaster.py`
- Create: `AI-ML/ai-insights-service/app/tests/test_recommend_forecast.py`

**Interfaces:**
- Produces:
  - `POST /api/v1/recommendations/drivers` request `{drivers: [{id, distance_km, rating, eta_minutes?, status}], top_n?: 3}` → `{recommendations: [{id, score, rank}], model_version}` — đúng `top_n` phần tử, loại status != "ONLINE".
  - `GET /api/v1/forecast/demand?zone=<id>&horizon=6` → `{zone, horizon, model_version, forecast: [{timestamp, value}]}` (đúng schema — test 45).

- [ ] **Step 1:** Test: 5 driver (1 offline) top_n=3 → đúng 3, không chứa offline, rank 1 có score cao nhất; forecast horizon=6 → 6 phần tử, timestamp ISO tăng dần, value ≥ 0.
- [ ] **Step 2:** FAIL → implement: recommender dùng công thức scoring mục 3.1 master plan (`0.40/0.25/0.20/0.15`, chuẩn hóa min-max trong batch); forecaster: đếm booking theo giờ 7 ngày gần nhất từ Mongo → trung bình theo hour-of-day, projection `now+1h..now+Nh`; Mongo lỗi → dùng baseline phẳng `value = 1.0` + flag `degraded: true`.
- [ ] **Step 3:** PASS → commit: `feat(ai-insights): driver recommendations + demand forecast`.

---

### Task T12: ai-insights — model registry + drift detection (grading 46, 48)

**Files:**
- Create: `AI-ML/ai-insights-service/app/serve/drift.py`, `app/routers/drift.py`
- Modify: `app/main.py` (middleware gắn `model_version` vào mọi response JSON của service; include routers)
- Create: `app/tests/test_drift.py`

**Interfaces:**
- Produces: `GET /api/v1/drift/status?feature=amount` → `{feature, psi, drift_detected, baseline_window, current_window, model_version}`; PSI > 0.2 → publish Kafka `ai.drift.alert` `{feature, psi, timestamp}`.
- Mỗi lần fraud/recommend được gọi, giá trị input chính (`amount`, `distance_km`) push vào Redis list `drift:{feature}` (LPUSH + LTRIM 1000).

- [ ] **Step 1:** Test PSI thuần: hai phân phối giống nhau → psi < 0.1, không alert; phân phối lệch (baseline N(50k,10k) vs current N(500k,50k)) → psi > 0.2, `drift_detected` true, producer mock được gọi.
- [ ] **Step 2:** FAIL → implement PSI 10-bucket chuẩn:

```python
def psi(baseline: list[float], current: list[float], buckets: int = 10) -> float:
    lo, hi = min(baseline), max(baseline)
    edges = [lo + (hi - lo) * i / buckets for i in range(buckets + 1)]
    def dist(values):
        counts = [0] * buckets
        for v in values:
            idx = min(buckets - 1, max(0, next((i for i in range(buckets) if v <= edges[i + 1]), buckets - 1)))
            counts[idx] += 1
        total = len(values) or 1
        return [max(c / total, 1e-4) for c in counts]
    b, c = dist(baseline), dist(current)
    from math import log
    return sum((ci - bi) * log(ci / bi) for bi, ci in zip(b, c))
```

- [ ] **Step 3:** PASS → commit: `feat(ai-insights): model versioning + PSI drift detection`.

---

### Task T13: AI Agent + MCP context trong matching-service (grading 23, 28, 51–60)

**Files:**
- Create: `AI-ML/matching-service/app/agent/__init__.py`, `app/agent/tools.py`, `app/agent/context.py`, `app/agent/decision.py`
- Create: `AI-ML/matching-service/app/routers/agent.py`
- Modify: `AI-ML/matching-service/app/main.py` (include agent router)
- Modify: `AI-ML/matching-service/app/tasks/consumer.py` (dùng decision engine khi xử lý `ride.created`)
- Create: `AI-ML/matching-service/app/tests/test_agent.py`

**Interfaces:** (đúng thiết kế mục 3.1 master plan)
- `GET /api/v1/agent/context/{ride_id}` (+query pickup/drop) → MCP context document (test 28)
- `POST /api/v1/agent/decide` → `{chosen_driver: {id, ...}, strategy, trace_id, scores: [{id, score, components}], reasons: [str]}`
- `tools.py`: `async fetch_available_drivers()`, `fetch_eta(o, d)`, `fetch_price(o, d, vehicle_type)` — timeout 2s, retry 2 (0.5s/1s backoff), hết retry → None.

- [ ] **Step 1:** Viết `test_agent.py` — mock tools bằng dependency injection:

```python
def test_agent_picks_nearest_when_equal_rating():       # test 51
    ctx = make_ctx(drivers=[d("D1", 5, 4.5), d("D2", 2, 4.5), d("D3", 3, 4.5)])
    assert decide(ctx).chosen_driver["id"] == "D2"

def test_agent_weighs_rating_not_only_distance():        # test 52
    ctx = make_ctx(drivers=[d("D1", 2.0, 4.0), d("D2", 2.2, 4.9)])
    assert decide(ctx).chosen_driver["id"] == "D2"

def test_agent_excludes_offline():                       # test 57
    ctx = make_ctx(drivers=[d("D1", 1, 5.0, status="OFFLINE"), d("D2", 9, 3.0)])
    assert decide(ctx).chosen_driver["id"] == "D2"

def test_agent_fallback_rule_based_on_scorer_error():    # tests 49, 60
    result = decide(make_ctx(), scorer=raise_error)
    assert result.strategy == "fallback-nearest" and result.chosen_driver

def test_agent_missing_context_no_crash():               # test 55
    result = decide(make_ctx(eta_minutes=None, price_quote=None))
    assert result.chosen_driver and "missing_sources" in result.meta

def test_agent_logs_decision_with_trace_id(caplog):      # test 58
    r = decide(make_ctx())
    assert r.trace_id and any(r.trace_id in m for m in caplog.messages)

def test_tools_retry_then_none(monkeypatch):             # test 56
    calls = flaky(fail_times=3)
    assert await_(fetch_eta_with(calls)) is None and calls.count == 3
```

- [ ] **Step 2:** pytest FAIL → implement `decision.py` scoring đúng công thức master plan 3.1 (min-max normalize trong batch; thiếu eta/price → bỏ thành phần đó và renormalize trọng số); `context.py` build document + `missing_sources`; log JSON quyết định + insert Mongo `agent_decisions` (fire-and-forget); router; consumer tích hợp (giữ predictor XGBoost là 1 component score khi có).
- [ ] **Step 3:** pytest PASS. Smoke qua compose: `curl -X POST localhost:8000/api/v1/agent/decide -d @sample-context.json` trả chosen_driver.
- [ ] **Step 4:** Đăng ký route family `agent` (nếu expose qua gateway) trong `service-manifests.js` — hoặc xác nhận gọi nội bộ qua matching family hiện có. Commit: `feat(matching): AI agent decision engine + MCP context API`.

---

### Task T14: Load test k6 (grading 61–63, 66–69)

**Files:**
- Create: `tests/load/booking-load.js`, `tests/load/eta-load.js`, `tests/load/spike-pricing.js`
- Create: `tests/load/README.md` (ngưỡng local-scale + cách đọc kết quả)

**Interfaces:**
- Chạy: `k6 run tests/load/booking-load.js` (yêu cầu cài k6 — ghi trong README, `winget install k6`).

- [ ] **Step 1:** `booking-load.js`: ramp 10→100 VUs 2 phút (local-scale của "1000 rps"), POST `/api/v1/bookings` kèm JWT test + Idempotency-Key ngẫu nhiên; thresholds: `http_req_failed<0.05`, `http_req_duration{p(95)}<300` (test 61, 68).
- [ ] **Step 2:** `eta-load.js`: 50 VUs constant 1 phút POST eta/calculate; threshold p95 < 200ms (tests 62, 47). `spike-pricing.js`: spike 5→80 VUs trong 10s (test 63), assert surge trong [1, 3].
- [ ] **Step 3:** Chạy cả 3 trên compose, lưu output vào `tests/load/results/` (gitignore), ghi số liệu tóm tắt vào README. Commit: `test(load): k6 scenarios for booking/eta/pricing`.

---

### Task T15: Chaos/failure scripts (grading 71–80)

**Files:**
- Create: `scripts/chaos/kill-service.ps1` (param ServiceName; `docker stop cab-<name>`; gọi API xác nhận degrade; `docker start` lại)
- Create: `scripts/chaos/kafka-outage.ps1` (stop kafka → tạo booking → start kafka → xác nhận outbox flush, event tới notification)
- Create: `scripts/chaos/RUNBOOK.md` — bảng map test 71–80 → lệnh + expected

**Interfaces:**
- Consumes: outbox T8, circuit breaker gateway, fallback pricing T6.

- [ ] **Step 1:** Viết RUNBOOK.md: mỗi row = test id, lệnh chaos, hành vi mong đợi (71: stop driver-service → booking vẫn 201 PENDING; 72: pause pricing → quote fallback; 73: kafka outage → outbox giữ event; 75: 5 lần lỗi liên tiếp → CB open trả 503 ngay; 77: quan sát retry backoff trong log; 80: stop AI services → core booking vẫn chạy).
- [ ] **Step 2:** Viết 2 script PS1 tự động hoá kịch bản 71 và 73 end-to-end (assert bằng curl + exit code).
- [ ] **Step 3:** Chạy cả 2 script pass trên compose. Commit: `test(chaos): failure scenario scripts + runbook`.

---

### Task T16: Security test suite (grading 81–100)

**Files:**
- Create: `tests/security/security-suite.test.js` (chạy bằng `node --test`, target gateway đang chạy: env `GATEWAY_URL=http://localhost:3000`)
- Create: `tests/security/README.md` (map test id 81–100 → case; ghi rõ case mTLS 88/94 chạy bằng compose mtls profile)

- [ ] **Step 1:** Viết các case tự động được:
  - Login body `' OR 1=1 --` → 400/401, không 500 (test 81)
  - Comment review chứa `<script>` → lưu và trả về đã escape hoặc nguyên văn nhưng `Content-Type: application/json` (không thực thi — test 82, assert không có header HTML)
  - JWT sửa payload (đổi role → ADMIN, giữ signature cũ) → 401 (tests 83, 92)
  - Không token → 401 "Missing token" (test 91); token expired → 401 (tests 18, 93)
  - Role USER gọi `/api/v1/users` (admin-only) → 403 (tests 84, 89, 95)
  - Vượt rate limit auth (>100 req/60s) → 429 (tests 85, 98)
  - Replay cùng Idempotency-Key payment → response cũ, không double (test 86)
- [ ] **Step 2:** Chạy trên compose → fix gap nếu lộ (chỉ tối thiểu). README ghi kết quả + hướng dẫn chạy `docker-compose.mtls.yml` + `infra/mtls/generate-dev-certificates.ps1` để demo 88/94/99.
- [ ] **Step 3:** Commit: `test(security): automated L9/L10 suite`.

---

### Task T17: Swarm cập nhật + deployment rehearsal (grading 101–110)

**Files:**
- Modify: `infra/docker-swarm/docker-stack.yml` (thêm `ai-insights-service`; cập nhật image list trong `build-images.sh`/`push-images.sh`)
- Create: `scripts/deploy/rehearsal.ps1` — kịch bản: deploy stack → health check → `docker service update --image <new>` (rolling, test 106) → `docker service scale` (test 107) → `docker service rollback` (test 110)
- Modify: `AI-ML/ai-insights-service/app/config.py` — fail-fast khi `MONGO_URI` sai định dạng (exit non-zero, log rõ — test 109)

- [ ] **Step 1:** Thêm ai-insights vào stack (per-service DB giữ nguyên như thiết kế swarm hiện có), build/push scripts.
- [ ] **Step 2:** Chạy rehearsal trên swarm single-node local (`docker swarm init` nếu chưa): xác nhận rolling không downtime (curl loop trong lúc update), rollback về image cũ.
- [ ] **Step 3:** Ghi kết quả vào `infra/docker-swarm/QUICK_REFERENCE.md` (mục Rehearsal). Commit: `infra(swarm): add ai-insights + rolling/rollback rehearsal`.

---

### Task T18: Newman E2E master collection theo level (P7)

**Files:**
- Create: `tests/e2e/cab-levels.postman_collection.json` (folder per level 1–11; port từ `colllection_lv6.json` những request dùng được)
- Create: `tests/e2e/local.postman_environment.json` (gateway URL, seed accounts từ `database_test/*-seed.sql`)
- Create: `scripts/run-levels.ps1` (param `-Level`; `npx newman run ... --folder "Level $Level"`)

- [ ] **Step 1:** Dựng folder Level 1: register (201), login OTP (200 + JWT decode), booking create (201 REQUESTED), booking list, driver online, eta > 0, pricing quote, notification, logout → 401 khi dùng lại token. Mỗi request có test script assert đúng expected của grading.
- [ ] **Step 2:** Level 2–6: validation 400/422, token expired, idempotency, kafka flow (booking → notification qua polling API), agent decide, fraud/recommend/forecast/drift.
- [ ] **Step 3:** Chạy `scripts/run-levels.ps1 -Level 1` → xanh; lặp tới level 6; level 7–11 tham chiếu k6/chaos/security/swarm artifacts (T14–T17) trong collection description.
- [ ] **Step 4:** Commit: `test(e2e): newman collection per grading level + runner`.

---

## Self-Review checklist (đã chạy khi viết plan)

- Coverage: tests 1–110 đều có task tương ứng (1–15→T3/T6/T7/T9/T18; 16–24→T3/T6/T13/T18; 25–40→T2/T4/T5/T8; 41–60→T9–T13; 61–70→T14; 71–80→T15; 81–100→T16; 101–110→T17). Tests 111–120 (L12) ngoài scope theo master plan.
- Không placeholder: mọi endpoint/formula/status code ghi cụ thể; boilerplate tham chiếu file mẫu có thật trong repo.
- Type consistency: response envelope + tên endpoint thống nhất với route-registry và code hiện có.
