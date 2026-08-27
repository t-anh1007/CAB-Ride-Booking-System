<div align="center">

# CAB — Intelligent Ride Booking System

**Nền tảng đặt xe đa vai trò theo kiến trúc microservices, event-driven và AI-assisted**

Khách hàng đặt chuyến · Tài xế nhận cuốc realtime · Quản trị vận hành · Ghép tài xế, ETA và surge pricing

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Kafka](https://img.shields.io/badge/Kafka-3.7-231F20?logo=apachekafka&logoColor=white)
![k6](https://img.shields.io/badge/k6-load%20testing-7D64FF?logo=k6&logoColor=white)

</div>

![CAB unified interface](docs/design/cab-ui-reference.png)

---

## Mục lục

0. [Performance Benchmarks](#0-performance-benchmarks)
1. [Bài toán và định hướng kiến trúc](#1-bài-toán-và-định-hướng-kiến-trúc)
2. [Tính năng theo vai trò](#2-tính-năng-theo-vai-trò)
3. [Kiến trúc tổng thể](#3-kiến-trúc-tổng-thể)
4. [Công nghệ áp dụng](#4-công-nghệ-áp-dụng)
5. [System Design và kỹ thuật cốt lõi](#5-system-design-và-kỹ-thuật-cốt-lõi)
6. [Luồng nghiệp vụ](#6-luồng-nghiệp-vụ)
7. [Mô hình dữ liệu](#7-mô-hình-dữ-liệu)
8. [Giao diện đã kiểm chứng](#8-giao-diện-đã-kiểm-chứng)
9. [Chạy dự án](#9-chạy-dự-án)
10. [Cấu trúc repository](#10-cấu-trúc-repository)

---

## 0. Performance Benchmarks

### 0.1. Load test

| Kịch bản | Tải | Request/check | HTTP lỗi | Throughput | p95 | Ngưỡng | Trạng thái |
|---|---:|---:|---:|---:|---:|---:|---|
| Booking qua gateway sau tối ưu | 10→100 VU / 2 phút | 13.424 / 13.424 | 0% | 111,1 req/s | **679,9 ms** | <300 ms | ❌ Chưa đạt latency |
| ETA qua gateway | 50 VU / 1 phút | 9.872 / 9.872 | 0% | ~164 req/s | **340,98 ms** | <200 ms | ❌ Chưa đạt latency |
| ETA cache nóng trực tiếp service | 50 VU | 36.741 / 36.741 | 0% | ~604 req/s | **82,34 ms** | <200 ms | ✅ Đạt |
| Pricing surge spike | 5→80 VU / 10 giây | 3.508 / 3.508 | 0% | ~85,5 req/s | 1.471,9 ms | Không đặt latency | ✅ Đạt checks/error-rate |

Booking đã cải thiện p95 từ **1.150,9 ms xuống 679,9 ms** (khoảng 41%) và throughput từ 63,8 lên 111,1 req/s, nhưng cổng T14 vẫn mở vì chưa xuống dưới 300 ms.

### 0.2. Security microbenchmarks

| Phép đo | Kết quả |
|---|---:|
| Verify JWT RS256 | p50 0,095 ms · p95 0,20 ms · p99 0,31 ms |
| Throughput verify JWT một core | 8.732 token/giây |
| Quyết định RBAC / ABAC | ~0,4 µs / ~0,6 µs |
| Cache JWKS | 1 fetch / 10.000 verify |
| Ma trận broken-access | chặn 11/11 ca vượt quyền; 15/15 ca đúng |
| Argon2id | ~27 ms/hash · p95 39,2 ms · 19 MB |
| mTLS handshake localhost | tăng khoảng 1,7 ms |

### 0.3. Bằng chứng và cách tái tạo

- Báo cáo đầy đủ, môi trường, bảng SHA-256 và phân tích nút thắt: [benchmark_report.md](docs/reports/benchmark_report.md).
- Kịch bản k6: [hướng dẫn](tests/load/README.md), [booking](tests/load/booking-load.js), [ETA](tests/load/eta-load.js), [pricing](tests/load/spike-pricing.js).
- Security benchmark: [báo cáo](docs/benchmarks/security/cv-security-metrics-2026-08-20.md), [sec-bench.mjs](docs/benchmarks/security/sec-bench.mjs), [mtls-bench.mjs](docs/benchmarks/security/mtls-bench.mjs).
- Baseline trong báo cáo: commit `aa665d3bdd6a2dbd48d773e677035d8e3ac0864e`, ngày 2026-08-26.

---

## 1. Bài toán và định hướng kiến trúc

CAB xử lý chuỗi nghiệp vụ liên tục: tìm địa điểm, báo giá, tạo booking, chọn tài xế, cập nhật vị trí, hoàn tất ride, thanh toán và đánh giá. Hệ thống tách theo domain nhưng giữ một API Gateway làm cửa vào thống nhất.

| Bài toán | Rủi ro | Quyết định |
|---|---|---|
| Booking bị gửi lại do mạng chập chờn | Tạo nhiều chuyến/sự kiện | Idempotency key và replay an toàn |
| Ghép tài xế cần phản hồi nhanh | Tài xế xa, bận hoặc nhận trùng | Geo filtering, matching score, vòng nhận/từ chối |
| Vị trí thay đổi liên tục | UI trễ hoặc sai trạng thái | Redis, realtime event và marker bản đồ |
| Service lỗi độc lập | Lỗi dây chuyền | Circuit breaker, timeout và Kafka |
| Giá phụ thuộc cung cầu | Giá thiếu nhất quán | Pricing domain, surge giới hạn và AI fallback |

---

## 2. Tính năng theo vai trò

### Khách hàng

- Đăng nhập OTP; chọn điểm đón/điểm đến trên bản đồ.
- Xem ETA, quãng đường, loại xe và báo giá trước khi đặt.
- Tìm tài xế, hủy yêu cầu, theo dõi vị trí/trạng thái realtime.
- Thanh toán, xem lịch sử và đánh giá sau chuyến.

### Tài xế

- Đăng nhập OTP, bật/tắt sẵn sàng và cập nhật vị trí.
- Nhận yêu cầu realtime, xem tuyến đường/thu nhập, nhận hoặc từ chối.
- Thực hiện `assigned → arriving → in_progress → completed`.
- Xem thu nhập, lịch sử chuyến và hồ sơ.

### Quản trị viên

- Đăng nhập mật khẩu + MFA, xem tổng quan vận hành.
- Quản lý người dùng, tài xế, chuyến đi và cung ứng.
- Theo dõi bản đồ, surge zone và nhật ký kiểm toán.

---

## 3. Kiến trúc tổng thể

![CAB system architecture](docs/_shared/d2-architect/cab-system.svg)

Source chỉnh sửa: [cab-system.d2](docs/_shared/d2-architect/cab-system.d2).

- Gateway chuẩn hóa auth, route, rate limit, lỗi và correlation context.
- PostgreSQL giữ account/profile có cấu trúc; MongoDB giữ dữ liệu vận hành linh hoạt.
- Kafka truyền sự kiện; Redis giữ cache, trạng thái nóng và vị trí.
- Matching, ETA và surge là năng lực AI có fallback.

---

## 4. Công nghệ áp dụng

| Lớp | Công nghệ |
|---|---|
| Frontend | React 18, Vite, React Router, Leaflet, OpenStreetMap, Socket.IO client |
| Gateway/backend | Node.js, Express, JWT/JWKS, RBAC/ABAC, circuit breaker |
| AI/ML | Python, FastAPI, matching score, ETA, surge prediction |
| Dữ liệu | MongoDB 7, PostgreSQL 16, Redis 7 |
| Event-driven | Apache Kafka 3.7 |
| Kiểm thử | Node test, Pytest, Supertest, k6, browser E2E trực tiếp |
| Runtime local | npm workspaces, Docker Compose profiles |

---

## 5. System Design và kỹ thuật cốt lõi

### API Gateway

Frontend gọi một entry point. Gateway kiểm tra danh tính/quyền, gắn request context, định tuyến và chuẩn hóa lỗi. Route registry giúp phát hiện route thiếu hoặc sai trước khi lỗi lộ ra UI.

### Event-driven và replay safety

Kafka tách producer khỏi consumer. Booking ghi domain state rồi phát event bằng dispatcher/outbox; consumer dựa trên event ID/idempotency key để replay không nhân đôi tác động.

### Realtime ride lifecycle

Driver availability, yêu cầu chuyến, vị trí và trạng thái ride được truyền realtime. UI driver tương thích cả `driver.assigned` và `ride.assigned` trong giai đoạn chuyển contract.

### Resilience và Zero-Trust

Timeout, circuit breaker, retry giới hạn và AI fallback ngăn lỗi dây chuyền. JWT RS256/JWKS, RBAC/ABAC, vô hiệu header giả mạo, rate limit và audit log tạo nhiều lớp kiểm soát.

---

## 6. Luồng nghiệp vụ

![Đặt và hoàn tất chuyến](docs/cab-core/d2/book-and-complete-ride.svg)

Source: [book-and-complete-ride.d2](docs/cab-core/d2/book-and-complete-ride.d2). Luồng bao phủ happy path, không tìm thấy tài xế, tài xế từ chối, thử ứng viên tiếp theo và khách hủy.

---

## 7. Mô hình dữ liệu

![CAB core data model](docs/cab-core/d2-erd/cab-core.svg)

Source: [cab-core.d2](docs/cab-core/d2-erd/cab-core.d2). Đây là mô hình logic xuyên domain; các ID thể hiện tham chiếu nghiệp vụ, không ngụ ý foreign key hoặc join trực tiếp xuyên database/service.

---

## 8. Giao diện đã kiểm chứng

| Customer | Driver | Admin |
|---|---|---|
| ![Customer quote](docs/screenshots/customer-ui-new-04-ride-options.png) | ![Driver request](docs/screenshots/driver-ui-new-04-incoming-request.png) | ![Admin dashboard](docs/screenshots/admin-ui-new-01-dashboard.png) |
| Báo giá và marker điểm đón/đến | Yêu cầu chuyến realtime | Tổng quan vận hành |

Ảnh được chụp từ browser sau khi chạy trực tiếp UI với backend Docker local. Xem [toàn bộ screenshots](docs/screenshots/).

---

## 9. Chạy dự án

Yêu cầu Node.js 20+, npm, Docker Desktop và các file `.env.docker` tạo từ `.env.docker.example`.

```powershell
npm install
docker compose -f infra/docker-compose/docker-compose.local.yml up -d
npm run smoke
```

Core + AI + frontend container:

```powershell
docker compose -f infra/docker-compose/docker-compose.local.yml --profile ai --profile web up -d
```

| Ứng dụng | URL |
|---|---|
| Customer | `http://localhost:5174` |
| Driver | `http://localhost:5175` |
| Admin | `http://localhost:5176` |
| Gateway | `http://localhost:3000` |

Dev mode: `npm run dev:customer`, `npm run dev:driver`, `npm run dev:admin`. Test toàn bộ: `npm run test:all`.

---

## 10. Cấu trúc repository

```text
CAB-Ride-Booking-System/
├── apps/                 # customer, driver, admin React apps
├── packages/web-shared/  # design tokens, UI primitives, map markers
├── gateway/api-gateway/  # entry point HTTP/realtime
├── services/             # auth, user, booking, driver, ride, payment...
├── AI-ML/                # matching, ETA, surge, insights
├── platform/             # topology và resilience/security layers
├── infra/                # Docker Compose và Docker Swarm
├── tests/load/           # k6 scenarios và threshold
├── scripts/chaos/        # resilience experiments
└── docs/                 # architecture, benchmark, diagrams, screenshots
```

## Tài liệu liên quan

- [Kiến trúc tổng quan](docs/architecture/01-overall-architecture.md)
- [Kiến trúc triển khai](docs/architecture/02-deployment-architecture.md)
- [Thiết kế UI thống nhất](docs/superpowers/specs/2026-08-26-cab-unified-ui-design.md)
- [Kế hoạch triển khai UI](docs/superpowers/plans/2026-08-26-cab-unified-ui-implementation.md)
- [Hướng dẫn mapping và chạy hệ thống](docs/mapping_and_running_guide.md)
