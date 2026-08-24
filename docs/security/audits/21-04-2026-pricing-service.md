# Báo cáo Rà soát Bảo mật CAB-BOOKING - PRICING-SERVICE

**Ngày thực hiện**: 21-04-2026
**Đối tượng rà soát**: `services/pricing-service`
**Mô hình đánh giá**: Zero Trust Baseline

---

### 1. Bảng kết quả các lỗ hổng (Findings Table)

| # | Lỗ hổng (Finding) | Mức độ | Đường dẫn bằng chứng (Evidence Path) | Hướng khắc phục (Fix Direction) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Rủi ro thao túng giá cước (Fare Manipulation)** | 🔴 **P0** | `pricingController.js:20` | Hiện tại service đang nhận `distanceKm` và `durationMin` trực tiếp từ phía người dùng (Client). KẺ TẤN CÔNG có thể gửi giá trị cực thấp để làm sai lệch tổng tiền. Cần tính toán các giá trị này tại Server dựa trên tọa độ thực tế. |
| 2 | **Lỗ hổng bàn giao giá (Price Snapshot Handoff Gap)** | 🔴 **P0** | `bookingController.js:31-61` | `booking-service` khi tạo chuyến xe không thực hiện kiểm tra chéo giá với `pricing-service`. Service này hiện đang bỏ qua hoặc để giá mặc định (0 VND). Cần cơ chế xác thực giá server-side trước khi tạo Booking. |
| 3 | **Lỗ hổng định danh và sở hữu (IDOR / Identity Hijacking)** | 🔴 **P0** | `bookingController.js:54, 85` | Các service downstream (Booking/Pricing) nhận `userId` trực tiếp từ request body mà không đối soát xem nó có khớp với ID trong JWT Token đã được Gateway xác thực hay không. |
| 4 | **Rò rỉ dữ liệu vận hành nội bộ (Internal Metrics Leak)** | 🟡 **P1** | `pricingController.js:83-88` | Phản hồi (Response) gửi về cho khách hàng chứa chi tiết số lượng tài xế (`supply`), nhu cầu đặt xe (`demand`) và nguồn tính giá (`surgeSource`). Dữ liệu này có thể bị đối thủ cạnh tranh thu thập. |
| 5 | **Thiếu chính sách giới hạn tần suất (Missing Rate Limit)** | 🟡 **P1** | `api-gateway/src/route-registry.js` | Chưa có cấu hình Rate Limit riêng cho các endpoint báo giá, dẫn đến rủi ro bị quét dữ liệu hệ số Surge trên diện rộng. |

---

### 2. Danh sách kiểm tra PASS/FAIL (Checklist)

| Yêu cầu bảo mật | Trạng thái | Bằng chứng / Ghi chú |
| :--- | :--- | :--- |
| **Giá cước do Server quyết định** | ❌ **FAIL** | Người dùng vẫn đang kiểm soát các biến đầu vào cốt yếu (khoảng cách/thời gian). |
| **Tính toàn vẹn của hệ số Surge** | ✅ **PASS** | `Implemented`: Hệ thống đã dùng logic truy vấn server-side (Redis Geohash) dựa trên tọa độ thay vì tin vào client. |
| **Xác thực định danh tại Service** | ❌ **FAIL** | Các service downstream tin tưởng tuyệt đối vào ID do client gửi mà không check token parity. |
| **Mã hóa dữ liệu khi truyền tải** | ❌ **FAIL** | `Security inconsistency`: Giao tiếp nội bộ giữa các service trong Swarm vẫn dùng giao thức HTTP không mã hóa. |
| **Validation đầu vào (Joi/Zod)** | ✅ **PASS** | `Implemented`: Có schema validate tọa độ và loại xe khá chặt chẽ tại Gateway và Routes. |

---

### 3. Lỗ hổng bảo mật liên dịch vụ (Cross-Service Gaps)

- **Pricing -> Booking**: Thiếu cơ chế ký số (signature) cho báo giá hoặc bước xác thực snapshot giữa hai service. Giá cước có thể bị "rơi rớt" hoặc bị thay đổi trong quá trình chuyển giao.
- **Gateway -> Downstream**: Identity context (userId) được truyền đi nhưng không được ép buộc kiểm tra quyền sở hữu (ownership) tại lớp xử lý logic của từng service.

---

### 4. Thứ tự ưu tiên khắc phục (Fix Priority)

- **Mức P0 (Ưu tiên khẩn cấp)**:
    - Loại bỏ các biến khoảng cách và thời gian do client gửi lên; thực hiện tính toán tại server thông qua ETA service hoặc Google Maps API.
    - Cấu hình xác thực giá cước tại `booking-service` trước khi lưu vào cơ sở dữ liệu.
    - Thực hiện đối soát `userId` trong token với dữ liệu trong request body để chặn IDOR.
- **Mức P1 (Ưu tiên cao)**:
    - Ẩn các thông tin nhạy cảm về `metrics` trong JSON response trả về cho client.
    - Áp dụng chính sách Rate Limit tại Gateway cụ thể cho các endpoint Pricing.
- **Mức P2 (Ưu tiên trung bình)**:
    - Triển khai cấu hình TLS (mTLS) cho toàn bộ traffic nội bộ giữa các services và Kafka.
