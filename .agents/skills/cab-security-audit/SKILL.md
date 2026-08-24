---
name: cab-security-audit
description: >
  Expert Zero Trust security auditor for CAB-BOOKING. Automates the 11 security review workflows
  defined in docs/security/. Identifies IDOR, socket auth bypass, PII leaks, and gateway gaps.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
effort: high
tags: [security, audit, zero-trust, cab-booking, microservices]
---

# /cab-security-audit

Automated Zero Trust security auditor for the CAB-BOOKING microservices ecosystem.

---

## Khi nào sử dụng (When to Use)

- **Manual Audit**: Trước khi release một service mới hoặc sau một đợt refactor lớn.
- **Continuous Compliance**: Rà soát định kỳ để đảm bảo code không bị lệch (drift) so với kiến trúc Zero Trust.
- **P0 Triage**: Khi phát hiện lỗi bảo mật, dùng skill này để scan các "adjacent scenarios" của service đó.

---

## 1. Danh sách Workflows Orchestration

Skill này ánh xạ trực tiếp tới 11 file workflow trong `docs/security/`:

| Service | Documentation | Domain |
| :--- | :--- | :--- |
| `auth` | `auth-service-security.md` | Identity, JWT, MFA |
| `booking` | `booking-service-security.md` | Ride Creation, Price Snapshots |
| `driver` | `driver-service-security.md` | KYC, Profile, Status |
| `notification` | `notification-service-security.md` | Kafka Consumers, Dispatcher |
| `payment` | `payment-service-security.md` | Transactions, Webhooks, Idempotency |
| `pricing` | `pricing-service-security.md` | Fare Calculation, Surge Rules |
| `review` | `review-service-security.md` | Rating Integrity, XSS |
| `ride` | `ride-service-security.md` | Lifecycle, GPS, WebSockets |
| `user` | `user-service-security.md` | PII, Ownership |
| `eta` | `eta-service-security.md` | Prediction Integrity |
| `ml` | `ml-platform-service-security.md` | Inference Auth, Dataset Access |

---

## 2. Lệnh chính (Primary Commands)

### `audit <service>`
Thực hiện audit chuyên sâu cho một service cụ thể.

**Quy trình thực hiện:**
1. Đọc file `docs/security/<service>-service-security.md`.
2. Trích xuất mục **"Files/Paths To Review First"**.
3. Đọc source code các file đó trong project.
4. Áp dụng nội dung trong **"AI Review Prompt"** của chính file workflow đó.
5. Kiểm tra chéo với **"Zero Trust Baseline"** (2.1 - 2.15).
6. Lưu báo cáo vào file `<DD-MM-YYYY>-<service>-service.md` và tạo/cập nhật `checklist-<service>.md` trong thư mục `docs/security/audits/`.
7. Xuất kết quả ra màn hình theo **"Findings Template"**.
8. **Verify phase**: Khi chạy audit lại, nếu phát hiện checklist đã được đánh dấu PASS, phải rà soát code thực tế để xác nhận fix đã tồn tại mới được chấp nhận kết quả PASS trong báo cáo chính thức.

### `audit-all`
Chạy scan nhanh (baseline) cho tất cả 11 services để tìm ra các P0 critical gaps nhanh chóng.

### `gap-analysis`
Phân tích lỗ hổng chéo giữa Gateway và Downstream (Phần 15 trong các docs).
- Tìm các endpoint downstream nhận `userId`/`driverId` trực tiếp từ payload mà không verify ownership.
- Kiểm tra tính nhất quán của event contracts.

---

## 3. Workflow thực hiện chi tiết (Step-by-Step)

### Bước 1: Thu thập ngữ cảnh (Context Gathering)
Xác định service cần review và load instruction tương ứng.
```bash
# Ví dụ: audit ride
cat docs/security/ride-service-security.md
```

### Bước 2: Scan Files
Review các file code quan trọng nhất. Luôn bắt đầu từ:
- Routes/Controllers (Entry point)
- Services/Domain Logic (Authority)
- Realtime/Socket handlers (Side-channels)
- Message Broker producers/consumers (Event boundary)

### Bước 3: So sánh Identity Context
**Quan trọng nhất**: Kiểm tra xem identity (`userId`/`driverId`) đi từ Gateway có được propagate đúng và verify ở Downstream hay không.
- Tìm các pattern `req.body.userId` hoặc `req.params.userId` mà không có check với `req.user.id`.

### Bước 4: Đánh giá State Machine
Đối với các service như `ride` hay `payment`, kiểm tra tính hợp lệ của việc chuyển đổi trạng thái (State Transition).

---

## 4. Output Template (Kết quả đầu ra)
- **Ngôn ngữ**: Phải sử dụng **tiếng Việt** cho toàn bộ nội dung báo cáo.
- **Độ chi tiết**: Phải ghi **đầy đủ chi tiết**, không rút gọn text, liệt kê rõ từng lỗ hổng và bằng chứng cụ thể.
### 0. Yêu cầu lưu trữ (Persistence)
- **Đường dẫn**: `docs/security/audits/`
- **File Báo cáo**: `<DD-MM-YYYY>-<service>-service.md` (Ghi lại lịch sử từng lần audit).
  - **Ngôn ngữ**: Phải sử dụng **tiếng Việt** cho toàn bộ nội dung báo cáo.
  - **Độ chi tiết**: Phải ghi **đầy đủ chi tiết**, không rút gọn text, liệt kê rõ từng lỗ hổng và bằng chứng cụ thể.
- **File Checklist**: `checklist-<service>.md` (File tương tác để track trạng thái fix của developer).

### 1-bis. Cấu trúc Checklist Fix Tracking (`checklist-<service>.md`)
File này liệt kê các mục `FAIL` hoặc `Missing evidence`, kèm gợi ý fix. Người dùng sẽ check `[x]` sau khi hoàn thành.
- **Ràng buộc**: Auditor không được tin vào dấu check của người dùng nếu không tìm thấy thay đổi code tương ứng.
- **Format**:
  - [ ] **Risk**: [Tên rủi ro]
    - **Severity**: P0/P1/P2
    - **Gợi ý Fix**: [Hướng dẫn cụ thể các file cần sửa]
    - **Trạng thái**: Pending / Verified (do Auditor đánh dấu sau khi check)

Luôn trả về kết quả theo cấu trúc sau:

### 1. Findings Table
| # | Finding | Severity | Evidence Path | Fix Direction |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Socket Auth Bypass | 🔴 P0 | `ride-service/src/realtime/socket.js:12` | Implement JWT handshake |

### 2. PASS/FAIL Checklist
Ghi rõ trạng thái: `Implemented` / `Expected by architecture` / `Missing evidence` / `Security inconsistency`.

### 3. Cross-Service Gaps
(Nếu phát hiện rò rỉ hoặc mâu thuẫn giữa Gateway/Broker và Service).

### 4. Fix Priority (P0 -> P2)

---

## 5. Quy tắc vàng (Golden Rules)

- **Never assume gateway handled it**: Nếu một service có side-channel (WebSocket trực tiếp, internal route), phải bảo mật nó độc lập.
- **Evidence-based only**: Chỉ ghi `PASS` khi thấy code thật. Còn lại ghi `Missing evidence`.
- **Zero Trust by Default**: Không tin tưởng traffic nội bộ (Swarm Overlay). Kiểm tra identities trên từng call.
