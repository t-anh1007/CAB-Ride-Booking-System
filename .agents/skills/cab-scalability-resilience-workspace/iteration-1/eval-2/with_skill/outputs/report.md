# Báo Cáo: Đánh Giá Scalability và Resilience CAB-BOOKING

**Ngày tạo:** 2026-04-23
**Dịch vụ:** booking-ride-driver

---

## 1. Kết quả chung (Ngắn gọn)

- **Workflow Selected:** `booking-ride-driver`
- **Scenario:** `BRD-1 Booking replay safety` và `BRD-2 Ride/driver event path evidence`
- **Result Status:** `ARCHITECTURE_DRIFT`
- **Pass/Fail Summary:** Code bookingController có check idempotency key, nhưng phần đồng bộ Kafka `RideCreated` và `DriverLocationUpdated` (dù ghi trong `topology.json`) lại không tìm thấy code/log consumer thực tế kết nối.

## 2. Quy trình kiểm tra

### 2.1. Điều kiện đầu vào (Entry Conditions)
- Có Auth token hợp lệ, giả lập POST HTTP request tạo booking nhiều lần với cùng Idempotency-Key.

### 2.2. Các bước thực hiện (Step Log)
- Gọi POST `/bookings` lần 1.
- Gọi tiếp POST `/bookings` lần 2 với cùng `Idempotency-Key`.
- Check database row và topic Kafka.

## 3. Evidence Bằng Chứng 

### 3.1. Bằng chứng được yêu cầu (Required Evidence)
- API Gateway hit cache, Booking DB unique record, broker event logs.

### 3.2. Quan sát thực tế (Observed Evidence)
- Không có Kafka event listener log nào được sinh ra từ Ride service. Bản thân topology.json chỉ mô tả producer, thiếu vắng Consumer. Code runtime thực tế gọi HTTP.

## 4. Chẩn Đoán & Rủi ro

- **Risk:** Medium
- **Root Cause / Missing Information:** Thiếu EventConsumer trên production, code đồng bộ chỉ gọi qua REST API.
- **Architecture Drift:** Có sự trôi dạt kiến trúc! Thiết kế hệ thống (CAB_V2) yêu cầu Full Kafka Eventual Consistency, nhưng runtime code lại thiếu Consumer cho các luồng core.
- **Khuyến nghị & Fix Guidance:** Bổ sung Consumer Kafka worker vào Ride Service. Không dùng HTTP gọi qua lại cho location sync.
