HƯỚNG DẪN CHẠY DỰ ÁN (Local)

Mô tả ngắn: hướng dẫn này mô tả cách chạy toàn bộ hệ thống (đề xuất: Docker Compose) và cách chạy từng dịch vụ riêng để phát triển/test cục bộ.

Tổng Quan: dự án là một hệ thống microservices (Node.js, Python, Kafka, MongoDB, PostgreSQL, Redis). Thư mục hạ tầng chính: infra/docker-compose/docker-compose.local.yml.

Tiền Đề (Prerequisites)
- Docker & Docker Compose (Docker Desktop trên Windows, backend WSL2 khuyến nghị).
- Node.js 18+ (để chạy frontend/gateway với npm workspaces).
- Python 3.10+ (cho dịch vụ AI/ML như AI-ML/matching-service).
- Git

Windows notes:
- Bật WSL2 + Docker Desktop; cho phép bind mount tới thư mục repo (đặt repo trong filesystem truy cập được bởi Docker/WSL nếu cần).
- Kafka trên Docker có thể cần thêm tài nguyên (RAM/CPU) trong Docker Desktop settings.

1) Chạy toàn bộ (quick start, Docker Compose)

Mở terminal ở root của repo và build + khởi động toàn bộ stack local:

```bash
# Tại thư mục gốc của repo
docker compose -f infra/docker-compose/docker-compose.local.yml up -d --build
```

Ghi chú:
- Nếu hệ thống của bạn dùng `docker-compose` (plugin cũ), thay `docker compose` bằng `docker-compose`.
- Lệnh trên sẽ tạo các container: Kafka, các MongoDB/Redis/Postgres, và các service (gateway, booking, auth, matching, ...).
- Một số container (Postgres/Mongo) sẽ tự chạy các script seed nằm trong database_test/ khi volumes chưa tồn tại.

Kiểm tra trạng thái và logs:

```bash
docker compose -f infra/docker-compose/docker-compose.local.yml ps
docker compose -f infra/docker-compose/docker-compose.local.yml logs -f --tail=200 api-gateway
```

Để dừng và xóa volumes (để re-seed DB), chạy:

```bash
docker compose -f infra/docker-compose/docker-compose.local.yml down -v
```

2) Cài dependencies node (nếu cần chạy dev cục bộ bằng npm workspaces)

Ở root (sử dụng npm workspaces):

```bash
npm install
```

Sau khi cài, bạn có thể chạy từng phần bằng scripts ở package.json gốc. Ví dụ:

```bash
# Chạy API Gateway (nếu muốn chạy local mà không dùng container)
npm run dev:gateway

# Chạy frontend admin
npm run dev:admin

# Chạy service cụ thể (ví dụ pricing)
npm run dev:pricing
```

Lưu ý: các script ở root dùng `npm run dev --workspace <workspaceName>`; đảm bảo tên workspace đúng (ví dụ `@cab/api-gateway`).

3) Chạy dịch vụ Python (AI/ML) cục bộ

Ví dụ matching-service:

```bash
cd AI-ML/matching-service
python -m venv .venv            # tuỳ chọn
source .venv/bin/activate      # trên WSL / macOS / Linux
# Trên Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Nếu đang dùng Docker Compose, service AI-ML đã được cấu hình và có thể truy cập tại http://localhost:8000 theo mapping trong compose.

4) Kiểm tra health / endpoints cơ bản

- API Gateway: http://localhost:3000
- Matching Service: http://localhost:8000
- Ride Service: http://localhost:3109

Các service có endpoint /health (nếu được triển khai) — dùng để kiểm tra trạng thái.

5) Dữ liệu mẫu / Seed

Compose đã mount các file seed từ database_test/ vào /docker-entrypoint-initdb.d/ cho container DB tương ứng. Để tái chạy seed:

```bash
docker compose -f infra/docker-compose/docker-compose.local.yml down -v
docker compose -f infra/docker-compose/docker-compose.local.yml up -d --build
```

6) Lệnh hữu ích

- Xem logs của một service:

```bash
docker compose -f infra/docker-compose/docker-compose.local.yml logs -f --tail=200 <container_name>
# ví dụ: docker compose -f infra/docker-compose/docker-compose.local.yml logs -f api-gateway
```

- Dừng toàn bộ stack:

```bash
docker compose -f infra/docker-compose/docker-compose.local.yml down
```

7) Cấu hình môi trường

Mỗi service có file .env.docker (ví dụ gateway/api-gateway/.env.docker, services/auth-service/.env.docker). Compose tham chiếu tới các file này. Trước khi chạy, xem qua các file đó và chỉnh nếu cần.

Ví dụ sửa port hoặc URL nội bộ: gateway/api-gateway/.env.docker

8) Lỗi thường gặp & khắc phục nhanh

- Kafka không khởi động / lỗi partition: tăng tài nguyên Docker Desktop (RAM >= 4GB, swap), kiểm tra logs cab-kafka.
- Bind mount trên Windows gây lỗi quyền/đường dẫn: chạy Docker Desktop với WSL2 backend và đặt repo trong WSL filesystem hoặc bật file sharing.
- Postgres/Mongo không seed: có thể do volume đã tồn tại; xóa volume (down -v) để tái seed.

9) Chạy tests nhanh

Ví dụ gateway tests:

```bash
cd gateway/api-gateway
npm test
```

Hoặc chạy test workspace từ root (nếu script có hỗ trợ):

```bash
npm --workspace @cab/api-gateway test
```

10) Ghi chú cho việc phát triển

- Nên dùng Docker Compose khi muốn chạy toàn bộ tích hợp (Kafka + DB).
- Khi phát triển nhanh, bạn có thể chạy dịch vụ Node cục bộ (npm run dev:gateway) và để các infra (Kafka, DB) chạy bằng Docker.

---

Nếu bạn muốn, tôi sẽ:
- kiểm tra thêm package.json của từng service để cung cấp lệnh `npm install`/`pip install` chính xác;
- thêm hướng dẫn cấu hình WSL2 + Docker Desktop cụ thể cho Windows;
- hoặc tạo script tự động hoá (powershell/bash) cho chạy local.

Hết
