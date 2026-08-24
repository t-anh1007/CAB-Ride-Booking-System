# Báo cáo Rà soát Bảo mật CAB-BOOKING - AUTH-SERVICE

**Ngày thực hiện**: 21-04-2026
**Đối tượng rà soát**: `services/auth-service`
**Mô hình đánh giá**: Zero Trust Baseline

---

### 1. Bảng kết quả các lỗ hổng (Findings Table)

| # | Lỗ hổng (Finding) | Mức độ | Đường dẫn bằng chứng (Evidence Path) | Hướng khắc phục (Fix Direction) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Lộ lọt mã bí mật MFA trong Database** | 🔴 **P0** | `mfa.service.js:128`, `schema.sql:99` | Cột `secret_encrypted` trong bảng `mfa_enrollments` hiện đang lưu mã TOTP secret ở dạng bản rõ (Base32). Cần thực hiện mã hóa (ví dụ: AES-256-GCM) trước khi lưu vào DB. |
| 2 | **Tên cột gây nhầm lẫn (Misleading Naming)** | 🟡 **P1** | `schema.sql:99` | Tên cột là `secret_encrypted` nhưng code thực tế không hề có logic mã hóa, tạo ra sự chủ quan sai lầm về mức độ bảo mật. |
| 3 | **Truyền tin nội bộ không mã hóa (Plaintext Traffic)** | 🔴 **P0** | `docker-stack.yml:259-277` | Kafka listener và các endpoint nội bộ của service hiện đang dùng giao thức không mã hóa (PLAINTEXT), cho phép rò rỉ dữ liệu nhạy cảm nếu mạng nội bộ bị xâm nhập. |
| 4 | **Thiếu hệ thống quản lý Secret tập trung** | 🟡 **P1** | `docker-stack.yml:137-152` | Các thông tin nhạy cảm (Private Key, Password DB) đang được cấp qua biến môi trường (ENV). Cần chuyển sang dùng Docker Secrets hoặc Vault. |
| 5 | **Thiếu bằng chứng về quy trình xoay vòng khóa (Key Rotation)** | 🔵 **P2** | `lib/jwt.js:136-140` | Mặc dù code có hỗ trợ `previousKid`, nhưng chưa thấy script hoặc quy trình thực tế để tự động xoay vòng cặp khóa JWT công khai/bí mật. |

---

### 2. Danh sách kiểm tra PASS/FAIL (Checklist)

| Yêu cầu bảo mật | Trạng thái | Bằng chứng / Ghi chú |
| :--- | :--- | :--- |
| **Kiểm tra chữ ký JWT (iss, aud, alg)** | ✅ **PASS** | `Implemented`: `lib/jwt.js:91-93` thực hiện kiểm tra đầy đủ Claims và thuật toán RS256. |
| **Xoay vòng Token (Refresh Rotation)** | ✅ **PASS** | `Implemented`: `session.service.js:161-173` cấp token mới sau mỗi lần refresh. |
| **Phát hiện sử dụng lại Refresh Token (Replay)** | ✅ **PASS** | `Implemented`: `session.service.js:116-135` thu hồi toàn bộ session family khi phát hiện reuse. |
| **Bắt buộc MFA cho Quản trị viên (Admin)** | ✅ **PASS** | `Implemented`: `admin-auth.service.js:98-104` yêu cầu challenge trước khi cấp token truy cập. |
| **Bảo vệ chống Brute-force** | ✅ **PASS** | `Implemented`: `auth-rate-limit.middleware.js` giới hạn tần suất đăng nhập/thách đố MFA. |
| **Mã hóa kết nối nội bộ (mTLS)** | ❌ **FAIL** | `Missing evidence`: Hiện tại vẫn phụ thuộc hoàn toàn vào mạng nội bộ của Docker Swarm. |

---

### 3. Lỗ hổng bảo mật liên dịch vụ (Cross-Service Gaps)

- **Sự phụ thuộc vào Gateway**: Hệ thống tin tưởng hoàn toàn vào việc Gateway đã làm sạch dữ liệu, nhưng bản thân `auth-service` và các service khác cần cơ chế verify chéo để đảm bảo tính Zero Trust thực thụ (không tin bất kỳ ai, kể cả Gateway nội bộ).

---

### 4. Thứ tự ưu tiên khắc phục (Fix Priority)

- **Mức P0 (Ưu tiên khẩn cấp)**:
    - Thực hiện mã hóa mã bí mật MFA ngay lập tức trước khi lưu vào DB.
    - Chuyển đổi Kafka và liên lạc giữa các service sang TLS/SSL.
- **Mức P1 (Ưu tiên cao)**:
    - Triển khai quản lý Secret tập trung (Docker Secrets).
    - Đồng bộ hóa logic rà soát quyền sở hữu (ownership) ở các service downstream.
- **Mức P2 (Ưu tiên trung bình)**:
    - Tự động hóa quy trình xoay vòng khóa JWT.
    - Cải thiện hệ thống Log/Trace với Correlation ID đầy đủ.
