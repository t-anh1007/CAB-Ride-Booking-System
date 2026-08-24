# ETA AI Service

> **AI / ML Layer — ETA Prediction Service**
>
> Nằm trong `AI-ML/eta-service`, cùng cấp với thư mục `services/`.
> Service này chạy độc lập và expose REST API để các service khác gọi nội bộ qua HTTP.

---

## Kiến trúc

```
CAB_BOOKING/
├── services/          ← Core services (ride, booking, driver…)
└── AI-ML/
    └── eta-service/              ← Module này
        ├── src/
        │   ├── infra/
        │   │   └── redis.js              ← Singleton ioredis client
        │   │   └── kafka.js              ← Kafka consumer / producer for ETA lane
        │   ├── providers/
        │   │   └── routing.providers.js  ← OSRM / GraphHopper / Google Maps / Mapbox
        │   │   └── traffic.providers.js  ← Traffic delay abstraction
        │   ├── app.js                    ← Express app
        │   ├── index.js                  ← Service entrypoint
        │   ├── eta.config.js             ← Cấu hình từ env
        │   └── eta.service.js            ← Core ETA logic nội bộ
        ├── .env.example
        ├── Dockerfile
        └── package.json
```

---

## Vai trò trong hệ thống

| Thành phần | Mô tả |
|---|---|
| `app.js` | REST surface của ETA service |
| `index.js` | Process entrypoint |
| `eta.service.js` | Core ETA logic – tính ETA, quản lý cache và vị trí |
| `infra/redis.js` | Singleton Redis client – cache ETA, active rides, driver locations |
| `infra/kafka.js` | Kafka consumer / producer cho luồng ETA event-driven |
| `providers/routing.providers.js` | Strategy pattern: chọn routing provider theo env |
| `providers/traffic.providers.js` | Tách lane xử lý traffic delay |
| `eta.config.js` | Tập trung tất cả cấu hình từ `.env` |

---

## Flow tính ETA (theo sequence diagram)

```
DriverApp → [GPS update]
    → Gateway / upstream service
        → Kafka topic: driver.location.updated
            → eta-service consumer
                → Redis (driver:loc:<id>)
                → invalidate ETA cache

CustomerApp → [Request ETA]
    → Gateway / upstream service
        → eta-service
            1. Đọc Redis cache ETA / vị trí tài xế
            2. Lấy latest driver location từ Redis hot-store
            3. Cache MISS → gọi Routing Provider (OSRM / Google Maps …)
            4. Áp traffic delay + AI bias profile
            5. Ghi cache Redis (TTL = ETA_CACHE_TTL_SECONDS)
            6. Publish eta.result (nếu Kafka enabled)
            7. Return ETAResult
```

---

## Routing Providers

| Provider | Loại | Cách bật |
|---|---|---|
| **OSRM** (mặc định) | Self-hosted / public demo | `ROUTING_PROVIDER=osrm` |
| **GraphHopper** | Self-hosted / cloud | `ROUTING_PROVIDER=graphhopper` |
| **Google Maps** | Cloud (trả phí) | `ROUTING_PROVIDER=googlemaps` + `GOOGLE_MAPS_API_KEY` |
| **Mapbox** | Cloud (trả phí) | `ROUTING_PROVIDER=mapbox` + `MAPBOX_ACCESS_TOKEN` |
| **Haversine** | Fallback tự động | Khi tất cả providers lỗi |

> Nếu provider được chọn lỗi (network timeout, API key sai), hệ thống tự động fallback về công thức Haversine để đảm bảo luôn có kết quả.

---

## Redis Schema

| Key pattern | TTL | Nội dung |
|---|---|---|
| `eta:<rideId>:toPickup` | `ETA_CACHE_TTL_SECONDS` (30s) | ETAResult JSON |
| `eta:<rideId>:toDestination` | `ETA_CACHE_TTL_SECONDS` (30s) | ETAResult JSON |
| `ride:active:<rideId>` | `DRIVER_LOCATION_TTL_SECONDS` (300s) | Ride snapshot JSON |
| `driver:loc:<driverId>` | `DRIVER_LOCATION_TTL_SECONDS` (300s) | `{ lat, lng, address, updatedAt }` |
| `eta:bias:profile:<profileKey>` | `ETA_BIAS_PROFILE_TTL_SECONDS` | Bias profile JSON |

---

## Public API

```js
POST /api/v1/eta/calculate
POST /api/v1/eta/pickup
POST /api/v1/eta/ride-estimates
POST /api/v1/eta/tracking
POST /api/v1/eta/driver-location-events
GET  /api/v1/eta/driver-locations/:driverId
POST /api/v1/eta/active-rides
GET  /api/v1/eta/active-rides/:rideId
DELETE /api/v1/eta/active-rides/:rideId
POST /api/v1/eta/bias-profiles
GET  /api/v1/eta/bias-profiles/:profileKey
DELETE /api/v1/eta/bias-profiles/:profileKey
GET  /health
```

---

## Cài đặt

```bash
cd AI-ML/eta-service
npm install
cp .env.example .env
npm run start
```

---

## Biến môi trường quan trọng

| Biến | Mặc định | Mô tả |
|---|---|---|
| `ROUTING_PROVIDER` | `osrm` | Provider: osrm / graphhopper / googlemaps / mapbox |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `ETA_CACHE_TTL_SECONDS` | `30` | Thời gian cache ETA (giây) |
| `DRIVER_LOCATION_TTL_SECONDS` | `300` | TTL vị trí tài xế trong Redis |
| `FALLBACK_AVG_SPEED_KMH` | `30` | Tốc độ trung bình fallback (km/h) |
| `ETA_BIAS_FACTOR` | `1.0` | Hệ số điều chỉnh AI (1.15 = +15% buffer) |
| `ETA_BIAS_FACTOR_MIN` | `0.85` | Cận dưới của bias factor |
| `ETA_BIAS_FACTOR_MAX` | `1.5` | Cận trên của bias factor |
| `ETA_BIAS_PROFILE_TTL_SECONDS` | `86400` | TTL bias profile trong Redis |
| `TRAFFIC_PROVIDER` | `heuristic` | Traffic provider: heuristic / none |
| `DEFAULT_TRAFFIC_DELAY_FACTOR` | `1.0` | Delay factor mặc định nếu không có context |
| `KAFKA_BROKERS` | _(trống)_ | Bật lane event-driven ETA nếu có broker |
| `DRIVER_LOCATION_TOPIC` | `driver.location.updated` | Topic GPS tài xế |
| `ETA_RESULT_TOPIC` | `eta.result` | Topic publish ETA result |
| `OSRM_BASE_URL` | `http://router.project-osrm.org` | OSRM server URL |
| `GOOGLE_MAPS_API_KEY` | _(bắt buộc nếu dùng googlemaps)_ | Google Maps API key |
| `MAPBOX_ACCESS_TOKEN` | _(bắt buộc nếu dùng mapbox)_ | Mapbox token |

---

## Tích hợp với ride-service

`ride-service` gọi ETA qua REST nội bộ bằng `ETA_SERVICE_URL`, không import trực tiếp module ETA nữa.
