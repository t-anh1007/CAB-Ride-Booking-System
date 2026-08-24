# Báo Cáo: Đánh Giá Gateway -> Auth

Luồng Gateway xuống Auth khi upstream (Auth) gặp lỗi sẽ được Gateway xử lý thông qua việc timeout. Hệ thống sử dụng circuit breaker.

Khi token refresh bị tái sử dụng, session service sẽ phát hiện và chặn lại, thu hồi toàn bộ token cùng family đảm bảo an toàn. 

**Kết quả:**
Nhìn chung hệ thống chịu lỗi tốt. Pass.
