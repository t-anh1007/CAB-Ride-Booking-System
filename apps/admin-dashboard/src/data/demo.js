// Dữ liệu minh họa: chỉ dùng khi API không phản hồi; UI luôn gắn nhãn "minh họa".
export const demoKpis = [
  { key: "rides", label: "Tổng số chuyến", value: 12584, delta: 18.6 },
  { key: "revenue", label: "Doanh thu hôm nay", value: 852560000, delta: 16.3, money: true },
  { key: "drivers", label: "Tài xế online", value: 3265, delta: 12.7 },
  { key: "customers", label: "Khách hàng mới", value: 1482, delta: 25.4 },
];

export const demoRides = [
  { id: "CAB250520-001", time: "14:25", from: "136 Nguyễn Huệ", to: "Tân Sơn Nhất", fare: 52000, status: "completed" },
  { id: "CAB250520-002", time: "14:23", from: "Landmark 81", to: "Phú Mỹ Hưng", fare: 87000, status: "in_progress" },
  { id: "CAB250520-003", time: "14:20", from: "Bến Thành", to: "Thảo Điền", fare: 65000, status: "in_progress" },
  { id: "CAB250520-004", time: "14:18", from: "Cầu Thủ Thiêm", to: "Tân Bình", fare: 58000, status: "cancelled" },
  { id: "CAB250520-005", time: "14:15", from: "Nguyễn Văn Linh", to: "Quận 1", fare: 75000, status: "completed" },
];

export const demoAudit = [
  { id: "a1", createdAt: "2025-05-20T14:24:00", actor: "Admin", eventType: "Cập nhật hệ số giá khu vực Q1", eventStatus: "success" },
  { id: "a2", createdAt: "2025-05-20T14:20:00", actor: "System", eventType: "Tài xế 51H-123.45 đã đăng nhập", eventStatus: "success" },
  { id: "a3", createdAt: "2025-05-20T14:18:00", actor: "Admin", eventType: "Tạo ưu đãi \"HELLO50\"", eventStatus: "success" },
  { id: "a4", createdAt: "2025-05-20T14:15:00", actor: "System", eventType: "Chuyến CAB250520-002 hoàn thành", eventStatus: "success" },
  { id: "a5", createdAt: "2025-05-20T14:12:00", actor: "Admin", eventType: "Khóa tài xế 51G-678.90", eventStatus: "warning" },
];

// Vùng nhu cầu quanh trung tâm TP.HCM: level 0..3 = Thấp..Rất cao
export const demoZones = [
  { center: [10.7769, 106.7009], radius: 540, level: 3 },
  { center: [10.7712, 106.6935], radius: 480, level: 3 },
  { center: [10.7830, 106.6960], radius: 600, level: 2 },
  { center: [10.7700, 106.7080], radius: 540, level: 2 },
  { center: [10.7880, 106.7060], radius: 660, level: 1 },
  { center: [10.7640, 106.6880], radius: 600, level: 1 },
  { center: [10.7920, 106.6900], radius: 720, level: 0 },
  { center: [10.7600, 106.7150], radius: 660, level: 0 },
];

export const demoDrivers = [
  [10.7790, 106.6990], [10.7745, 106.7040], [10.7820, 106.7035], [10.7700, 106.6950],
  [10.7860, 106.6930], [10.7665, 106.7060], [10.7905, 106.7030], [10.7730, 106.6880],
].map((p, i) => ({ id: `demo-${i}`, lat: p[0], lng: p[1], heading: (i * 47) % 360 }));

export const demoDriverRows = [
  { driverId: "DRV-1024", name: "Nguyễn Văn An", vehicle: "51H-123.45", status: "available" },
  { driverId: "DRV-1031", name: "Trần Minh Khoa", vehicle: "51G-222.10", status: "available" },
  { driverId: "DRV-1047", name: "Lê Hoàng Phúc", vehicle: "59A-456.78", status: "available" },
];

export const demoUsers = [
  { userId: "USR-2001", fullName: "Phạm Thu Hà", phone: "0901 234 567" },
  { userId: "USR-2002", fullName: "Đỗ Quang Huy", phone: "0912 345 678" },
  { userId: "USR-2003", fullName: "Võ Ngọc Lan", phone: "0938 765 432" },
];

export const levelColors = ["#2CE6A6", "#F3B33D", "#F38A4B", "#F36C5B"];
export const formatVnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;
