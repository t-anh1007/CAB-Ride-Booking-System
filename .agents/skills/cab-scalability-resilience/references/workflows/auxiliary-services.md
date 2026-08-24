# Workflow: auxiliary-services

## Mục tiêu
Chuẩn hóa resilience review cho các nhánh dịch vụ bổ trợ. Xoay quanh tính ổn định của:
- Pricing Service (Tính cước nhạy cảm với Downtime / Fallback surge rules).
- Notification Service (Thông báo SMS/Push bất đồng bộ, Retry và cất vào Dead-Letter-Queue).
- User & Review Service.

## Phạm vi
- `services/notification-service`
- `services/pricing-service`
- `services/user-service`
- `services/review-service`

---

## Scenario AUX-1: Notification Retry & Eventual Consistency 

### Objective
- Hệ thống gửi push notification/SMS đôi khi thất bại do 3rd party Twilio / FCM sập mạng.
- Notification sẽ lưu log Retry nỗ lực và không block luồng tạo cuốc xe.

### Entry Conditions
- Gửi thông báo đến khách hàng/tài xế thông qua queue/message broker.
- 3rd Party API không hồi đáp (simulated downtime).

### Activation Method
- **Script-assisted**: Bắn Fake event đến Kafka `notification.send` hoặc gọi API request gán mock fail.

### Step-by-step Procedure
1. Sinh Request gửi Notification.
2. Ép API đối tác timeout.
3. Đọc log của notification-worker.
4. Kiểm tra sự xuất hiện của Retry delay.
5. Nếu quá nỗ lực, event chuyển sang Dead-Letter Queue (DLQ).

### Required Evidence
- Log gửi Notification thất bại liên tiếp kèm timeout.
- DB lưu trạng thái Notification (`FAILED`, `RETRYING`).
- Thông tin Message đẩy vào DLQ ở Kafka / RabbitMQ.

### Result Rules
- **PASS**: Không blocking ứng dụng chính. Notification worker retry chuẩn, đưa vào DLQ mà không để mất data âm thầm.
- **FAIL**: Nền tảng bị nghẽn (worker chết không báo trước). Retry tạo spam rate-limit. Dữ liệu mất tích không nằm trong DLQ.
- **MISSING_EVIDENCE**: Không phát hiện trace nào chứng minh hệ thống xử lý Retry.
- **ARCHITECTURE_DRIFT**: Design dùng Async nhưng code bắn API đồng bộ chờ SMS gửi xong mới trả HTTP 200 cho user.

### Exit Conditions
- Báo cáo kết luận về cơ chế bất đồng bộ của Notification.

### Report Mapping
- `workflow_selected = auxiliary-services`
- `scenario = AUX-1`

---

## Scenario AUX-2: Pricing Timeout & Graceful Defalut

### Objective
- Mất kết nối tới rule/surge engine, Service Pricing phải trả về cước phí gốc (base fare), hệ thống không được crash trắng làm khách hàng không xem được xe.

### Entry Conditions
- Có tọa độ A, B hợp lệ để gọi API Estimate Fare.
- Redis cache lưu rule bị xóa / sập, database Rule engine cũng delay quá 5 giây.

### Activation Method
- Gọi API Calculate Fare thông qua Pricing Service và ép delay / block access đến storage rules.

### Require Evidence
- HTTP response timing < limit, payload fallback lấy `baseFare`.
- Error logs chỉ ra fallback được trigger an toàn.

### Result Rules
- **PASS**: Trả cước mặc định nhanh chóng (fail-safe).
- **FAIL**: Treo xoay chuông, hoặc báo lỗi 500 ném trắng tay. Khách không book được chuyến.
- **MISSING_EVIDENCE**: Request tự passed do Redis sống dai, không giả lập được sập Redis để coi logic Fail fallback.
