
## 📑 Kịch bản Kiểm thử API (Postman Testing)

Dưới đây là danh sách kịch bản kiểm thử chi tiết được thực hiện qua **Postman** để xác thực nghiệp vụ của Booking Service.

| ID | Level / Priority | Test-cases | Context | Input (Request Body/Header) | Expected Result (Response) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **3** | L1 / P0 | Tạo booking hợp lệ | User đã login, driver available | `{"pickup": {"lat": 10.76, "lng": 106.66}, "drop": {"lat": 10.77, "lng": 106.70}, "distance_km": 5}` | HTTP 201; status = REQUESTED; Có booking_id; Gọi ETA + Pricing thành công |
| **4** | L1 / P1 | Lấy danh sách booking | User đã có ít nhất 1 booking | `GET /bookings?user_id=123` | HTTP 200; Trả về list booking; Mỗi item có booking_id, status |
| **6** | L1 / P0 | Trạng thái mặc định | Booking vừa tạo thành công | `POST /bookings` | status ban đầu phải là REQUESTED; Có timestamp created_at |
| **11** | L2 / P1 | Booking thiếu pickup | User gửi request thiếu field | `{"drop": {"lat": 10.77, "lng": 106.70}}` | HTTP 400 Bad Request; Message: "pickup is required"; Không tạo booking |
| **12** | L2 / P1 | Sai format lat/lng | Input sai kiểu dữ liệu | `{"pickup": {"lat": "abc", "lng": 106.66}}` | HTTP 422 Unprocessable Entity; Validation error từ schema |
| **13** | L2 / P2 | Driver offline | Không có driver online | Request booking hợp lệ | Booking status = PENDING hoặc FAILED; Trả message: "No drivers available" |
| **15** | L2 / P2 | ETA với distance = 0 | Vị trí đón trùng vị trí trả | `{"distance_km": 0}` | eta = 0; Hệ thống không crash; Không trả giá trị âm |
| **19** | L2 / P0 | Chống trùng lặp | User bấm đặt xe liên tục | Cùng `Idempotency-Key` trong Header | Chỉ tạo 1 booking duy nhất; Request thứ 2 trả kết quả của request đầu tiên |
| **21** | L3 / P1 | Tích hợp AI ETA | Booking gọi nội bộ AI ETA | `POST /bookings` | Response từ Booking chứa thông tin eta > 0; Không bị timeout |
| **22** | L3 / P1 | Tích hợp Pricing | Booking gọi nội bộ Pricing | `POST /bookings` | Response từ Booking chứa price > 0; surge >= 1 |
| **25** | L3 / P0 | Publish Event Kafka | Sau khi tạo record thành công | Kiểm tra Kafka (console consumer) | Có event ride_requested đúng ride_id; Đúng Topic ride_events |
| **27** | L3 / P1 | Cập nhật ACCEPTED | Tài xế chấp nhận chuyến xe | `PATCH /bookings/{id}/accept` | Status chuyển từ REQUESTED → ACCEPTED; DB cập nhật thành công |
| **29** | L3 / P1 | Route qua Gateway | Request đi qua API Gateway | `POST /gateway/bookings` | Gateway điều hướng đúng; Trả về dữ liệu từ Booking Service |


