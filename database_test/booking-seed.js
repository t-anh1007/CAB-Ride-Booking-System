// 1. Chuyển sang database của Booking Service
db = db.getSiblingDB('cab_booking_booking');

// 2. Xóa dữ liệu cũ
db.bookings.drop();

print("✅ [SEEDER] Đã cập nhật dữ liệu mẫu chuẩn snake_case thành công!");