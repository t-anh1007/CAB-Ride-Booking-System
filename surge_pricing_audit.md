# Audit: Surge Pricing — Đánh giá theo 5 tiêu chí & Sơ đồ

## Tóm tắt nhanh

| # | Tiêu chí | Trạng thái Code | Khớp Sơ đồ |
|---|----------|-----------------|------------|
| 1 | Surge chạy near real-time, tách flow booking | ✅ Đáp ứng | ✅ Đúng |
| 2 | Redis lưu metrics cung/cầu theo zone | ✅ Đáp ứng | ⚠️ Thiếu 1 mũi tên |
| 3 | AI xử lý thời gian, sự kiện, lịch sử | ⚠️ Một phần | ⚠️ Thiếu nguồn dữ liệu |
| 4 | Kafka broadcast SurgePriceUpdated | ❌ Chưa có | ❌ Không khớp |
| 5 | Giá nhất quán giữa estimate & booking | ❌ Chưa có | ❌ Chưa vẽ |

---

## Chi tiết từng tiêu chí

---

### ✅ Tiêu chí 1 — Surge chạy near real-time, tách khỏi flow booking

**Kết quả: ĐÁP ỨNG TỐT**

**Code thực tế:**

```
ml-platform-service/app/tasks/scheduler.py
  └─ APScheduler job: _push_surge_for_all_zones()
     ├─ Chạy interval = settings.surge_push_interval_seconds  (cấu hình qua env)
     ├─ Scan supply:zone:* từ Redis
     ├─ Gọi XGBoost predict
     └─ Push kết quả vào surge_zone:{geohash}
```

```
pricing-service/src/controllers/pricingController.js → getQuote()
  └─ getAISurge(lat, lng)  → đọc Redis key "surge_zone:{geohash}"
     (KHÔNG gọi AI trực tiếp — chỉ đọc cache)
```

**Nhận xét:**
- Flow booking/estimate hoàn toàn **không bị blocking** bởi ML inference
- Pricing Service chỉ đọc Redis cache — độ trễ < 1ms
- Surge được pre-compute nền → đúng nghĩa "near real-time"
- **Khớp hoàn toàn với sơ đồ**: khối `loop [Every 1-5 min]` tách biệt rõ ràng với luồng user bên dưới

---

### ✅ Tiêu chí 2 — Redis lưu metrics cung/cầu theo zone

**Kết quả: ĐÁP ỨNG TỐT — nhưng sơ đồ thiếu 1 mũi tên quan trọng**

**Code thực tế — Supply (driver-service):**
```js
// driver-service/src/utils/redis.js
publishDriverToZone(driverId, lat, lng)
  → sadd("supply:zone:{geohash5}", driverId)
  → expire(..., 120s)   // Auto-expire sau 2 phút

removeDriverFromZone(driverId, lat, lng)
  → srem("supply:zone:{geohash5}", driverId)
```
> Được gọi tại `driverController.js → updateLocation()` (khi ONLINE) và `goOffline()`.

**Code thực tế — Demand (pricing-service):**
```js
// pricing-service/src/utils/redis.js
recordDemandEvent(lat, lng, requestId)
  → sadd("demand:zone:{geohash}", requestId)
  → expire(..., 300s)   // Auto-expire sau 5 phút

getDemandCount(lat, lng) → scard("demand:zone:{geohash}")
getSupplyCount(lat, lng) → scard("supply:zone:{geohash}")
```

**Nhận xét:**
- Redis Set dùng `scard` để đếm → chuẩn, không bị trùng lặp (idempotent)
- TTL tự động dọn dẹp data cũ → tốt
- Dùng Geohash precision 5 (~2.4km) nhất quán giữa driver-service và pricing-service ✅

> [!WARNING]
> **Lỗ hổng trong sơ đồ**: Hiện sơ đồ vẽ Ride Service cập nhật metrics vào Redis Metrics (`Update demand/supply metrics`). Nhưng code thực tế là **Driver Service** mới ghi supply, còn **Pricing Service** ghi demand. Sơ đồ không phản ánh đúng actor nào ghi vào Redis.
>
> **Cần sửa sơ đồ**: `Ride Service → Redis Metrics` thành `Driver Service → Redis Metrics (supply)` và `Pricing Service → Redis Metrics (demand)`.

> [!WARNING]
> **Thiếu mũi tên trong sơ đồ**: Sau khi ML Platform tính xong `surge_zone:{zone}`, không có mũi tên nào thể hiện việc **ghi kết quả này vào Redis**. Cần bổ sung mũi tên `Surge Pricing AI → Redis Metrics: Cache surge factor`.

---

### ⚠️ Tiêu chí 3 — AI xử lý yếu tố thời gian, sự kiện, lịch sử

**Kết quả: ĐÁP ỨNG MỘT PHẦN**

**Feature vector hiện tại của XGBoost:**
```python
# surge_predictor.py — FEATURE_COLS
FEATURE_COLS = [
    "hour_of_day",    ✅ thời gian trong ngày
    "day_of_week",    ✅ ngày trong tuần
    "demand_count",   ✅ nhu cầu real-time
    "supply_count",   ✅ nguồn cung real-time
    "avg_speed_kmh",  ⚠️ mặc định hardcode = 20.0 (chưa có nguồn thực)
    "rain_indicator", ⚠️ mặc định hardcode = 0   (chưa tích hợp weather API)
]
```

**Nguồn lịch sử — FeatureStore:**
```python
# feature_store/ingestion.py
ingest_feature(data)  → MongoDB.ml_features
upsert_zone_metric()  → MongoDB.zone_metrics
```
> FeatureStore có nhưng **chỉ dùng làm fallback** khi Redis không có live data. (scheduler.py dòng 80-81)

**Nhận xét:**

| Yếu tố | Trạng thái |
|--------|------------|
| Thời gian (giờ, ngày) | ✅ Đang hoạt động |
| Cung/Cầu real-time | ✅ Đang hoạt động |
| Lịch sử (FeatureStore MongoDB) | ✅ Có nhưng chỉ là fallback |
| Sự kiện đặc biệt (event flags) | ❌ Chưa có |
| Thời tiết (rain_indicator) | ❌ Hardcode = 0 |
| Tốc độ trung bình (traffic) | ❌ Hardcode = 20.0 |

> [!NOTE]
> Sơ đồ vẽ `Fetch historical & context features` từ FeatureStore với mũi tên qua lại — nhưng thực tế FeatureStore chỉ được dùng làm **cold-start fallback**, không phải được query chủ động mỗi chu kỳ. Cần tích hợp thêm event flag và weather API để hoàn thiện tiêu chí này.

---

### ❌ Tiêu chí 4 — Kafka broadcast SurgePriceUpdated

**Kết quả: CHƯA TRIỂN KHAI**

**Hiện trạng code:**
```python
# ml-platform-service/app/tasks/scheduler.py — dòng 110-111
redis_key = f"surge_zone:{zone_id}"
await redis.setex(redis_key, settings.surge_redis_ttl, payload)
# ← Chỉ push vào Redis. KHÔNG có bước publish Kafka nào.
```

Không tìm thấy bất kỳ Kafka producer nào trong `ml-platform-service` hoặc `pricing-service` cho event `SurgePriceUpdated`.

**Hệ quả:**
- Dashboard analytics sẽ **không nhận được** thông báo surge thay đổi realtime
- Cache invalidation phụ thuộc hoàn toàn vào TTL của Redis (thụ động)
- Không có audit trail cho mỗi lần surge thay đổi

> [!IMPORTANT]
> **Cần bổ sung**: Sau bước `setex` trong scheduler.py, cần `await kafka_producer.send("surge.price.updated", payload)`. Đây là gap lớn nhất giữa code và sơ đồ.

---

### ❌ Tiêu chí 5 — Giá nhất quán giữa estimate & booking

**Kết quả: CHƯA TRIỂN KHAI — Rủi ro cao**

**Phân tích luồng hiện tại:**
```
1. getQuote() → tính surge → trả về finalAmount
   └─ KHÔNG có quote_id, KHÔNG lưu snapshot giá nào

2. createBooking() (booking-service/bookingController.js)
   └─ Nhận: userId, pickup, drop, distanceKm, vehicleType, paymentMethod
   └─ KHÔNG có trường quote_id hay lockedPrice
   └─ Không gọi pricing-service để verify giá
```

**Kịch bản lỗi thực tế:**
```
T=0:00  User xem estimate → surge 1.0x → giá 50,000đ
T=0:02  ML scheduler chạy → surge nhảy lên 2.0x
T=0:03  User bấm Book → booking-service tạo booking với giá... unknown
        (không có cơ chế nào giữ giá 50k từ estimate)
```

> [!CAUTION]
> **Rủi ro nghiêm trọng**: Giá hiển thị ở màn estimate và giá thực tế khi đặt xe có thể **khác nhau hoàn toàn** mà người dùng không được thông báo. Đây là vi phạm trực tiếp tiêu chí số 5.

**Giải pháp cần làm:**

```
Step 1: getQuote() → Sinh quote_id + lưu vào Redis
  redis.setex(`quote:{quote_id}`, 180, { amount, surgeMultiplier, ... })
  → trả thêm quote_id cho client

Step 2: createBooking() → nhận quote_id → validate
  const quote = redis.get(`quote:{quote_id}`)
  if (!quote || expired) → 409 "Giá đã hết hạn, vui lòng lấy giá mới"
  → dùng quote.amount làm locked price
  → xóa quote khỏi Redis (one-time use)
```

---

## Đối chiếu tổng thể với Sơ đồ

```
Sơ đồ đã đúng:          ✅ Vòng lặp background tách biệt
                         ✅ FeatureStore query (dù chưa đầy đủ trong code)
                         ✅ Luồng estimate đọc Redis

Sơ đồ cần bổ sung:      ➕ Mũi tên: ML Platform AI → Redis (cache surge factor)
                         ➕ Mũi tên: ML Platform → Kafka (SurgePriceUpdated)
                         ➕ Kafka → Dashboard & Analytics (consumers)
                         ➕ Luồng Booking (song song với Estimate)
                         ➕ quote_id flow: Estimate → lock → Book
                         ➕ Sửa actor: Ride Service → Driver Service (supply)
```

---

## Ưu tiên fix (theo mức độ ảnh hưởng)

| Mức | Việc cần làm | File |
|-----|-------------|------|
| 🔴 Cao | Thêm quote_id mechanism vào getQuote() | `pricing-service/pricingController.js` |
| 🔴 Cao | Booking-service validate quote_id | `booking-service/bookingController.js` |
| 🟡 Trung | Kafka producer cho SurgePriceUpdated | `ml-platform-service/scheduler.py` |
| 🟡 Trung | Thêm event_flag vào feature vector | `ml-platform-service/scheduler.py` |
| 🟢 Thấp | Tích hợp weather API (rain_indicator) | `ml-platform-service/scheduler.py` |
| 🟢 Thấp | Sửa sơ đồ cho đúng actor | Diagram tool |
