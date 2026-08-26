# Báo cáo Benchmark — CAB Booking System

**Ngày tổng hợp:** 2026-08-26
**Phạm vi:** hiệu năng tải (load/performance) và bảo mật (Zero-Trust / Auth) của
nền tảng đặt xe microservices.
**Baseline mã nguồn:** git commit `aa665d3bdd6a2dbd48d773e677035d8e3ac0864e`.

Báo cáo gồm hai nhóm số đo độc lập:

1. **Hiệu năng tải** — đo bằng [k6](https://k6.io) trên stack Docker Compose
   (booking, ETA, pricing).
2. **Bảo mật / Zero-Trust** — đo trực tiếp trên mã nguồn `api-gateway` và
   `auth-service` (JWT/JWKS, RBAC/ABAC, mTLS, Argon2id).

Mọi số liệu là **đo thực tế**, không mô phỏng. Mỗi phép đo có file bằng chứng thô
kèm mã băm SHA-256 để kiểm chứng tính toàn vẹn (xem mục 4).

---

## 1. Hiệu năng tải (k6)

**Môi trường đo:** laptop dev, stack Docker Compose cục bộ (gateway + service +
MongoDB/Redis/Kafka), k6 chạy qua container `grafana/k6`. Số đo thô sinh trực tiếp
từ k6, lưu tại `.agents/governance/runtime/p3-*-summary.json`.

**Đặc điểm chung:** tất cả kịch bản đạt **0% HTTP request thất bại** và
**100% checks passed**, kể cả khi booking đẩy lên 100 VU đồng thời và pricing
spike 80 VU.

### 1.1 Booking — tác động của tối ưu đường ghi

Booking được đo ở hai mốc: **baseline** ban đầu và **sau khi tối ưu** đường ghi
(bounded Kafka dispatcher + transactional outbox spill/replay), trên cùng cấu hình.

| Chỉ số | Baseline | Sau tối ưu | Thay đổi |
|--------|----------|-----------|----------|
| Kịch bản | Gateway ramp 1→100 VU | Gateway ramp 10→100 VU / 2 phút | — |
| Số request | 7.686 | **13.424** | +74,6% |
| Checks passed | 7.686 / 7.686 (100%) | **13.424 / 13.424 (100%)** | — |
| HTTP failed | 0% | **0%** | — |
| Throughput | 63,8 req/s | **111,1 req/s** | **+74%** |
| p95 latency | 1.150,9 ms | **679,9 ms** | **−41%** |
| avg latency | 557,6 ms | 277,4 ms | −50% |
| median latency | 454,6 ms | 245,6 ms | −46% |

**Phân tích nút thắt (đo bổ trợ):** một loạt phép đo cô lập cho thấy điểm nghẽn
nằm ở đường ghi booking khi có nhiều request đồng thời — không phải ở API Gateway.

| Cấu hình đo | Tải | Số request | p95 latency |
|-------------|-----|-----------|-------------|
| Gateway, baseline trước bounded dispatcher | 10→100 VU | 8.095 | 1.288,7 ms |
| Trực tiếp booking-service (bỏ gateway) | 100 VU | 5.418 | 559,5 ms |
| Booking-service + MongoDB khởi tạo mới | 100 VU | 3.911 | 707,97 ms |
| Prototype raw-insert (thử nghiệm) | 100 VU | 5.218 | 603,15 ms |
| Baseline đơn luồng | 1 VU | — | **25,72 ms** |

Chênh lệch p95 giữa 1 VU (25,72 ms) và 100 VU (~680 ms) xác định điểm bão hòa nằm
ở luồng ingest đồng thời; đo trực tiếp service (559,5 ms) cho thấy gateway không
phải nguyên nhân chính; đo trên MongoDB mới (707,97 ms) loại trừ giả thuyết dữ
liệu tích lũy.

### 1.2 ETA — qua gateway và cache nóng

| Cấu hình đo | Tải | Số request | Checks | HTTP failed | p95 latency | avg | Throughput |
|-------------|-----|-----------|--------|-------------|-------------|-----|-----------|
| ETA qua gateway đầy đủ | 50 VU / 1 phút | 9.872 | 9.872 / 9.872 | 0% | 340,98 ms | 253,5 ms | ~164 req/s |
| ETA cache nóng, trực tiếp service | 50 VU | 36.742 | 36.741 / 36.741 | 0% | **82,34 ms** | 30,7 ms | **~604 req/s** |

Cùng eta-service, chênh lệch p95 (340,98 ms qua gateway so với 82,34 ms trực tiếp
với cache nóng) cho thấy phần lớn độ trễ đến từ đường mạng và middleware gateway.

### 1.3 Pricing / Surge — spike test

| Chỉ số | Giá trị |
|--------|---------|
| Kịch bản | Spike 5 → 80 VU trong 10 giây |
| Số request | 3.508 |
| Checks passed | 3.508 / 3.508 (100%) |
| HTTP failed | 0% |
| Surge value | hợp lệ, trong khoảng 1–3 |
| Throughput | ~85,5 req/s |
| p95 latency | 1.471,9 ms |
| avg latency | 646,1 ms |
| median latency | 603,6 ms |

---

## 2. Bảo mật / Zero-Trust

**Môi trường đo:** Node v22.18.0, Windows 11. Đo trực tiếp trên mã nguồn thật của
`gateway/api-gateway` và `services/auth-service` (module `authorization.js`,
`abac.js`, `internal-auth-headers.js`, `jwt-service.js`, `lib/password.js` +
crypto `jose` RS256 cấu hình giống production). Ngày đo: 2026-08-20.

| # | Hạng mục | Kết quả đo | Phương pháp |
|---|----------|-----------|-------------|
| 1 | Overhead xác thực JWT / request | Verify RS256 **p50 0,095 ms · p95 0,20 ms · p99 0,31 ms** | 5.000 mẫu `jose.jwtVerify` + `createLocalJWKSet` |
| 2 | Throughput verify JWT (1 core) | **8.732 token/giây** (RS256, khóa 2048-bit) | 5.000 vòng verify tuần tự |
| 3 | Độ trễ quyết định phân quyền | RBAC **~0,4 µs** · ABAC **~0,6 µs** / quyết định | 50.000 & 20.000 mẫu qua middleware thật |
| 4 | Hiệu quả cache JWKS | Giảm **99,99%** fetch khóa (1 fetch / 10.000 verify) | Đếm số lần gọi JWKS, TTL 60s |
| 5 | Độ phủ chặn broken-access | **0% broken-access** — chặn 11/11 ca vượt quyền, đúng 15/15 ca (100%) | Ma trận negative/positive qua `authorization.js` + ABAC |
| 6 | Chống brute-force login | Khóa sau **5 lần sai** (OTP 300s · admin 15 phút) + rate-limit gateway (429) | Đọc tham số enforce trong config/logic thật |
| 7 | Chống giả mạo header nội bộ | **100% (10.000/10.000)** header giả bị vô hiệu hóa | `applyForwardedAuthHeaders` với header giả mạo |
| 8 | Overhead mTLS service-to-service | **+1,7 ms/handshake** (p50 1,1 → 2,8 ms) | 1.500 mẫu, mTLS vs HTTP localhost |
| 9 | Băm mật khẩu Argon2id | **~27 ms/hash** (p95 39,2 ms), memory-hard **19 MB** | 20 lần `argon2.hash` tham số production |

**Ghi chú phương pháp:**
- #1 là chi phí crypto thuần; bước gọi `/auth/me` (xác thực ngữ cảnh) là network
  hop riêng, không tính vào đây.
- #2 đo đơn luồng tuần tự; chạy song song nhiều lõi/replica sẽ scale gần tuyến tính.
- #8: con số tuyệt đối (+1,7 ms) đo trên localhost với cert ephemeral; chi phí này
  được khấu hao gần bằng 0 khi bật keep-alive.

Chi tiết đầy đủ: [docs/benchmarks/security/cv-security-metrics-2026-08-20.md](docs/benchmarks/security/cv-security-metrics-2026-08-20.md).

---

## 3. Tái tạo số liệu

### 3.1 Bảo mật
Không cần full Docker stack cho #1–#5, #7, #9:
```bash
node docs/benchmarks/security/sec-bench.mjs    # #1-#5, #7, Argon2id
node docs/benchmarks/security/mtls-bench.mjs   # #8 (cần openssl trong PATH)
```
Tham số brute-force (#6) đọc từ `services/auth-service/src/config/env.js`. Script
không dùng mock hay seed cố định — chạy sẽ in ra chính các con số trong bảng mục 2.

### 3.2 Hiệu năng tải
Cần dựng compose stack + k6. Hướng dẫn setup, cờ `GATEWAY_LOAD_TEST_MODE=true` và
điều kiện tiền đề (seed `supply:zone`, TEST_JWT, TEST_USER_ID) nằm trong
[tests/load/README.md](tests/load/README.md). Script:
`tests/load/booking-load.js`, `tests/load/eta-load.js`, `tests/load/spike-pricing.js`.

Muốn bằng chứng trực quan: chạy k6 trong terminal và chụp bảng metrics cuối, hoặc
xuất `--out json=results.json` rồi import vào Grafana (dashboard
[k6 Load Testing Results #2587](https://grafana.com/grafana/dashboards/2587)).

---

## 4. Bằng chứng và tính toàn vẹn

Mỗi số đo có file thô (JSON k6 hoặc script), niêm phong bằng **SHA-256** tại
baseline git `aa665d3`. Kiểm chứng:
```powershell
git checkout aa665d3bdd6a2dbd48d773e677035d8e3ac0864e
Get-FileHash -Algorithm SHA256 <đường-dẫn-file>
# đối chiếu chuỗi hex với bảng dưới
```

### 4.1 Hiệu năng tải — số đo thô (k6)

| File | SHA-256 | Phép đo |
|------|---------|---------|
| [p3-r9-booking-summary.json](.agents/governance/runtime/p3-r9-booking-summary.json) | `6cc6f6717d9073d11f9c581e81a2636f3012d5b6d651319dae2cef0caa64b0e2` | Booking baseline (1.1) |
| [p3-r11-booking-summary.json](.agents/governance/runtime/p3-r11-booking-summary.json) | `79b73e835c33853d38dd46a297bbda93029f73e8411dbfaa0acd84591e355afb` | Booking sau tối ưu (1.1) |
| [p3-r10-booking-summary.json](.agents/governance/runtime/p3-r10-booking-summary.json) | `779914cd10e4598bbb73ad2d41caa799a15a7f32509bab3309eeb60c1f0c75cb` | Booking diag gateway (1.1) |
| [p3-r11-booking-direct-100vu-summary.json](.agents/governance/runtime/p3-r11-booking-direct-100vu-summary.json) | `57c2b5aa953088c377f4b5485d60ed289d42c91ba20f3ab592b3b48136e0d713` | Booking diag direct-service (1.1) |
| [p3-r11-booking-fresh-100vu-summary.json](.agents/governance/runtime/p3-r11-booking-fresh-100vu-summary.json) | `6d8b77e189c8916b55640dff8711f288591e2a75e133f050cb504cf9410af7a4` | Booking diag fresh-Mongo (1.1) |
| [p3-r12-booking-prototype-100vu-summary.json](.agents/governance/runtime/p3-r12-booking-prototype-100vu-summary.json) | `7ff5456fd23a2dbba261c55eb931865af3e2a8a56591e78da833e710a01071e8` | Booking diag prototype (1.1) |
| [p3-eta-summary.json](.agents/governance/runtime/p3-eta-summary.json) | `98626213ac324844e6b59b25b16647ee0c8170a7951ab5af1853155ab332d62a` | ETA gateway (1.2) |
| [p3-r3-eta-summary.json](.agents/governance/runtime/p3-r3-eta-summary.json) | `0482741fca1d6ec88f14affaf2d99fb287027d5eeebbf126b9c130838eaab289` | ETA hot-cache direct (1.2) |
| [p3-r4-pricing-summary.json](.agents/governance/runtime/p3-r4-pricing-summary.json) | `517cf62513de135165b9facccfc6d18dffa797f28c1f63ee9e8137975c2c0de2` | Pricing spike (1.3) |

**Kiểm tra toàn vẹn độc lập:** các báo cáo dưới đây băm chéo lại số đo thô và chạy
lại kiểm thử, đều xác nhận `evidence_integrity: VALID`, `drift_detected: false`.

| File | SHA-256 |
|------|---------|
| [audit-report-R10](.agents/governance/runtime/PKT-MP-P3-LOAD-CHAOS-LITE-R10-001-audit-report.json) | `e4a65ca0fc2a0dbe457927019bafbed3866cba07466b33fe0b4f2eaff5dc52f1` |
| [audit-report-R11](.agents/governance/runtime/PKT-MP-P3-LOAD-CHAOS-LITE-R11-001-audit-report.json) | `d171d0553632d1c8caabeef12c4152fef7b0e8057545dc7afd9f7a54274d33f9` |
| [audit-report-R12](.agents/governance/runtime/PKT-MP-P3-LOAD-CHAOS-LITE-R12-001-audit-report.json) | `c1eaf0ee2d6aacaf47b55230feb383be63d747709cf6380c9359a7b1386d593a` |

### 4.2 Bảo mật — script và báo cáo

| File | SHA-256 |
|------|---------|
| [cv-security-metrics-2026-08-20.md](docs/benchmarks/security/cv-security-metrics-2026-08-20.md) | `0f41c25a7d398991b925f3b85404cacdd626e7998a80e346e5cf6ca67342ae04` |
| [sec-bench.mjs](docs/benchmarks/security/sec-bench.mjs) | `664f1f6c47580bd1c509ec447c7a5bcca338438c7f35f1e87e798c20427ba50d` |
| [mtls-bench.mjs](docs/benchmarks/security/mtls-bench.mjs) | `d7b66928aedbdf82acdc82a37bc3116011af486b01f4813eed66c03d85d66823` |

### 4.3 Lưu ý về `tests/load/results/`
Ba file `booking-summary.json`, `eta-summary.json`, `pricing-summary.json` trong
`tests/load/results/` là **placeholder** (`environment-bounded`), không phải số đo
thật. Số đo k6 thực tế nằm ở `.agents/governance/runtime/p3-*-summary.json` (bảng 4.1).
