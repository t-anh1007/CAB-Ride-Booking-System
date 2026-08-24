# CAB-BOOKING-SYSTEM — Master Plan hoàn thành dự án

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thành CAB Booking System đạt tối đa điểm theo `final_PROJECT_grading-factor` (121 test case / 12 level), bám sát thiết kế trong `CAB-BOOKING-SYSTEM.pdf`, ngoại trừ các mục đã thống nhất bỏ/thay (xem Scope).

**Architecture:** Microservices Node.js + AI services Python (FastAPI), event-driven qua Kafka, gateway làm PEP (Zero Trust), deploy Docker Swarm single-node. Frontend 3 app React đập đi xây lại với Leaflet + OpenStreetMap.

**Tech Stack:** Node 18+ (ESM, express, node:test + supertest), Python 3.10+ (FastAPI, pytest), Kafka (KRaft), MongoDB/PostgreSQL/Redis (gộp local, tách trên Swarm), React 18 + Vite + Tailwind + react-leaflet, k6 (load test), newman (E2E).

**Spec:** `CAB-BOOKING-SYSTEM.md` (bản trích từ PDF) + `final_PROJECT_grading-factor.extracted.txt` (121 test case). Master plan này bổ sung thiết kế cho phần tài liệu chưa mô tả đủ (mục "Thiết kế bổ sung").

## Global Constraints

- KHÔNG dùng Google Maps / Mapbox ở bất kỳ đâu. Bản đồ frontend: **Leaflet + OpenStreetMap tiles**. Routing/geocoding: **OSRM public API** + **Nominatim**, fallback **Haversine**.
- Level 12 (Prometheus/Grafana/Jaeger/ELK) **hoãn** — không nằm trong plan này. Structured logging JSON giữ nguyên mức hiện có.
- Kubernetes không dùng — deployment target là **Docker Swarm** (đã có `infra/docker-swarm/`).
- Payment PSP, SMTP/SMS/FCM: **mô phỏng** (log/Kafka), không tích hợp bên thứ ba.
- Local compose đã gộp datastore (1 Mongo `mongodb:27017`, 1 Redis `redis:6379`, 2 Postgres) + profiles `ai` — mọi service mới phải theo mô hình này.
- Node test: `node --test`; Python test: `pytest`. Response envelope chuẩn gateway: `{ success, message, data, meta: { requestId, correlationId, timestamp } }`.
- Mọi endpoint mới qua gateway phải đăng ký vào `platform/architecture/service-manifests.js` + `gateway/api-gateway/src/route-registry.js` (roles) nếu cần policy riêng.
- Commit message tiếng Việt hoặc Anh nhất quán theo dạng `<type>: <mô tả>`; commit nhỏ, thường xuyên.

---

## 1. Hiện trạng (khảo sát 2026-08-25)

| Level | Chủ đề | % | Ghi chú |
|---|---|---|---|
| 1 | Basic API | ~85% | Endpoint core đủ; thiếu test |
| 2 | Validation/idempotency | ~70% | Gateway có idempotency middleware; thiếu test edge |
| 3 | Integration/Kafka | ~80% | Kafka producer/consumer rộng; circuit breaker gateway |
| 4 | Transaction/Saga | ~75% | Payment saga choreography hoàn chỉnh; thiếu test |
| 5 | AI validation | ~45% | Có ETA/surge/matching; **thiếu fraud, recommendation, forecast, drift, model_version** |
| 6 | AI Agent + MCP | ~15% | **Gần như chưa có** — phải xây |
| 7 | Performance | ~35% | Chưa có k6/load script |
| 8 | Resilience | ~65% | CB/retry/fallback có; thiếu kịch bản chaos |
| 9 | Security | ~85% | Gateway PEP mạnh: JWT/ABAC/rate-limit/quota |
| 10 | Zero Trust | ~75% | mTLS infra có; cần verify + test |
| 11 | Deployment | ~70% | Swarm đủ script; cần rehearsal rolling/rollback |
| 12 | Monitoring | hoãn | Theo thỏa thuận |

Điểm yếu xuyên suốt: **test coverage chỉ 9 file** — booking/payment/driver/pricing/ride/user/review chưa có test nào.

## 2. Scope — bỏ/thay đã chốt

| Hạng mục | Quyết định |
|---|---|
| Prometheus/Grafana/Jaeger/ELK | Hoãn (thêm sau khi xong) |
| Kubernetes | Thay bằng Docker Swarm |
| Google Maps (cả FE lẫn eta-service) | Bỏ hẳn → Leaflet/OSM + OSRM + Haversine |
| PSP/SMTP/FCM thật | Mô phỏng |

## 3. Thiết kế bổ sung (phần tài liệu chưa mô tả đủ)

### 3.1 AI Agent + MCP Context (Level 6) — module `app/agent/` trong matching-service

Tài liệu chỉ mô tả luồng ý niệm (context → reasoning → decision). Thiết kế cụ thể:

- **MCP Context Builder** (`app/agent/context.py`): gom context từ nhiều nguồn thành một document chuẩn (đúng ví dụ test case 28):
  ```json
  {
    "ride_id": "BK123",
    "pickup": {"lat": 10.76, "lng": 106.66},
    "drop": {"lat": 10.77, "lng": 106.70},
    "available_drivers": [{"id": "D1", "distance_km": 2.0, "rating": 4.8, "status": "ONLINE"}],
    "traffic_level": 0.7, "demand_index": 1.5, "supply_index": 0.8,
    "eta_minutes": 12.5, "price_quote": 58000,
    "sources": {"drivers": "driver-service", "eta": "eta-service", "pricing": "pricing-service", "supply_demand": "redis"},
    "trace_id": "uuid"
  }
  ```
  Nguồn: driver-service `GET /available`, eta-service `POST /api/v1/eta/calculate`, pricing `POST /api/v1/pricing/quote`, Redis keys `supply:zone:*`/`surge_zone:*`. Thiếu nguồn nào → field = null + ghi `missing_sources` (test 55: không crash).
- **Tool clients** (`app/agent/tools.py`): mỗi tool = 1 hàm async có timeout 2s, retry 2 lần backoff 0.5s/1s (test 56), lỗi hết retry → trả `None` + đánh dấu degraded.
- **Decision engine** (`app/agent/decision.py`): multi-objective scoring cho từng driver ONLINE (loại offline — test 57):
  `score = 0.40*norm(1/distance) + 0.25*norm(rating/5) + 0.20*norm(1/eta) + 0.15*norm(1/price)`
  → chọn max score (tests 51–53). Model AI lỗi/context degraded → fallback rule-based nearest-distance (tests 49, 60). Stateless, an toàn concurrent (test 59).
- **Decision log** (test 58): mỗi quyết định log JSON `{trace_id, ride_id, chosen_driver, scores: [...], strategy: "multi-objective"|"fallback-nearest", reasons: [...]}` và lưu Mongo collection `agent_decisions`.
- **API** (router `app/routers/agent.py`):
  - `GET /api/v1/agent/context/{ride_id}?pickup_lat=&pickup_lng=&drop_lat=&drop_lng=` → context document (test 28)
  - `POST /api/v1/agent/decide` body = context (hoặc `ride_id` + tọa độ để tự build) → `{chosen_driver, strategy, trace_id, scores}` (tests 51–60)
- **Tích hợp luồng**: matching consumer (`app/tasks/consumer.py`) khi nhận `ride.created` gọi decision engine thay vì predictor trần; predictor XGBoost trở thành một tín hiệu trong scoring.

### 3.2 ai-insights-service (Level 5 phần thiếu) — service Python mới `AI-ML/ai-insights-service`

FastAPI, port **8002**, profile `ai`, cấu trúc giống surge-pricing-service. Cung cấp 4 nhóm:

- **Fraud** `POST /api/v1/fraud/score` — bắt buộc `user_id, booking_id, amount, payment_method` (thiếu → 400 `missing required fields`, không chạy model — test 17). Scoring rule-based + thống kê:
  `fraud_score = clamp(0..1, 0.35*amount_z + 0.35*velocity + 0.30*route_anomaly)`; `flagged = score > 0.7` (test 43). Lịch sử user lấy từ Mongo `cab_booking_booking.bookings` (read-only).
- **Recommendation** `POST /api/v1/recommendations/drivers` — input danh sách driver + context, output đúng **top-3** đã rank (test 44); tái dùng công thức scoring của agent (import nhẹ, copy công thức — không cross-service import).
- **Forecast** `GET /api/v1/forecast/demand?zone=<zoneId>&horizon=6` — moving-average + hệ số giờ-trong-ngày từ lịch sử booking; output schema cố định `[{"timestamp": ISO8601, "value": float}]` (test 45).
- **Model registry & drift**: mọi response kèm `model_version` (test 46); `GET /api/v1/drift/status` — PSI trên phân phối input trượt (Redis) so baseline; PSI > 0.2 → `drift_detected: true` + publish Kafka `ai.drift.alert` (test 48).

### 3.3 ETA bỏ Google (backend)

`AI-ML/eta-service/src/providers/routing.providers.js`: xoá Google + Mapbox provider; chuỗi provider mặc định: **OSRM** (`https://router.project-osrm.org/route/v1/driving/...`, timeout 2s) → **Haversine** (`distanceKm * 60 / avgSpeedKmh`, avgSpeed từ `eta.config.js`, mặc định 28km/h nội đô). Input outlier (distance > 500km) → clamp + flag (test 50); distance 0 → eta 0 (test 15).

### 3.4 Frontend rebuild (Leaflet + OSM)

- Bỏ `@vis.gl/react-google-maps` cả 3 app. Package chung mới **`packages/web-shared`**: API client (fetch + refresh token + Idempotency-Key), `useRealtime` (WebSocket `/realtime` của gateway, message `type`-based), map components Leaflet (`BaseMap`, `PickupPin`, `DriverMarker`, `RoutePolyline`), status constants (port từ app cũ).
- Geocoding tìm địa chỉ: **Nominatim** `https://nominatim.openstreetmap.org/search?format=json&q=...` (debounce 800ms, tôn trọng usage policy). Vẽ route: OSRM geometry polyline; fallback đường thẳng.
- Màn hình bám PDF: Customer C1–C11, Driver 7 màn, Admin 6 module (chi tiết trong sub-plan frontend).

## 4. Phases & Milestones

| Phase | Nội dung | Sub-plan | Gate hoàn thành |
|---|---|---|---|
| P0 | Baseline xanh: compose core up, smoke script, CI unit-test workflow | Backend T1 | `scripts/smoke.mjs` pass; CI xanh |
| P1 | L1–L4 hardening: test cho 7 service trống, review-service lên Mongo+Kafka, saga tests | Backend T2–T8 | `node --test` pass toàn bộ; tests 1–40 demo được |
| P2 | AI hoàn thiện: ETA de-Google, ai-insights-service, agent+MCP | Backend T9–T13 | tests 41–60 demo được; không còn ref Google |
| P3 | Performance + Resilience: k6, chaos scripts | Backend T14–T15 | tests 61–80 demo được (scale local) |
| P4 | Security & Zero Trust test suite + mTLS verify | Backend T16 | tests 81–100 demo được |
| P5 | Deployment rehearsal Swarm: stack cập nhật service mới, rolling/rollback | Backend T17 | tests 101–110 demo được |
| P6 | Frontend rebuild 3 app (chạy song song từ sau P1) | Frontend F1–F10 | 3 app build + happy-path E2E |
| P7 | E2E tổng: newman collection 121 test case + kịch bản demo 120 phút | Backend T18 | `run-levels.ps1` xanh các level trong scope |

**Thứ tự & song song:** P0 → P1 → (P2 ∥ P6) → P3 → P4 → P5 → P7. Frontend chỉ phụ thuộc hợp đồng API (đã cố định), nên có thể chạy song song từ sau P0/P1.

## 5. Sub-plans

1. **Backend completion:** `docs/superpowers/plans/2026-08-25-backend-completion.md` (T1–T18)
2. **Frontend rebuild:** `docs/superpowers/plans/2026-08-25-frontend-rebuild.md` (F1–F10)

## 6. Định nghĩa "xong" toàn dự án

- Mọi task 2 sub-plan checked; CI xanh.
- `scripts/run-levels.ps1` chạy newman collection pass các level 1–11 (trong scope, mức local scale).
- 3 frontend app build production, demo được luồng: đăng ký/OTP → đặt xe (map Leaflet) → matching (agent) → tracking realtime → payment → rating; Driver nhận/chạy chuyến; Admin xem KPI + bản đồ realtime + surge control.
- Không còn chuỗi "google" trong code nguồn (ngoài docs lịch sử).
