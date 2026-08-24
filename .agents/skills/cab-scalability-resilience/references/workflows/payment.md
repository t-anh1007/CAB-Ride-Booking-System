# Workflow: payment

## Mục tiêu
Chuẩn hóa resilience review cho quy trình Retry, Backoff và trạng thái an toàn trong Saga payment pattern. Cốt lõi:
- Timeout retry có kèm backoff mũ (Exponential backoff).
- Tính bền vững của retry (Retry persistent state).
- Thất bại hết số lần thử (Exhausted states).
- Tránh trùng lặp thu phí (No-double-charge).
- Khả năng kiểm toán State / Evidence thông qua Outbox message/Event.

## Phạm vi
- `services/payment-service`

---

## Scenario PAY-1: Timeout then success with exponential backoff

### Objective
- Phương thức call payment sẽ được kết thúc thành công sau một vài lần retry hữu hạn.
- Data lưu retry state metadata hoạt động bình thường, không bỏ sót.
- Việc retry qua API đối tác/simulate payment không gây ra việc Duplicate Charge.

### Entry Conditions
- Đã khởi tạo record thanh toán trên Payment service.
- Sử dụng flow "timeout_then_success" từ collection hoặc script setup.
- Cho phép xem history retry, row records db.

### Activation Method
- **Reuse test flow**: Sử dụng flow đã chuẩn bị hoặc test Postman hiện có (`services/payment-service/POSTMAN-TEST.md`).

### Step-by-step Procedure
1. Create a payment intent/record mới.
2. Ghi lại snapshot trạng thái đầu tiên.
3. Kích hoạt tính năng process payment và setup test mock ép buộc trả về `TIMEOUT` timeout cho vài lần thử đầu tiên, rồi `SUCCESS`.
4. Xem xét logs: `retryCount`, `retryHistory`, `nextRetryAt`, states cuối cùng.
5. Kiểm chứng bảng transaction/outbox record: Các lần retry và 1 lần capture có sinh ra Duplicate Capture event không.

### Required Evidence
- Trạng thái record JSON của Payment DB trước và sau chạy.
- Metadata các trường như `retryCount`, lịch sử, thời điểm retry (`nextRetryAt`) trong log/database.
- Transaction history.
- Events outbox hoặc Kafka payload message.
- HTTP response payload.

### Result Rules
- **PASS**: Backoff chuẩn, `retryCount` cập nhật đúng, payment Done một lần an toàn duy nhất (không double charge).
- **FAIL**: Retry không backoff mà nã request liên tục; hoặc sinh nhiều giao dịch record DB; hoặc double charge. Không persist được `nextRetryAt`.
- **MISSING_EVIDENCE**: Test passed theo response API 200, nhưng DB/log không phản ánh số lượng retry hoặc missing outbox event, khó kết luận tính ổn định Saga.
- **ARCHITECTURE_DRIFT**: Kiến trúc engine retry không chạy theo state persistent như map mà chỉ chạy in-memory `setTimeout`.

### Exit Conditions
- Phân loại lỗi và có kết luận an toàn cho pattern backoff trên service payment.

### Report Mapping
- `workflow_selected = payment`
- `scenario = PAY-1`
- `risk`: Nguy cơ cao nhất (Double charge, retry drift).

---

## Scenario PAY-2: Retry exhausted / failed / compensation-safe

### Objective
- Path fail và quá trình end transaction rõ ràng.
- Chắc chắn không có double charge khi timeout số lần chạy retry nỗ lực đạt mức limit.
- Đảo ngược giao dịch (Saga/compensation) rõ ràng, và outbox state không mập mờ treo lửng.

### Entry Conditions
- Payment API và record tồn tại.
- Kịch bản ép buộc nhà cung cấp thanh toán lỗi luôn lập lại để đạt limit.

### Activation Method
- **Manual / Script-assisted** bằng cách ép test mock luôn luôn fail đến kiệt sức.

### Step-by-step Procedure
1. Sinh payment record mới.
2. Call charge API với đối tác nhưng route bị chỉnh thành failed response ép buộc.
3. Chờ backoff thực hiện n lần, đạt limit `exhausted`.
4. Tìm đọc trạng thái Payment db cuối.
5. Soi transaction logs, các exhausted/failed events.
6. Nếu có saga path "refund to user wallet / hủy ride", collect bằng chứng về lệnh bồi thường được kích hoạt.

### Required Evidence
- Payment state đã được check-out thất bại (Status = Failed).
- Events/Outbox logs gồm `payment.retry.exhausted`, hoặc `payment.failed`.
- Saga compensation logs nếu luồng có tính năng hoàn bù tiền.

### Result Rules
- **PASS**: End fail nỗ lực đúng luật. State chốt `FAILED`, đẩy event báo cho booking/ride biết. Hồi nguyên chuẩn xác.
- **FAIL**: Dừng giữa chừng mà báo Success, hoặc treo ở trạng thái `PROCESSING_RETRY` vô thời hạn. Sai lệch state hoặc tạo double transactions trong khi failed.
- **MISSING_EVIDENCE**: Dù payment trả kết quả Timeout Fail, không tìm thấy Outbox messages. (Chưa kết nối hay thiếu log check Outbox).
- **ARCHITECTURE_DRIFT**: Flow mapping document có `payment.retry.exhausted` nhưng mã nguồn runtime thực tế không bắn.

### Exit Conditions
- Chốt lại rủi ro nếu service chết trong trạng thái treo.

### Report Mapping
- `workflow_selected = payment`
- `scenario = PAY-2`
- `fix_guidance`: Trình bày điểm gãy của Transaction state persistence hay Saga misalignment.
