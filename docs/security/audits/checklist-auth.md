# Security Fix Checklist - AUTH-SERVICE

Tài liệu này dùng để theo dõi tiến độ khắc phục các lỗ hổng bảo mật được phát hiện trong các đợt audit.
*Lưu ý: Chỉ đánh dấu [x] sau khi đã thực hiện fix code. Auditor sẽ verify lại dựa trên mã nguồn thực tế.*

---

## 🔴 P0 - Critical Risks

- [ ] **Risk**: **MFA Secret Exposure in DB** (Bản rõ TOTP secret trong database)
    - **Gợi ý Fix**: 
        - Cập nhật `services/auth-service/src/services/mfa.service.js`.
        - Sử dụng thư viện `crypto` để mã hóa `secretBase32` (ví dụ: AES-256-GCM) trước khi gọi `INSERT`.
        - Cần có cơ chế quản lý Key mã hóa (Master Key) an toàn.
    - **Trạng thái**: Pending

- [ ] **Risk**: **Internal Plaintext Communication** (Kafka & Internal URLs)
    - **Gợi ý Fix**: 
        - Cập nhật `infra/docker-swarm/docker-stack.yml`.
        - Bật SSL/TLS cho Kafka listener.
        - Chuyển đổi các URL service nội bộ từ `http://` sang `https://` (yêu cầu cấu hình certificate cho mỗi service).
    - **Trạng thái**: Pending

---

## 🟡 P1 - High Risks

- [ ] **Risk**: **Lack of Secret Management** (Hardcoded/ENV secrets)
    - **Gợi ý Fix**: 
        - Sử dụng Docker Secrets cho môi trường production.
        - Thay đổi code load config trong `services/auth-service/src/config/env.js` để đọc từ `/run/secrets/`.
    - **Trạng thái**: Pending

- [ ] **Risk**: **Downstream Ownership Validation Gap** (Cross-service Trust)
    - **Gợi ý Fix**: 
        - Rà soát `ride-service`, `booking-service`.
        - Không tin hoàn toàn vào `x-user-id` từ Gateway.
        - Thực hiện verify lại token hoặc check resource ownership tại tầng Service logic.
    - **Trạng thái**: Pending

---

## 🔵 P2 - Medium Risks

- [ ] **Risk**: **Missing Key Rotation Workflow**
    - **Gợi ý Fix**: 
        - Tạo script CLI để tự động generate key pair mới, cập nhật environment variables/secrets và thực hiện rolling update.
    - **Trạng thái**: Pending

- [ ] **Risk**: **Observability - Missing Correlation ID in Notifications**
    - **Gợi ý Fix**: 
        - Cập nhật `services/auth-service/src/services/otp-auth.service.js`.
        - Đảm bảo `requestId` hoặc `correlationId` được gửi kèm trong payload sang `notification-service`.
    - **Trạng thái**: Pending
