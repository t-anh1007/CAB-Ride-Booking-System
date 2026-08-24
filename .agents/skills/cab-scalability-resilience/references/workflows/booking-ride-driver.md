# Workflow: booking-ride-driver

## Mục tiêu
Chuẩn hóa resilience review cho replay-safety dựa trên chuẩn UUID Idempotency-Key và Path Tracking Evidence.
- Xác minh an toàn khi một người dùng/driver bấm thử liên tục 1 lệnh do mạng lag (Replay Idempotency).
- Xác minh runtime thực tế liên lạc giữa Frontend / Gateway tới Kafka, tránh drift.

## Phạm vi
- `services/booking-service`
- `services/ride-service`
- `services/driver-service`

---

## Scenario BRD-1: Booking replay safety with same Idempotency-Key

### Objective
- Bảo đảm request trùng lập (`Idempotency-Key`) không trigger logic tạo cuốc xe mới.
- Event side effects (như Publish vào Event Bus `ride_events`) không bị nhân đôi.

### Entry Conditions
- Đã nhận token hợp lệ, pass qua Auth.
- Đã định danh luồng Gateway đi qua Middleware Idempotency -> Booking Service.
- Quan sát DB và Event Broker log rõ ràng.

### Activation Method
- **Reuse** Postman collection request.
- Gọi POST `/bookings` liên tiếp 2 hoặc nhiều lần với CÙNG 1 `Idempotency-Key` uuid.

### Step-by-step Procedure
1. Sinh payload xin quote giá khởi tạo booking.
2. Gửi request thứ tự 1 có `Idempotency-Key: X`. 
3. Giữ trọn bộ Request (đổi payload cũng mặc kệ do check Key) gửi lại với `Idempotency-Key: X`.
4. Xem Response HTTP. Phải nhận được cache state hay existing record (dù logic check Middleware Cache hay Booking DB).
5. Load bảng Booking DB, xác minh không nảy thêm bản ghi trùng (Báo unique constraint hoặc trùng logic).
6. Load console Kafka log / Event Broker traces. Xác nhận bao nhiêu sự kiện `RideCreated` đã được push.

### Required Evidence
- HTTP Status/Body qua Gateway Idempotency response (sẽ có header hit cache / hit duplicate check).
- Booking DB collection evidence: Chỉ có 1 Document/Row ứng với Record booking ID.
- Broker push message: Logs publisher chỉ ra duy nhất 1 Message push trong hệ thống.
- Correlation tracking ID log.

### Result Rules
- **PASS**: Các Request replay chỉ xuất hiện phản hồi có chứa booking record cũ, DB không đẻ bản ghi rác, không publish dư thừa (0 side effect replay).
- **FAIL**: Tạo duplicate Booking. Tạo 2 events ra Kafka khiến hệ thống lủng sự kiện Saga. Bypass bảo vệ Idempotency (nếu Request 1 đang xử lí, Request 2 chèn vào đua dữ liệu).
- **MISSING_EVIDENCE**: Chặn Idempotency thành công bằng middleware Redis gateway nhưng không có bằng chứng Event Publish từ service do thiếu debug Broker.
- **ARCHITECTURE_DRIFT**: API không yêu cầu Idempotency header hay Request đi tắt luồng.

### Exit Conditions
- Chốt rủi ro cho replay attack.

### Report Mapping
- `workflow_selected = booking-ride-driver`
- `scenario = BRD-1`
- `risk`: High do hậu quả duplicate ride.

---

## Scenario BRD-2: Ride/driver event path evidence and drift classification

### Objective
- Xem xét kịch bản Location Sync, hay Assign Driver bằng cách kiểm tra log trace, runtime evidence.
- Xác định luồng hiện tại đã drift như thế nào so với Architecture diagram `Gateway -> Ride/Driver -> Kafka`.

### Entry Conditions
- Bật env Test cho Ride và Driver.
- Kích hoạt location API.

### Activation Method
- **Manual** or **Script**: Call vào location driver API với UUID đang phục vụ chuyến, kiểm tra message được push qua Kafka. 

### Step-by-step Procedure
1. Call API driver update point tọa độ.
2. Collect logs (winston/docker log) từ Driver Service. (Check in điểm gửi Kafka/HTTP).
3. Đọc Broker message ở Kafka Topic.
4. Đọc logs lắng nghe ở Ride Service xem đã subscribe chưa.
5. Đối soát Runtime Evidence thực sự với sơ đồ topology.

### Required Evidence
- Traces of API / HTTP / WebSocket (nếu có update geo Socket).
- Driver Logs / Ride logs message.
- Broker Topology config / Kafka Queue topic viewer.

### Result Rules
- **PASS**: Request update từ Gateway chọc Driver, Driver sync tọa độ đẩy vào Kafka, Ride listend Kafka (hoặc qua gRPC) ổn định, tuân thủ đúng Path. Có evidence đủ.
- **FAIL**: Crash do Event Consumer failed / Mất Geo update message do không gửi đúng. 
- **MISSING_EVIDENCE**: Service trả status 200 Location Cập nhật, nhưng Ride listend Kafka log trống (consumer lag vô hạn hoặc không bind IP).
- **ARCHITECTURE_DRIFT**: Tài liệu bảo xài WebSockets và Kafka cho Geo Update siêu tốc, nhưng code runtime toàn gọi HTTP POST chay. (Đánh dấu trạng thái Drift để BA/Code Review update architecture / refactor).

### Exit Conditions
- List ra Missing logs hoặc Drift thực tế so với design pattern Eventual Consistency ban đầu.

### Report Mapping
- `workflow_selected = booking-ride-driver`
- `scenario = BRD-2`
- Bắt buộc làm rõ `missing_evidence_or_architecture_drift`.
