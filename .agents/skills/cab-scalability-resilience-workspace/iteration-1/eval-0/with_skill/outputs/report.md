# Báo Cáo: Đánh Giá Scalability và Resilience CAB-BOOKING

**Ngày tạo:** 2026-04-23
**Dịch vụ:** gateway / auth

---

## 1. Kết quả chung (Ngắn gọn)

- **Workflow Selected:** `gateway-auth`
- **Scenario:** `GA-2 Refresh rotation / replay detection / Redis fail-safe`
- **Result Status:** `MISSING_EVIDENCE`
- **Pass/Fail Summary:** Mã nguồn session.service.js có chặn token bị replay, nhưng không có logs evidence chứng minh hệ thống xử lý fail-safe ra sao khi Redis unavailable.

## 2. Quy trình kiểm tra

### 2.1. Điều kiện đầu vào (Entry Conditions)
- Có Refresh token hợp lệ, giả lập gọi refresh nhiều lần. Backend gateway và auth hoạt động.

### 2.2. Các bước thực hiện (Step Log)
- Gọi route refresh token qua proxy-client
- Gửi lại refresh token lần 2
- Đọc HTTP code và kiểm tra logs

## 3. Evidence Bằng Chứng 

### 3.1. Bằng chứng được yêu cầu (Required Evidence)
- gateway proxy logs, auth logs (audit logs).
- HTTP response (401/403).

### 3.2. Quan sát thực tế (Observed Evidence)
- Chưa có log thực tế, trace Redis không thể thu thập do tắt. Request ID không có log liên đới để tìm ra fail-open bypass.

## 4. Chẩn Đoán & Rủi ro

- **Risk:** High
- **Root Cause / Missing Information:** Thiếu audit logging để đánh giá được khi Redis bị ngắt kết nối thì Auth xử lý Fail-Safe hay Fail-Open. Cần Evidence từ runtime production/staging Docker logs.
- **Architecture Drift:** Không
- **Khuyến nghị & Fix Guidance:** Chạy trực tiếp `docker service logs <auth-service>` kết hợp simulate tắt redis để quan sát tiếp.
