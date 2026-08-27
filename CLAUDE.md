# CLAUDE.md — CAB-BOOKING-SYSTEM

Hướng dẫn cho Claude khi làm việc trong dự án này. Ưu tiên: quy tắc dưới đây > hành vi mặc định.

## Behavioral Guidelines (Andrej Karpathy)

Áp dụng skill `andrej-karpathy-skills:karpathy-guidelines` cho mọi việc viết / sửa / refactor code.
**Tradeoff:** các quy tắc này thiên về cẩn trọng hơn là tốc độ. Việc trivial thì dùng phán đoán.

### 1. Think Before Coding
**Đừng giả định. Đừng giấu chỗ mơ hồ. Nêu rõ tradeoff.**
- Nêu giả định rõ ràng trước khi làm. Không chắc thì hỏi.
- Có nhiều cách hiểu → trình bày hết, không tự chọn ngầm.
- Có cách đơn giản hơn → nói ra. Push back khi cần.
- Có chỗ chưa rõ → dừng lại, gọi tên chỗ khó, hỏi.

### 2. Simplicity First
**Ít code nhất để giải quyết vấn đề. Không đầu cơ.**
- Không thêm tính năng ngoài yêu cầu.
- Không abstraction cho code dùng một lần.
- Không "linh hoạt / cấu hình" không được yêu cầu.
- Không xử lý lỗi cho tình huống bất khả thi.
- Viết 200 dòng mà có thể 50 dòng → viết lại.

### 3. Surgical Changes
**Chỉ đụng cái buộc phải đụng. Chỉ dọn phần mình bày ra.**
- Không "cải thiện" code / comment / format xung quanh.
- Không refactor thứ đang chạy tốt.
- Theo style hiện có, kể cả khi mình muốn khác.
- Thấy dead code không liên quan → nêu ra, đừng xóa.
- Xóa import/biến/hàm mà *thay đổi của mình* làm thừa; không xóa dead code có sẵn trừ khi được yêu cầu.
- Test: mỗi dòng thay đổi phải truy được về yêu cầu của user.

### 4. Goal-Driven Execution
**Định nghĩa tiêu chí thành công. Lặp đến khi verify được.**
- "Thêm validation" → "Viết test cho input sai, rồi làm cho pass".
- "Sửa bug" → "Viết test tái hiện bug, rồi làm cho pass".
- "Refactor X" → "Đảm bảo test pass trước và sau".
- Việc nhiều bước: nêu plan ngắn, mỗi bước kèm cách verify.

---

## Project Context

Nền tảng đặt xe (ride-hailing) kiến trúc **microservices, event-driven, AI-enabled, Zero Trust**.

- `services/` — 9 microservice Node.js (auth, booking, driver, user, payment, pricing, review, ride, notification)
- `AI-ML/` — 3 service Python/FastAPI (eta-service, matching-service, surge-pricing-service)
- `gateway/api-gateway/` — API Gateway Node.js (routing, rate limit, circuit breaker, mTLS)
- `apps/` — frontend React (admin-dashboard, customer-app, driver-app)
- `infra/` — docker-compose (local) + docker-swarm (deploy) + mtls
- `message-broker/kafka/`, `data-layer/` (postgresql, mongodb, redis)
- `docs/` — kiến trúc, security audit từng service, benchmark

Tài liệu quy định phạm vi: `docs/spec/CAB-BOOKING-SYSTEM.pdf` (thiết kế kiến trúc) và
`docs/spec/final_PROJECT_grading-factor.pdf` (**121 test case / 12 level** — tiêu chí chấm điểm thực thi).

### Ghi chú trạng thái
- Observability stack (Prometheus / Grafana / Jaeger / ELK — Level 12) **tạm gác**, thêm sau khi hoàn tất các phần khác.
