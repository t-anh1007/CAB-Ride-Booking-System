# Hướng dẫn Mapping Backend vào UI và Cách Chạy Hệ Thống

Tài liệu này hướng dẫn cách kết nối các ứng dụng Frontend (trong thư mục `apps`) với hệ thống Backend microservices và quy trình khởi chạy toàn bộ hệ thống.

## 1. Cơ chế Mapping (Kết nối)

Hệ thống sử dụng mô hình **API Gateway**. Thay vì gọi trực tiếp từng microservice, tất cả các ứng dụng UI sẽ gửi request đến một cổng duy nhất là **API Gateway**.

### Sơ đồ luồng dữ liệu:
`UI (Customer/Driver/Admin) -> API Gateway (Port 3000) -> Microservices`

### Cấu hình trong thư mục `apps/`:
Mỗi ứng dụng UI (`customer-app`, `driver-app`, `admin-dashboard`) có một file `.env.example`. Bạn cần tạo file `.env` tương ứng (ví dụ: `apps/customer-app/.env`) với nội dung sau:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
```

- **VITE_API_BASE_URL**: Địa chỉ của API Gateway.
- **VITE_WS_BASE_URL**: Địa chỉ WebSocket (dùng cho cập nhật thời gian thực như vị trí tài xế).

### API Gateway Mapping:
API Gateway sẽ điều hướng request dựa trên prefix của URL (cấu hình trong `gateway/api-gateway/src/route-registry.js`):

| Prefix URL | Service Đích | Port Nội bộ |
|------------|--------------|-------------|
| `/api/v1/auth` | auth-service | 3104 |
| `/api/v1/bookings` | booking-service | 3103 |
| `/api/v1/drivers` | driver-service | 3107 |
| `/api/v1/rides` | ride-service | 3109 |
| `/api/v1/users` | user-service | 3105 |
| `/api/v1/matching` | matching-service | 8000 |
| `/api/v1/payments` | payment-service | 3102 |

---

## 2. Hướng dẫn chạy hệ thống

Để chạy toàn bộ hệ thống, hãy thực hiện theo các bước sau:

### Bước 1: Khởi chạy hạ tầng (Infrastructure)
Sử dụng Docker Compose để chạy các Database (MongoDB, PostgreSQL), Redis và Kafka.

```powershell
# Di chuyển vào thư mục hạ tầng
cd infra/docker-compose
# Chạy docker-compose
docker-compose -f docker-compose.local.yml up -d
```
*Đợi khoảng 1-2 phút để các database và Kafka khởi động hoàn toàn.*

### Bước 2: Cài đặt Dependencies (Chỉ làm lần đầu)
Tại thư mục gốc của dự án, chạy lệnh sau để cài đặt cho tất cả các workspace:

```powershell
npm install
```

### Bước 3: Chạy Backend (Microservices & Gateway)
Hệ thống sử dụng **npm workspaces**, bạn có thể chạy các service từ thư mục gốc. Mở các terminal riêng biệt cho mỗi service:

1. **API Gateway (Bắt buộc):**
   ```powershell
   npm run dev:gateway
   ```
2. **Auth Service (Quan trọng để Login):**
   ```powershell
   npm run dev:auth
   ```
3. **Các service khác (Tùy nhu cầu):**
   - Booking: `npm run dev:booking`
   - Ride: `npm run dev:ride`
   - Driver: `npm run dev:driver-service`
   - Payment: `npm run dev:payment`

### Bước 4: Chạy UI (Frontend)
Mở terminal mới và chạy ứng dụng bạn muốn sử dụng:

- **Customer App:** `npm run dev:customer` (Mặc định: http://localhost:5173)
- **Driver App:** `npm run dev:driver` (Mặc định: http://localhost:5174)
- **Admin Dashboard:** `npm run dev:admin` (Mặc định: http://localhost:5175)

---

## 3. Kiểm tra kết nối

1. Mở trình duyệt truy cập ứng dụng UI (ví dụ: Customer App).
2. Kiểm tra Network trong DevTools (F12).
3. Khi thực hiện Đăng nhập hoặc Đặt xe, các request phải gửi đến `http://localhost:3000/api/v1/...`.
4. Nếu API Gateway trả về lỗi, hãy kiểm tra xem service tương ứng (ví dụ: `auth-service`) đã chạy chưa.

> [!TIP]
> Bạn có thể sử dụng lệnh `npm run inspect:topology` ở root để xem sơ đồ kết nối giữa các service.
