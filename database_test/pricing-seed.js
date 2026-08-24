// Chọn đúng database của Pricing Service
db = db.getSiblingDB('cab_booking_pricing');

// 1. Xóa dữ liệu cũ (để tránh lỗi duplicate key nếu chạy lại nhiều lần)
db.pricingrules.drop();
db.surgezones.drop();

// 2. Chèn cấu hình giá cơ bản (Pricing Rules)
db.pricingrules.insertMany([
    {
        vehicleType: 'bike',
        baseFare: 15000,
        perKm: 5000,
        perMinute: 500,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        vehicleType: 'standard',
        baseFare: 20000,
        perKm: 10000,
        perMinute: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        vehicleType: 'premium',
        baseFare: 30000,
        perKm: 15000,
        perMinute: 1500,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        vehicleType: 'suv',
        baseFare: 35000,
        perKm: 18000,
        perMinute: 1800,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

print("✅ Đã chèn thành công Pricing Rules!");

// 3. Chèn cấu hình khu vực tăng giá (Surge Zones)
db.surgezones.insertMany([
    {
        zoneId: 'zone_govap',
        multiplier: 1.0,  // Giá bình thường
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        zoneId: 'zone_quan1',
        multiplier: 1.2,  // Khu vực trung tâm, tăng 20%
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        zoneId: 'zone_sanbay',
        multiplier: 1.5,  // Sân bay, tăng 50%
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

print("✅ Đã chèn thành công Surge Zones!");