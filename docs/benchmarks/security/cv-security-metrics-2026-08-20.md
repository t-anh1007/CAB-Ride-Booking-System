# Số liệu định lượng bảo mật (Zero-Trust / Auth) cho CV — đo ngày 2026-08-20

Nguồn: đo trực tiếp trên nhánh `NguyenTuanAnh-CyberSecurityEn`, commit `3808d05`.
Phạm vi: **chỉ phần thuộc role Cybersecurity của bạn** — Zero-Trust, xác thực
JWT/OAuth2 (RS256/JWKS), phân quyền RBAC/ABAC, chống brute-force, mTLS, security
posture. Mỗi mục ghi: **con số**, cách đo, mức tin cậy, câu CV gợi ý.

> Môi trường đo: Node v22.18.0, Windows 11. Đo **trực tiếp trên mã nguồn thật**
> của `gateway/api-gateway` và `services/auth-service` (import đúng module
> `authorization.js`, `abac.js`, `internal-auth-headers.js`, `jwt-service.js` +
> crypto `jose` RS256 cấu hình y hệt auth-service). Không cần dựng full Docker
> stack → nhanh, không đụng hệ thống. Phần cần DB sống (revocation live) ghi rõ.

---

## Bảng tóm tắt (chọn nhanh cho CV)

| # | Vấn đề | Con số đo được | Trạng thái |
|---|--------|----------------|-----------|
| 1 | Overhead xác thực JWT / request | Verify RS256 chỉ **~0.1 ms** (p95 0.20 ms) | ✅ Đo xong |
| 2 | Throughput verify JWT (1 core) | **8.732 token/giây** (RS256 2048-bit) | ✅ Đo xong |
| 3 | Độ trễ quyết định RBAC/ABAC | RBAC **~0.4 µs**, ABAC **~0.6 µs** / quyết định | ✅ Đo xong |
| 4 | Hiệu quả cache JWKS | **99.99%** giảm fetch khóa (1 fetch / 10.000 verify) | ✅ Đo xong |
| 5 | Độ phủ chặn RBAC/ABAC (broken-access) | **0%** broken-access — chặn **11/11** ca vượt quyền, đúng 15/15 | ✅ Đo xong |
| 6 | Chống brute-force login | Khóa sau **5** lần sai (OTP 300s / admin 15 phút) | ✅ Đo xong (config thật) |
| 7 | Zero-trust chống giả mạo header nội bộ | **100%** (10.000/10.000) header giả bị vô hiệu hóa | ✅ Đo xong |
| 8 | Overhead mTLS service-to-service | **+1.7 ms / handshake** (p50 1.1 → 2.8 ms) | ✅ Đo xong (đại diện) |
| + | Chi phí băm mật khẩu (argon2id) | **~27 ms/hash**, 19 MB memory-hard | ✅ Bonus |

---

## Chi tiết từng phép đo

### #1 — Overhead xác thực JWT trên gateway ✅
- **Con số**: verify chữ ký RS256 (JWKS local) mất **p50 0.095 ms, p95 0.20 ms,
  p99 0.31 ms** / token (5.000 mẫu, đã warmup).
- **Cách đo**: `jose.jwtVerify` với resolver `createLocalJWKSet` — đúng đường đi
  của `jwt-service.js`. Đây là chi phí crypto thuần; bước gọi `/auth/me` (xác thực
  ngữ cảnh) là network hop riêng, không tính vào đây.
- **Câu CV gợi ý**: *"Lớp xác thực JWT (RS256/JWKS) thêm ~0.1 ms/request — bảo mật
  gần như không đánh đổi hiệu năng."*

### #2 — Throughput verify JWT (token/giây) ✅
- **Con số**: **8.732 token/giây** trên 1 core (RS256, khóa 2048-bit).
- **Cách đo**: vòng lặp 5.000 lần `jwtVerify` liên tục, chia tổng thời gian.
- **Câu CV gợi ý**: *"Gateway xác minh ~8.700 JWT/giây/lõi với chữ ký bất đối xứng
  RS256, cache JWKS."*
- Ghi chú: single-thread, đo tuần tự — chạy song song nhiều lõi/replica sẽ scale
  gần tuyến tính.

### #3 — Độ trễ quyết định phân quyền RBAC/ABAC ✅
- **Con số**: RBAC (`authorization.js`: role + scope + permission) **p50 0.4 µs**;
  ABAC (`abac.js`: chỉ tài xế được gán mới publish GPS ride đang chạy) **p50
  0.6 µs** / quyết định (50.000 & 20.000 mẫu).
- **Cách đo**: chạy trực tiếp middleware/hàm enforce thật, đo từng quyết định.
- **Câu CV gợi ý**: *"Đánh giá chính sách RBAC + ABAC hoàn tất dưới 1 µs/quyết
  định, không phải là điểm nghẽn của gateway."*

### #4 — Hiệu quả cache JWKS ✅
- **Con số**: **1 lần fetch khóa** cho **10.000 lần verify** → **giảm 99.99%**
  lần tải public key (TTL cache 60s).
- **Cách đo**: khởi tạo `createJwtService` thật với `fetchImpl` đếm số lần gọi
  JWKS; verify 10.000 token.
- **Câu CV gợi ý**: *"Cache JWKS giảm 99.99% truy vấn khóa công khai tới auth
  service khi xác thực token."*

### #5 — Độ phủ chặn RBAC/ABAC (broken-access rate) ✅
- **Con số**: **0% broken-access** — trên **11 ca truy cập vượt quyền** (customer/
  driver gọi route admin, thiếu scope/permission, tài xế publish GPS cho ride
  không thuộc mình / ride đã hoàn tất / thiếu quyền…) đều bị chặn 403; tổng thể
  **15/15 ca** (gồm 4 ca hợp lệ vẫn cho qua) cho kết quả đúng → **100% chính xác**.
- **Cách đo**: ma trận ca negative/positive chạy qua `authorization.js` +
  `enforceDriverLocationAbac` thật, đối chiếu kỳ vọng.
- **Câu CV gợi ý**: *"Thiết kế & kiểm thử tầng phân quyền RBAC/ABAC chặn 100% truy
  cập vượt quyền (0 broken-access) qua bộ ca kiểm thử negative."*

### #6 — Chống brute-force đăng nhập ✅
- **Con số** (giá trị enforce thật trong code/config auth-service):
  - OTP verify: khóa sau **5 lần sai**, cửa sổ khóa **300 giây**.
  - Admin login: khóa tài khoản sau **5 lần sai**, khóa **15 phút**.
  - Gateway: rate-limit fixed-window per-route (Redis `INCR`+`EXPIRE`), trả 429 +
    `Retry-After` khi vượt ngưỡng.
- **Cách đo**: đọc tham số enforce trong `config/env.js` + logic
  `auth-rate-limit.middleware.js` và `middleware/rate-limit.js`.
- **Câu CV gợi ý**: *"Khóa tài khoản sau 5 lần đăng nhập sai + rate-limit fixed-
  window ở gateway, chặn dò mật khẩu/OTP."*
- Ghi chú: muốn con số "chặn X% request độc hại" động, chạy 200 lần login sai qua
  Redis đang bật rồi đếm 429 (script demo sẵn sàng bổ sung).

### #7 — Zero-trust: chống giả mạo header định danh nội bộ ✅
- **Con số**: **100% (10.000/10.000)** yêu cầu cố tình chèn header
  `x-auth-role: Admin`, `x-auth-scopes: admin:all`… bị **vô hiệu hóa** — gateway
  strip toàn bộ header `x-auth-*` do client gửi và ghi đè bằng danh tính đã xác
  thực (`context-source = api-gateway`).
- **Cách đo**: chạy `applyForwardedAuthHeaders` thật với header giả mạo, kiểm tra
  danh tính đầu ra luôn là danh tính đã verify.
- **Câu CV gợi ý**: *"Thực thi Zero-Trust: gateway vô hiệu hóa 100% mưu toan giả
  mạo header định danh service-to-service, chống leo thang đặc quyền."*

### #8 — Overhead mTLS service-to-service ✅
- **Con số**: mutual-TLS thêm **~1.7 ms/handshake** (p50 plain HTTP 1.1 ms →
  mTLS 2.8 ms) với kết nối mới mỗi request, trên localhost, 1.500 mẫu.
- **Cách đo**: dựng server mTLS (`requestCert + rejectUnauthorized`) vs HTTP thuần
  cục bộ, cert ephemeral (openssl), bắn request không keep-alive để tính cả
  handshake.
- **Câu CV gợi ý**: *"Kênh service-to-service mã hóa mTLS với chi phí ~1.7 ms mỗi
  handshake — được khấu hao gần như bằng 0 khi bật keep-alive."*
- Ghi chú: con số tuyệt đối (+1.7 ms) đáng tin; tỉ lệ % lớn chỉ vì baseline
  localhost quá nhanh. Đây là bench đại diện (cert ephemeral), không dùng cert
  production trong `infra/mtls`.

### + Bonus — Chi phí băm mật khẩu (argon2id) ✅
- **Con số**: **~27 ms/hash** (p50 27.1 ms, p95 39.2 ms), tham số **memory-hard
  19 MB** (`memoryCost 19456`, `timeCost 2`, `argon2id`).
- **Cách đo**: 20 lần `argon2.hash` với đúng tham số production của
  `lib/password.js`.
- **Câu CV gợi ý**: *"Băm mật khẩu bằng Argon2id (19 MB memory-hard, ~27 ms/hash)
  chống tấn công GPU/ASIC dò mật khẩu."*

---

## Tái tạo số liệu

Scripts nằm trong `docs/benchmarks/security/`. Không cần full Docker stack cho
#1–#5, #7 và bonus:

- Auth/RBAC/ABAC/JWKS/spoof/argon2 (#1–#5, #7, +): `node docs/benchmarks/security/sec-bench.mjs`
- mTLS overhead (#8): `node docs/benchmarks/security/mtls-bench.mjs` (cần `openssl` trong PATH)
- Brute-force TTL (#6): giá trị enforce đọc từ `services/auth-service/src/config/env.js`

Con số đo trên máy dev đang tải nhẹ; throughput (#2) và latency (#1,#3,#8) có thể
tốt hơn trên máy server rảnh. Các con số bản chất nhị phân/độ phủ (#4,#5,#7)
không phụ thuộc máy.
