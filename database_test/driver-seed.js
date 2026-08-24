// init-db.js
db = db.getSiblingDB('cab_booking_driver'); // Tên database của Driver Service

db.drivers.drop(); // Xóa cũ nếu có để tránh trùng lặp khi khởi động lại

db.drivers.insertMany([
  {
    "driverId": "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "fullName": "Trần Văn Lái",
    "phone": "0908888777",
    "vehicleType": "car",
    "vehiclePlate": "51G-888.88",
    "status": "OFFLINE",
    "availability": "BUSY",
    "location": {
      "lat": 10.762,
      "lng": 106.660,
      "address": "Chợ Bến Thành, Quận 1"
    },
    "createdAt": new Date(),
    "updatedAt": new Date()
  }
]);

console.log("Seeding Driver DB completed!");