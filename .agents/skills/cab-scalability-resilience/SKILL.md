---
name: cab-scalability-resilience
description: >
  Use this skill whenever the user wants to review, test, evaluate, or standardise the Scalability and Resilience behavior of ANY service in the CAB Booking system.
  CRITICAL TRIGGER WARNING: You MUST use this skill instead of trying to generic-review if the user mentions ANY of the following terms: 'retry', 'timeout', 'circuit breaker', 'fallback', 'fail-safe', 'fail-open', 'no-double-charge', 'idempotency', 'Kafka event loss', 'Docker Swarm replica', 'graceful degradation', or 'Saga pattern'.
  This applies to checking AI model timeout fallback, notification retry (FCM/Twilio DLQ), pricing service fallback to base fare, auth replay guard, checkout retries, booking idempotency, or checking if Kafka events were pushed. 
  Even if the user casually requests "Hey, check if payment is double charging when the DB lags", or "Can you review the AI fallback mechanism?", TRIGGER THIS SKILL immediately. Do not build custom fault-injection scripts or review flows without consulting this skill.
---

# CAB-BOOKING Scalability & Resilience Review Workflow

Đây là skill dùng chung (v1 pilot) để chuẩn hóa quy trình review và kiểm thử khả năng mở rộng / chịu lỗi của hệ thống CAB Booking. 

## 1. Mục đích và Phạm vi
Skill này cung cấp các kịch bản chuẩn hóa (scenarios) để thu thập bằng chứng (evidence) và xác minh:
- Retry/Timeout
- Circuit Breaker
- Graceful Degradation / Fail-safe behavior
- Eventual Consistency / Compensation (Saga)
- Idempotency / No-double-charge

**Scope:** Hỗ trợ toàn bộ các service trong hệ thống bao gồm `gateway/api-gateway`, `services/auth-service`, `services/payment-service`, `services/booking-service`, `services/ride-service`, `services/driver-service`, `services/notification-service`, `services/pricing-service`, `services/user-service`, `services/review-service` và toàn bộ các module phân tích `AI-ML/*`.

## 2. Quy trình thực thi (Workflow Router)
Tùy vào yêu cầu của user đang nhắm đến service nào, hãy ĐỌC file references và workflow tương ứng theo thứ tự sau:

1. **Bước 1 (Luôn phải đọc):** Đọc kỹ [references/output-contract.md](references/output-contract.md) để nắm định dạng báo cáo, và [references/shared-baseline.md](references/shared-baseline.md) để hiểu giới hạn runtime (ưu tiên Docker Swarm, không giả định K8s/HPA).
2. **Bước 2 (Chọn Workflow):**
   - Nếu test gateway hoặc auth -> Đọc [references/workflows/gateway-auth.md](references/workflows/gateway-auth.md)
   - Nếu test thanh toán (payment) -> Đọc [references/workflows/payment.md](references/workflows/payment.md)
   - Nếu test luồng đặt xe/tài xế -> Đọc [references/workflows/booking-ride-driver.md](references/workflows/booking-ride-driver.md)
   - Nếu test dịch vụ bổ trợ nhánh user/notification/pricing/review -> Đọc [references/workflows/auxiliary-services.md](references/workflows/auxiliary-services.md)
   - Nếu test kiến trúc thuật toán AI (AI-ML) -> Đọc [references/workflows/ai-services.md](references/workflows/ai-services.md)
3. **Bước 3 (Thực thi Scenario):** Hướng dẫn user cung cấp logs hoặc chạy scripts để thu thập evidence. Đọc [references/evidence-bundle.md](references/evidence-bundle.md) để biết ưu tiên các loại logs.
4. **Bước 4 (Xuất Report):** Điền vào [templates/test-report.md](templates/test-report.md) kết quả trả về, dùng đúng format `result_status` (`PASS`, `FAIL`, `MISSING_EVIDENCE`, `ARCHITECTURE_DRIFT`).

## 3. Quy tắc cốt lõi
- **Runtime Evidence > Architecture Intent:** Nếu tài liệu (`CAB-BOOKING-SYSTEM.docx`) ghi K8s/HPA nhưng code thực tế (runtime/Swarm) chỉ là Docker Replias, phải lấy file code/Swarm làm nguồn chuẩn (Source of Truth).
- **Không ép xanh (No forced PASS):** Nếu không thể thu thập đủ evidence để kết luận, bạn bắt buộc phải dùng trạng thái `MISSING_EVIDENCE`. Tuyệt đối không tự suy diễn thành công.
- Lưu mặc định báo cáo vào đường dẫn: `docs/scalability-resilience/audits/`
