# Đánh giá Booking và Lái xe

Tính năng đặt xe có sử dụng Kafka. File topology.json khai báo topic `ride.created` được push bởi `booking-service` và `driver.location.updated` bởi `driver-service`.
Việc submit nhiều lần sẽ được chống lại nhờ cơ chế Idempotency Key trong controller.

Hệ thống hoạt động tốt. Pass.
