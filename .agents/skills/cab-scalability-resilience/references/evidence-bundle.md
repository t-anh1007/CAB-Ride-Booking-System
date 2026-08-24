# Evidence Bundle Rules

Luật chung về việc thu thập logs và bằng chứng (Evidence) để đưa ra kết luận đánh giá trong các báo cáo của cab-scalability-resilience.

## 1. Ưu tiên Evidence (Top-down)
1. `runtime code/config evidence`
2. `service logs`
3. `gateway/proxy logs`
4. `Docker Swarm service state`
5. `Kafka consumer/producer state`
6. `DB/Redis observable state`
7. `HTTP response/status/payload`
8. `request ID / correlation ID`
9. `docs/architecture` và `docs/security` để đối chiếu
10. `CAB-BOOKING-SYSTEM.docx` dùng để đối chiếu architectural intent

## 2. Các yêu cầu bắt buộc khi lập Evidence Bundle
Bất kì "quan sát" nào cũng cần trả lời được:
- Bằng chứng này thuộc **service nào**, thuộc **scenario** nào? (Không lấy chắp vá râu ông nọ cắm cằm bà kia).
- Có timestamp, log context, hay **Correlation ID / Request ID** rõ ràng đi kèm để định danh không?
- Đủ để xác nhận `PASS` hay `FAIL` không?

## 3. Khách quan với Missing Evidence
Hệ thống không phải lúc nào cũng in log đầy đủ.
- Nếu không thấy retry trong log DB/Event list, thì đánh giá là `MISSING_EVIDENCE`.
- **Tuyệt đối không:** Thấy service trả status 200 mà nhắm mắt gán "đảm bảo cơ chế No-Double-Charge thành công" nếu không có log hay giao dịch trong Database làm bằng chứng bảo lưu.
