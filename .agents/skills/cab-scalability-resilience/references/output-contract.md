# Output Contract (Skill Output Standard)

Mọi báo cáo (report) khi dùng skill `cab-scalability-resilience` đều phải tuân thủ nghiêm ngặt chuẩn này.

## Các trường dữ liệu bắt buộc (12 fields)
1. `workflow_selected`: Nhóm workflow được chọn (vd: `gateway-auth`, `payment`).
2. `scenario`: Mã và tên scenario (vd: `GA-1 Gateway -> Auth degradation`).
3. `entry_conditions`: Trạng thái ban đầu trước khi kích hoạt test.
4. `step_log`: Tóm tắt các bước đã thực hiện hoặc yêu cầu thủ công (manual/script-assisted).
5. `required_evidence`: Danh sách các bằng chứng cần thu thập theo quy định của scenario.
6. `observed_evidence`: Các bằng chứng thực tế quan sát được (logs snippet, status mã, trạng thái Swarm, DB record).
7. `result_status`: Khóa bắt buộc dùng đúng 1 trong 4 trạng thái (xem Result Status Enum).
8. `pass_fail_summary`: Tổng kết một dòng theo ngôn ngữ `CAB-BOOKING-SYSTEM.docx`.
9. `risk`: Đánh giá rủi ro (Low / Medium / High / Critical) dựa trên ảnh hưởng thực tế nếu gặp ở production.
10. `root_cause`: Nguyên nhân sâu xa nếu có lỗi hoặc drift.
11. `fix_guidance`: Hướng dẫn sửa chữa (config, code fix, etc.).
12. `missing_evidence_or_architecture_drift`: Nêu rõ thông tin thiếu hoặc sự trôi dạt kiến trúc so với thiết kế.

## Result Status Enum
Trường `result_status` KHÔNG được phép sử dụng bất kỳ từ nào ngoài 4 giá trị sau:

- `PASS`: Đã có chứng cứ xác đáng cho thấy hệ thống hoạt động đúng kịch bản phục hồi/chịu lỗi.
- `FAIL`: Đã có chứng cứ xác đáng cho thấy hệ thống không xử lý được sự cố, hoặc hành xử sai (fail-open, double charge, v.v.).
- `MISSING_EVIDENCE`: Thiếu chứng cứ runtime (như logs, traces, state) để có thể xác định rõ ràng sự cố hoặc hành vi hệ thống. Không được cố ý ép PASS nếu rủi ro thiếu log tồn tại.
- `ARCHITECTURE_DRIFT`: Thực tế mã nguồn / runtime không hề cài đặt theo thiết kế quy định (ví dụ: dùng HTTP thay vì Kafka khi docs yêu cầu Kafka Eventual Consistency).

## Output Template
Luôn sử dụng template chuẩn tại [templates/test-report.md](../../templates/test-report.md) để trình bày dữ liệu. Tên file lưu mặc định là dạng: `docs/scalability-resilience/audits/[YYYY-MM-DD]-[Service-Name]-[Scenario-ID].md`.
