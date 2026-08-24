# Shared Baseline Resilience & Source of Truth

Tài liệu này định nghĩa các nguyên tắc nền tảng áp dụng trên toàn bộ bài review Scalability & Resilience, nhằm đảm bảo nhận định của Agent (hoặc Tester) sát với cấu trúc repo hiện hành (không bịa đặt hay suy diễn theo chuẩn lý tưởng màng màng).

## 1. Source of Truth Priority (Thứ tự ưu tiên nguồn sự thật lõi)
Bất cứ khi nào skill bị phân vân, hãy tuân theo thứ tự sau:

1. **Runtime code / Config:** Mã nguồn tại thư mục `src/`, file `docker-stack.yml`, `*policy.json`. (Đây là thực tế tàn khốc).
2. **Deployment artifacts:** Kết quả lệnh `docker service ls/ps/logs` (Nếu được run trên môi trường thật).
3. **Message Topology / Platform Architecture:** `message-broker/kafka/topology.json`.
4. **Docs / Security:** `docs/architecture/*`, `docs/security/*`.
5. **Architectural intent:** `CAB-BOOKING-SYSTEM.docx`. (Chỉ dùng lấy chủ đích thiết kế, KHÔNG dùng làm evidence để nói rằng hệ thống đã implement).

## 2. Docker Swarm vs K8s / HPA (Rủi ro quan trọng)
- **Deployment Actuality:** Repo hiện tải sử dụng Docker Swarm (`infra/docker-swarm/*`), KHÔNG có Kubernetes hay HPA (Horizontal Pod Autoscaler).
- Mọi mô tả về auto-scaling phải tham chiếu dựa trên số lượng Replicas của Swarm và biến cấu hình trong file stack. Tránh nhắc đến "`kubectl scale`".

## 3. Các mẫu chịu lỗi cốt lõi (5 Core Patterns)
Khi nhắc đến "Scalability & Resilience", ngầm định hệ thống cần thỏa mãn, hoặc ít nhất thiết kế phải cân nhắc 5 Pattern sau:

- **Replica/Scale (Tương đương HPA intent):** Mở rộng tính bằng bản sao instance.
- **Circuit Breaker:** Đứt gãy ngắt mạch, điển hình ở API Gateway sang Backend Services.
- **Retry / Timeout:** Backoff lũy thừa, giới hạn giới hạn thời gian đáp ứng để tránh treo luồng.
- **Graceful Degradation:** Hệ thống hạ cấp khi Downstream chết (Vd: Auth down, không fail-open).
- **Eventual Consistency:** Nhất quán qua thông điệp, Kafka Dead-letter queues.

Và 3 Pattern ngữ cảnh bổ sung chuyên để test luồng rủi ro cao:
- **Bulkhead Isolation:** Phân lập hầm tàu.
- **Idempotency:** An toàn replay (Vd: Booking `Idempotency-Key`).
- **Saga Pattern / Compensation:** Đền bù rollback phân tán (Vd: Payment Saga).
