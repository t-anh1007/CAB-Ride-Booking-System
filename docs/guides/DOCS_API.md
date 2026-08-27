# CAB Booking System - API Documentation

Tài liệu này mô tả chi tiết các API (OpenAPI Specification) cho từng microservice trong hệ thống CAB Booking.

---

## 1. Auth Service (Xác thực)
Dịch vụ quản lý đăng nhập bằng mã OTP và cấp phát Token.

- **Base URL:** `/api/v1/auth`
- **Auth Required:** No (đối với login)

### Endpoints:
| Method | Endpoint | Description | Token |
| :--- | :--- | :--- | :--- |
| POST | `/login/otp/request` | Yêu cầu gửi mã OTP về số điện thoại | No |
| POST | `/login/otp/verify` | Xác thực mã OTP và nhận Access Token | No |

### Ví dụ Request (Verify OTP):
```json
{
  "phoneNumber": "0912345678",
  "otp": "123456"
}
```

### Ví dụ Response (Success):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": { "id": "user_001", "role": "Customer" }
  }
}
```

---

## 2. Booking Service (Đặt xe)
Dịch vụ quản lý yêu cầu đặt xe của khách hàng.

- **Base URL:** `/api/v1/bookings`
- **Auth Required:** Yes (Bearer Token)

### Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/` | Tạo yêu cầu đặt xe mới |
| GET | `/` | Lấy danh sách chuyến xe của User |
| GET | `/:id` | Xem chi tiết thông tin đặt xe |
| POST | `/:id/cancel` | Hủy yêu cầu đặt xe |

### Ví dụ Request Body (Create):
```json
{
  "pickup": { "lat": 10.7626, "lng": 106.6602, "address": "Ho Chi Minh City" },
  "destination": { "lat": 10.7731, "lng": 106.7048, "address": "Ben Thanh Market" },
  "rideType": "standard"
}
```

---

## 3. Ride Service (Vận hành chuyến)
Dịch vụ quản lý trạng thái chuyến đi thực tế giữa tài xế và khách.

- **Base URL:** `/api/v1/rides`

### Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/:id/accept` | Tài xế chấp nhận chuyến xe |
| POST | `/:id/start` | Bắt đầu chuyến đi (Khách đã lên xe) |
| POST | `/:id/complete`| Hoàn thành chuyến đi |
| POST | `/:id/location`| Cập nhật tọa độ thực tế của tài xế |

---

## 4. Payment Service (Thanh toán)
Xử lý giao dịch và hoàn tiền.

- **Base URL:** `/api/v1/payments`

### Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/` | Tạo giao dịch thanh toán |
| POST | `/:id/confirm` | Xác nhận thanh toán thành công |
| POST | `/:id/refund` | Hoàn tiền (khi hủy chuyến) |

---

## 5. Mã lỗi chung (Error Codes)
Hệ thống sử dụng các mã lỗi chuẩn HTTP:

| Code | Ý nghĩa | Giải pháp |
| :--- | :--- | :--- |
| **400** | Bad Request | Kiểm tra lại cấu trúc JSON gửi lên |
| **401** | Unauthorized | Token hết hạn hoặc thiếu Header Authorization |
| **403** | Forbidden | User không có quyền (Vd: Khách hàng gọi API của Tài xế) |
| **404** | Not Found | ID chuyến xe hoặc route không tồn tại |
| **429** | Too Many Requests| Gửi OTP quá nhanh (Rate limit) |
| **500** | Internal Error | Lỗi hệ thống, kiểm tra log của Service |

---

> **Lưu ý:** Tất cả các Request Header cần có `Content-Type: application/json`. Các API yêu cầu xác thực cần gửi kèm `Authorization: Bearer <token>`.
