# Level 1 - TC1 Register Patch

Đã thêm API đăng ký đúng kiểu rubric thầy:

```http
POST /api/v1/auth/register
```

Body:

```json
{
  "email": "user@test.com",
  "password": "123456",
  "name": "Test User"
}
```

Response mong đợi:

```json
{
  "success": true,
  "data": {
    "user_id": "<UUID>",
    "email": "user@test.com",
    "name": "Test User",
    "role": "customer"
  }
}
```

Lưu ý quan trọng để `user_id` không bị lệch:

1. TC1 register sẽ set biến Postman `customerUserId = json.data.user_id`.
2. TC1 cũng set `customerDestination = json.data.email` và `customerChannel = email`.
3. TC2 OTP verify bằng chính `customerDestination` này.
4. OTP verify sẽ trả `account.subject_id`, chính là `user_id` của TC1.
5. Các test Booking phía sau phải dùng `{{customerUserId}}`, không hard-code userId khác.

Nếu chạy lại nhiều lần với cùng email `user@test.com`, API vẫn trả lại đúng `user_id` cũ để Postman test không bị chết do duplicate email.
