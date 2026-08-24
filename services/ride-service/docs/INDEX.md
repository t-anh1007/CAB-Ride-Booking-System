# 🚖 Ride Service - Documentation Index

Tài liệu toàn bộ về Ride Service của hệ thống CAB booking. Chọn phần cần tìm hiểu:

## 📚 Tài Liệu Chính

| File | Nội Dung | Đối Tượng |
|------|---------|---------|
| **[README.md](./README.md)** | Tổng quan service, tính năng, trạng thái, các endpoint cơ bản | Mọi người |
| **[API.md](./API.md)** | Specification chi tiết tất cả REST API + WebSocket | Backend Dev, QA |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Kiến trúc hệ thống, component, data flow, design pattern | Architect, Senior Dev |
| **[SRC_STRUCTURE.md](./SRC_STRUCTURE.md)** | Cấu trúc mã nguồn chi tiết từng module | Frontend Dev (xem API), Backend Dev |
| **[QUICKSTART.md](./QUICKSTART.md)** | Hướng dẫn 5 phút setup & test cơ bản | Dev mới |
| **[INTEGRATION.md](./INTEGRATION.md)** | Cách tích hợp với các service khác, event publishing | Backend Dev |
| **[DELIVERABLES.md](./DELIVERABLES.md)** | Tóm tắt deliverables & trạng thái project | Project Manager, Client |

---

## 🚀 Bắt Đầu Nhanh (5 Phút)

```bash
# 1. Cài đặt
cd services/ride-service
npm install

# 2. Khởi động service
npm start
# hoặc dev mode: npm run dev

# 3. Test health check
curl http://localhost:3009/health

# 4. Xem chi tiết trong: QUICKSTART.md
```

---

## 📋 Tìm Kiếm Theo Nhu Cầu

### 🔍 Tôi muốn...

| Nhu Cầu | Tài Liệu | Section |
|--------|---------|---------|
| **Hiểu overview** | README.md | Features, Ride Statuses |
| **Xem tất cả API endpoints** | API.md | Tất cả POST/GET/PUT endpoints |
| **Hiểu kiến trúc hệ thống** | ARCHITECTURE.md | Architecture, Components |
| **Xem cấu trúc code** | SRC_STRUCTURE.md | Module Breakdown |
| **Setup và test** | QUICKSTART.md | 5-Minute Setup & Test APIs |
| **Tích hợp services** | INTEGRATION.md | External Services, Events |
| **Biết đã hoàn thành gì** | DELIVERABLES.md | Completed Tasks, Features |
| **Xem MongoDB queries** | SRC_STRUCTURE.md → Models | Database Schema |
| **Hiểu ETA calculation** | SRC_STRUCTURE.md → eta.service | Haversine Formula |
| **WebSocket real-time** | API.md | WebSocket Section |

---

## 📁 Project Structure

```
services/ride-service/
├── 📄 Documentation (Root Level)
│   ├── INDEX.md                 ← Bạn đang đọc
│   ├── README.md                ← Tổng quan + API 8 endpoints
│   ├── API.md                   ← Chi tiết API spec
│   ├── ARCHITECTURE.md          ← Design & components
│   ├── SRC_STRUCTURE.md         ← Cấu trúc code
│   ├── QUICKSTART.md            ← Hướng dẫn setup
│   ├── INTEGRATION.md           ← Tích hợp inter-service
│   └── DELIVERABLES.md          ← Project summary
│
├── 📦 Source Code
│   ├── src/
│   │   ├── controllers/         ← HTTP handlers
│   │   ├── services/            ← Business logic
│   │   ├── models/              ← Data models
│   │   ├── routes/              ← API routes
│   │   ├── realtime/            ← WebSocket
│   │   ├── database/            ← MongoDB config
│   │   └── app.js               ← Express setup
│   │
│   ├── index.js                 ← Entry point
│   ├── package.json             ← Dependencies
│   ├── Dockerfile               ← Container config
│   ├── .env.example             ← Config template
│   └── test.js                  ← Test cases
```

---

## ⚙️ Configuration

### Environment Variables (.env)
```
PORT=3009
MONGODB_URI=mongodb://localhost:27017/cab_booking
LOG_LEVEL=info
AVG_DRIVER_SPEED=30
ENABLE_REAL_TIME_TRACKING=true
ENABLE_EVENT_PUBLISHING=true
```

Xem chi tiết: **QUICKSTART.md** → Environment Setup

---

## 🎯 Key Features

✅ **Ride Management**: Create, read, update, cancel rides
✅ **Real-time GPS Tracking**: WebSocket driver location updates
✅ **ETA Calculation**: Haversine formula distance → ETA (min 5 phút)
✅ **Status State Machine**: SEARCHING → ASSIGNED → ARRIVING → IN_PROGRESS → COMPLETED
✅ **MongoDB Persistence**: Optional, fallback in-memory
✅ **Event Publishing**: Inter-service communication ready
✅ **Health Checks**: Service health monitoring

Chi tiết: **README.md** or **ARCHITECTURE.md**

---

## 🧪 API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/rides` | Tạo ride mới |
| GET | `/api/v1/rides/:rideId` | Lấy chi tiết ride |
| POST | `/api/v1/rides/:rideId/assign-driver` | Gán driver |
| POST | `/api/v1/rides/:rideId/location` | Cập nhật vị trí GPS |
| POST | `/api/v1/rides/:rideId/start` | Bắt đầu ride |
| POST | `/api/v1/rides/:rideId/complete` | Hoàn thành ride |
| POST | `/api/v1/rides/:rideId/cancel` | Hủy ride |
| GET | `/api/v1/users/:userId/rides` | Lịch sử ride của user |
| GET | `/api/v1/rides/stats` | Thống kê rides |

Xem đầy đủ: **API.md**

---

## 🔗 Related Services

- **API Gateway**: Route requests từ client
- **Booking Service**: Tạo booking → gọi Ride Service
- **Driver Service**: Quản lý thông tin driver
- **Notification Service**: Gửi thông báo events từ Ride Service
- **Payment Service**: Xử lý payment cho ride
- **User Service**: Quản lý thông tin user
- **Review Service**: Rating & review rides

Xem tích hợp: **INTEGRATION.md**

---

## 🛠️ Development

### Scripts Available
```bash
npm start          # Production run
npm run dev        # Development with nodemon (hot-reload)
npm test           # Run tests
npm run dev        # Watch mode with auto-restart
```

### Database
- **MongoDB**: `mongodb://localhost:27017/cab_booking`
- **Collection**: `rides` (auto-created)
- **Fallback**: In-memory Map (nếu MongoDB disconnected)

### WebSocket
```
ws://localhost:3009
```

Xem chi tiết: **QUICKSTART.md** & **API.md**

---

## 📊 Ride States Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Ride Lifecycle                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [CREATE]                                                        │
│     ↓                                                            │
│  SEARCHING        ← Đang tìm driver                             │
│     ↓                                                            │
│  DRIVER_ASSIGNED  ← Driver đã nhận                              │
│ (auto→ARRIVING    ← Lần đầu GPS update)                          │
│  DRIVER_ARRIVING  ← Driver đang tới điểm đón                    │
│     ↓                                                            │
│  IN_PROGRESS      ← Ride đã bắt đầu                              │
│     ↓                                                            │
│  ┌─ COMPLETED ✓   ← Ride thành công                              │
│  │                                                              │
│  └─ CANCELLED ✗   ← Ride bị hủy                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Xem chi tiết states: **README.md** or **ARCHITECTURE.md**

---

## ✨ Latest Updates

- ✅ ETA minimum threshold: 5 phút (không nhỏ hơn)
- ✅ MongoDB Mongoose integration hoàn tất
- ✅ In-memory fallback khi MongoDB unavailable
- ✅ Async/await entire service (no callback hell)
- ✅ WebSocket real-time GPS tracking
- ✅ Auto status promotion ASSIGNED → ARRIVING on first GPS
- ✅ All 8 REST endpoints + 1 stats endpoint

Xem chi tiết: **DELIVERABLES.md**

---

## 🤝 Support

Gặp vấn đề? Kiểm tra:
1. **.env** cấu hình đúng? → **QUICKSTART.md** → Environment Setup
2. Port 3009 có bị chiếm? → Kiểm tra `netstat -ano | findstr 3009`
3. MongoDB chưa connect? → Service fallback to in-memory, check logs
4. WebSocket không hoạt động? → Verify `ws://localhost:3009` accessible
5. API trả về lỗi? → Check **API.md** response format & error codes

---

## 📝 Notes

- **Base URL**: `http://localhost:3009`
- **WebSocket**: `ws://localhost:3009`
- **Database**: MongoDB `cab_booking.rides`
- **Min ETA**: 5 phút (Haversine distance → time conversion)
- **Fallback**: In-memory Map nếu MongoDB unavailable
- **Node Version**: Đã test với Node 14+

---

**Last Updated**: 2026-04-08
**Status**: ✅ Production Ready

---

## 🎓 Learning Path

**Beginner** → QUICKSTART.md
**Developer** → SRC_STRUCTURE.md + API.md
**Architect** → ARCHITECTURE.md + INTEGRATION.md
**Manager** → DELIVERABLES.md + README.md
