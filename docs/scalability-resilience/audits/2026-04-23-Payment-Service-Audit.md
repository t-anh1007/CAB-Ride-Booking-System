# Báo Cáo: Đánh Giá Scalability và Resilience CAB-BOOKING

**Ngày tạo:** 2026-04-23
**Dịch vụ:** payment-service

---

## 1. Kết quả chung (Ngắn gọn)

- **Workflow Selected:** `payment`
- **Scenario:** `PAY-1 (Retry/Timeout) & PAY-2 (Saga/Exhausted)`
- **Result Status:** `FAIL`
- **Pass/Fail Summary:** Mặc định sử dụng chiến lược retry có backoff và persistence, tuy nhiên kiến trúc có lỗ hổng lớn về Race Condition trong `confirmPayment` có thể dẫn đến Double Charge và rủi ro mất trạng thái retry khi service restart (In-memory loop).

## 2. Quy trình kiểm tra

### 2.1. Điều kiện đầu vào (Entry Conditions)
- Phân tích mã nguồn tại `services/payment-service/src/services/paymentService.js` và `retryEngine.js`.
- Kiểm tra tính nhất quán giữa file `FLOW-MAPPING.md` và thực tế logic `confirmPayment`.

### 2.2. Các bước thực hiện (Step Log)
- Review login `confirmPayment` để tìm cơ chế khóa (locking/atomicity).
- Review `retryEngine.js` về thuật toán backoff và tính bền vững (persistence).
- Phân tích cơ chế sinh `providerRef` để kiểm tra tính Idempotency khi gọi sang Provider bên thứ 3.

## 3. Evidence Bằng Chứng 

### 3.1. Bằng chứng được yêu cầu (Required Evidence)
- Log ghi nhận retry backoff chuẩn (exponential).
- Cơ chế Idempotency-Key và status locking.
- Persistent state của `nextRetryAt`.

### 3.2. Quan sát thực tế (Observed Evidence)
- **Thiếu Status Locking:** Trong `confirmPayment`, dòng 162 cập nhật trạng thái lên `PROCESSING`. Tuy nhiên, không có bước kiểm tra nguyên tử (atomic check) hoặc lock mức DB để ngăn chặn 2 request đồng thời cùng nhảy vào `confirmPayment` khi trạng thái đang là `PENDING`.
- **Double Charge Risk (External):** `paymentProviders.js` dòng 13 sinh `providerRef` mới mỗi khi hàm `charge` được gọi nếu không có truyền từ payload (mặc định là null). Vì `retryEngine.js` gọi lại hàm charge nhiều lần trong loop, mỗi lần sẽ sinh một `providerRef` mới -> Provider coi là giao dịch mới -> **Double Charge thật sự xảy ra trên môi trường thật.**
- **In-memory Transient Loop:** `retryEngine.js` dòng 41 sử dụng `sleep(delayMs)` ngay trong luồng request. Nếu container bị restart, toàn bộ tiến trình retry bị mất và record bị treo ở trạng thái `PROCESSING`.

## 4. Chẩn Đoán & Rủi ro

- **Risk:** Critical
- **Root Cause / Missing Information:** Logic retry và sinh identity cho provider request không đồng bộ. Thiếu optimistic locking hoặc phân tách scheduling retry (Outbox/Job Queue).
- **Architecture Drift:** `FLOW-MAPPING.md` ghi nhận `retry metadata is persisted`, nhưng thực tế việc thực thi (execution) lại là in-memory (drift so với kỳ vọng về Resilience của một hệ thống tài chính). 

## 5. Khuyến nghị & Fix Guidance
1. **Fix Idempotency Mapping:** `providerRef` phải được sinh 1 lần duy nhất khi bắt đầu `PROCESSING` và lưu vào DB, sau đó dùng chung cho tất cả các lần retry của record đó.
2. **Status Lock:** Sử dụng Optimistic Locking (ví dụ: `update ... where status = 'PENDING'`) để tránh race condition khi có nhiều gateway nodes gọi song song.
3. **Persistent Retry:** Chuyển `nextRetryAt` và retry task vào một scheduler/worker thực thụ thay vì `sleep` trong code.
