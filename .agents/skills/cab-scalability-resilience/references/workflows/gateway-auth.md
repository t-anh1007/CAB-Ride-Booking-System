# Workflow: gateway-auth

## Mục tiêu
Chuẩn hóa resilience review cho luồng Gateway -> Auth, tập trung vào:
- Timeout / Retry / Circuit breaker behavior.
- Khả năng Auth fail-safe (hạ cấp an toàn) thay vì fail-open.
- Refresh rotation & Replay detection.
- Khôi phục nếu Redis (lưu thông tin sessions/revoke) gặp sự cố.

## Phạm vi
- `gateway/api-gateway`
- `services/auth-service`

---

## Scenario GA-1: Gateway -> Auth degradation / timeout / circuit breaker

### Objective
- Xác minh gateway map đúng HTTP Status (503/504) khi downstream timeout hoặc fail.
- Xác minh circuit breaker mở đúng ngưỡng.
- Đảm bảo auth path không fail-open.

### Entry Conditions
- Gateway và Auth service đang health.
- Có route auth kết nối qua gateway/proxy client.
- Có khả năng check logs của gateway hoặc snapshot config circuit-breaker.

### Activation Method
- Kích hoạt **manual** hoặc **script-assisted** bằng cách làm chậm hoặc ngắt downstream (Auth service).
- (Fallback) Nếu không fault được runtime, cài timeout ảo trên env/config test để giả vờ downtime.

### Step-by-step Procedure
1. Thu snapshot baseline của circuit breaker cho auth.
2. Gọi các route auth trong trạng thái bình thường (baseline response).
3. Gây lỗi timeout hoặc service unavailable cho auth downstream.
4. Call lại auth route cho đến khi gặp timeout hoăc nhận lỗi do `CIRCUIT_OPEN`.
5. Check proxy request logs và circuit breaker status/log.
6. Lấy Response code, correlation headers.
7. (Tùy chọn) Check `docker service ps/logs` nếu thực hiện downtime container thật.

### Required Evidence
- Gateway proxy logs.
- Snapshot / Log Circuit breaker mở-đóng theo các thay đổi trạng thái.
- HTTP Responses, Status code (thường là 503, không được return 200/401 chập chờn khi down).
- Request ID / Correlation ID.
- Swarm state (nếu có).

### Result Rules
- **PASS**: Chuyển lỗi kịp thời (503/504), circuit breaker mở theo rule, chặn requests tiếp, hoàn toàn fail-safe.
- **FAIL**: Gateway cứ trả lỗi 200 mà nuốt payload, hoặc rơi vào trạng thái Fail-Open (vẫn pass qua Auth).
- **MISSING_EVIDENCE**: Request thất bại nhưng không có file log hay trace nào sinh ra để tra cứu breaker metric.
- **ARCHITECTURE_DRIFT**: Proxy client không tích hợp cơ chế breaker như code khai báo hoặc bypass auth sai luồng.

### Exit Conditions
- Báo cáo kết luận chính xác Result Status và ghi nhận mapping status.

### Report Mapping
- `workflow_selected = gateway-auth`
- `scenario = GA-1`
- `risk`: Dựa trên mức fail-open (critical) hoặc timeout treo (high).

---

## Scenario GA-2: Refresh rotation / replay detection / Redis fail-safe

### Objective
- Xác minh Refresh token xoay vòng và tái dùng bị phát hiện (replay guard).
- Family/sessions token tree bị revoke nếu trộm tái sử dụng token thành công/thất bại.
- Dependencies lỗi (như Redis) không được phép bỏ qua luồng check và issue token mới.

### Entry Conditions
- Có Refresh token hợp lệ.
- Có khả năng đọc cache states/audit log tại DB hoặc backend log.

### Activation Method
- **Reuse** luồng call refresh token từ `docs/architecture/postman_collection.json`.
- Manual: Call 2 lần với 1 refresh token (lần 1 thành công lấy token mới chờ, lần 2 cố tái dụng refresh lấy access token khác).

### Step-by-step Procedure
1. Sinh user/session lấy refresh-token valid.
2. Refresh lần 1 (lấy được token family mới). 
3. Refresh lần 2 BẰNG CHÍNH TOKEN cũ.
4. Đọc audit log, error logs, kiểm tra cờ revoke_marker session nếu có.
5. (Advanced) Giả lập Redis unavailable => Gọi refresh => phải trả về lỗi hệ thống, không được pass và nhả access_token (không fail-open).

### Required Evidence
- Auth logs (winston/audit logs).
- HTTP response sau replay (401/403 block).
- Các marker của việc xóa sessions (nếu có log ở redis auth token).

### Result Rules
- **PASS**: Bị lỗi 4xx khi gửi refresh token bị tái sử dụng. Các access token thuộc cùng chain lập tức invalidation.
- **FAIL**: Token vẫn được cấp mới dù refresh token tái dụng, hoặc redis sập auto assume "không có token trong blacklist => cấp tiếp", hay được coi là Redis fail-open (Critical FAIL).
- **MISSING_EVIDENCE**: Request block/refresh nhưng log tại Auth hoàn toàn trắng, backend nuốt lỗi hoặc không thể coi được state.
- **ARCHITECTURE_DRIFT**: Logic replay guard hoàn toàn không được thiết kế như documentation.

### Exit Conditions
- Cập nhật đủ replay & fail-open result status.

### Report Mapping
- `workflow_selected = gateway-auth`
- `scenario = GA-2`
- `root_cause`: Nêu do quên Redis fail-open check hay thiếu Replay Guard check.
