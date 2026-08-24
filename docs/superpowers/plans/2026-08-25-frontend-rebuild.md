# Frontend Rebuild Implementation Plan (Sub-plan 2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đập đi xây lại 3 frontend app (Customer, Driver, Admin) theo đúng danh sách màn hình PDF (C1–C11, Driver 7 màn, Admin 6 module), thay Google Maps bằng **Leaflet + OpenStreetMap**, nối gateway API + realtime WebSocket.

**Architecture:** Monorepo giữ nguyên `apps/*`; thêm package chung `packages/web-shared` (API client, WS hook, map components, status constants) để 3 app không lặp code. App cũ giữ trong git history — xoá `src/` cũ khi app mới thay thế xong từng cái.

**Tech Stack:** React 18 + Vite 5 + Tailwind 3 + react-router-dom 6 (giữ stack cũ), **leaflet 1.9 + react-leaflet 4** (mới), WebSocket native (gateway `/realtime`), Nominatim (geocoding), OSRM (route polyline).

**Spec:** `CAB-BOOKING-SYSTEM.md` mục 9A (UI/UX) + master plan mục 3.4.

## Global Constraints

- KHÔNG cài `@vis.gl/react-google-maps`, mapbox, hay bất kỳ SDK bản đồ thương mại nào. Tile: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` + attribution OSM bắt buộc.
- Nominatim: debounce ≥ 800ms, header `User-Agent` tuỳ chỉnh, tối đa 1 req/s (usage policy).
- Mọi API call qua gateway `http://localhost:3000/api/v1/...` (cấu hình qua `public/config.js` runtime — pattern app cũ đang dùng, giữ nguyên).
- Auth: OTP flow (`POST /api/v1/auth/register`, `/auth/login/otp/request`, `/auth/login/otp/verify`, `/auth/refresh`, `/auth/logout`); access token trong memory, refresh token httpOnly-cookie nếu gateway hỗ trợ, nếu không → localStorage kèm rotation.
- Realtime: WS `ws://localhost:3000/realtime?token=<JWT>`; message envelope `{type: "realtime.connected" | "driver.location.updated" | "ride.status.changed" | "driver.assigned" | "ride.assigned", ...}` (khớp `REALTIME_EVENT_TOPICS` của notification-service).
- POST /bookings và /payments bắt buộc header `Idempotency-Key` (gateway enforce) — API client tự sinh UUID v4 mỗi lần submit.
- Booking create qua gateway yêu cầu role Customer; driver endpoints role Driver; admin cần scope `admin:all`.
- Mobile-first (viewport 390px chuẩn), one-hand usage cho Customer/Driver; Admin desktop-first.

---

### Task F1: `packages/web-shared` — API client + WS hook + map components

**Files:**
- Create: `packages/web-shared/package.json` (name `@cab/web-shared`, type module, peerDeps react/react-dom/leaflet/react-leaflet)
- Create: `packages/web-shared/src/api/client.js`
- Create: `packages/web-shared/src/realtime/useRealtime.js`
- Create: `packages/web-shared/src/map/BaseMap.jsx`, `src/map/PickupPin.jsx`, `src/map/DriverMarker.jsx`, `src/map/RoutePolyline.jsx`
- Create: `packages/web-shared/src/geo/nominatim.js`, `src/geo/osrm.js`
- Create: `packages/web-shared/src/constants/` (port nguyên `bookingStatus.js`, `paymentStatus.js`, `rideStatus.js`, `roles.js` từ `apps/customer-app/src/constants/`)
- Create: `packages/web-shared/src/index.js` (barrel export)

**Interfaces (Produces — mọi task sau dùng):**
- `createApiClient({baseUrl, getToken, onAuthExpired})` → `{get(path), post(path, body, {idempotent})}`; `idempotent: true` tự thêm header `Idempotency-Key: <uuid>`; 401 → thử `POST /auth/refresh` 1 lần rồi retry; fail → `onAuthExpired()`.
- `useRealtime({url, token, onMessage})` → `{status: "connecting"|"open"|"closed", send}`; tự reconnect backoff 1s→2s→4s (max 30s), parse JSON, dispatch theo `message.type`.
- `<BaseMap center zoom onMapClick>{children}</BaseMap>` — MapContainer + TileLayer OSM + attribution.
- `<DriverMarker position heading />`, `<PickupPin position draggable onDragEnd />`, `<RoutePolyline geometry />` (geometry = mảng `[lat,lng]`).
- `searchAddress(query)` → `[{label, lat, lng}]` (Nominatim, debounce phía caller); `fetchRoute(from, to)` → `{distanceKm, durationMin, geometry: [[lat,lng]]}` (OSRM `overview=full&geometries=geojson`; lỗi → `{geometry: [from, to], fallback: true}`).

- [ ] **Step 1:** Scaffold package + cài deps ở root workspace (`npm i leaflet react-leaflet` trong workspace); export barrel.
- [ ] **Step 2:** Viết `client.js` đúng interface trên (fetch wrapper ~80 dòng, không axios — giảm dep).
- [ ] **Step 3:** Viết `useRealtime.js`:

```jsx
export function useRealtime({ url, token, onMessage }) {
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef(null);
  useEffect(() => {
    let retry = 0, closed = false, timer;
    function connect() {
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      socketRef.current = ws;
      ws.onopen = () => { retry = 0; setStatus("open"); };
      ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
      ws.onclose = () => {
        setStatus("closed");
        if (!closed) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
      };
    }
    if (token) connect();
    return () => { closed = true; clearTimeout(timer); socketRef.current?.close(); };
  }, [url, token]);
  return { status, send: (m) => socketRef.current?.send(JSON.stringify(m)) };
}
```

- [ ] **Step 4:** Viết map components (react-leaflet), `nominatim.js`, `osrm.js` đúng interface; icon marker dùng `L.divIcon` SVG inline (tránh lỗi default icon path của bundler).
- [ ] **Step 5:** Verify: tạo `packages/web-shared/dev/Sandbox.jsx` + `npm run dev` vite sandbox — map hiển thị tile OSM, pin kéo được, search "Ho Chi Minh" trả kết quả, route vẽ polyline. Commit: `feat(web-shared): api client, realtime hook, leaflet map kit`.

---

### Task F2: customer-app scaffold + Auth OTP (C1, C2)

**Files:**
- Delete: `apps/customer-app/src/` (toàn bộ — code cũ còn trong git), `apps/customer-app/dist/`
- Create: `apps/customer-app/src/main.jsx`, `src/App.jsx`, `src/router.jsx`, `src/providers/AuthProvider.jsx`
- Create: `src/pages/OnboardingPage.jsx` (C1: 3 slide Book–Track–Pay + CTA Get Started)
- Create: `src/pages/LoginPage.jsx` (C2: nhập phone/email → request OTP → nhập OTP 6 số → verify)
- Modify: `apps/customer-app/package.json` (bỏ `@vis.gl/react-google-maps`; thêm `@cab/web-shared` workspace, leaflet, react-leaflet)

**Interfaces:**
- Consumes: F1 `createApiClient`; auth endpoints theo Global Constraints.
- Produces: `useAuth()` → `{user: {id, role}, token, login(destination), verify(otp), logout()}` — mọi page sau dùng.

- [ ] **Step 1:** Xoá src cũ, scaffold router: `/` (onboarding, chỉ hiện lần đầu — localStorage flag), `/login`, layout `ProtectedRoute` (chưa auth → `/login`).
- [ ] **Step 2:** AuthProvider: gọi request OTP → verify → lưu `{accessToken, refreshToken, user}` (decode JWT lấy `sub`, `role`); wire vào `createApiClient`.
- [ ] **Step 3:** Verify chạy `npm run dev` + compose core: đăng ký số mới → nhận OTP (đọc từ log auth-service: `docker logs cab-auth-service | Select-String otp`) → verify → điều hướng `/home`. Commit: `feat(customer)!: rebuild scaffold + OTP auth`.

---

### Task F3: customer booking flow — map & pricing (C3, C4, C5)

**Files:**
- Create: `apps/customer-app/src/pages/HomeMapPage.jsx` (C3: full-screen BaseMap, PickupPin giữa màn, bottom sheet địa chỉ auto-detect qua reverse Nominatim, CTA "Set Destination")
- Create: `src/pages/DestinationPage.jsx` (C4: SearchInput debounce 800ms → `searchAddress`, recent list localStorage)
- Create: `src/pages/RideOptionsPage.jsx` (C5: card 4 vehicleType `bike|standard|premium|suv` — gọi `POST /api/v1/pricing/quote`, hiển thị amount + `surgeMultiplier` badge khi > 1 + countdown `expiresIn` 180s, RoutePolyline preview qua `fetchRoute`)
- Create: `src/providers/BookingProvider.jsx` (state: pickup, drop, quote, booking)

**Interfaces:**
- Consumes: pricing quote request `{pickupLat, pickupLng, dropLat, dropLng, vehicleType, destinationAddress}` → `{quoteId, expiresIn, priceSnapshot:{amount, surgeMultiplier, ...}}` (contract pricing-service hiện có).
- Produces: `useBooking()` → `{pickup, drop, quote, setPickup, setDrop, requestQuote(vehicleType), confirmBooking()}`.

- [ ] **Step 1:** HomeMapPage: geolocation browser → center map; kéo pin → reverse geocode cập nhật địa chỉ.
- [ ] **Step 2:** DestinationPage + RideOptionsPage theo interface; quote hết hạn (countdown 0) → nút "Refresh quote".
- [ ] **Step 3:** `confirmBooking()`: `POST /api/v1/bookings` (idempotent: true) body `{pickup:{lat,lng}, drop:{lat,lng}, quoteId, vehicleType}` → nhận `booking_id`, điều hướng `/searching`. Khu vực không có tài xế (503 từ pricing) → hiển thị message "Không có tài xế trong khu vực".
- [ ] **Step 4:** Verify E2E tay trên compose (seed driver online bằng `POST /api/v1/drivers/DRV001/go-online` qua Postman). Commit: `feat(customer): booking flow C3-C5 with leaflet + quote`.

---

### Task F4: customer matching + live tracking (C6, C7)

**Files:**
- Create: `src/pages/SearchingDriverPage.jsx` (C6: ripple animation CSS quanh pickup, listen WS `driver.assigned`/`ride.assigned` → driver card + nút Cancel gọi `POST /api/v1/bookings/{id}/cancel`)
- Create: `src/pages/RideTrackingPage.jsx` (C7: BaseMap + DriverMarker cập nhật theo WS `driver.location.updated`, RoutePolyline, driver info card {avatar initials, rating, plate}, ETA live, status badge theo `ride.status.changed`)
- Create: `src/providers/RealtimeProvider.jsx` (bọc `useRealtime` F1, expose event bus theo type)

**Interfaces:**
- Consumes: WS messages: `{type:"driver.assigned", rideId, driver:{id, name, rating}}`, `{type:"driver.location.updated", rideId, lat, lng}`, `{type:"ride.status.changed", rideId, status}`.

- [ ] **Step 1:** RealtimeProvider connect khi có token; SearchingDriverPage subscribe → khi assigned điều hướng `/tracking/:rideId`.
- [ ] **Step 2:** RideTrackingPage: marker driver di chuyển mượt (CSS transition 1s), status COMPLETED → điều hướng `/payment/:rideId`.
- [ ] **Step 3:** Verify: mô phỏng driver bằng Postman gửi `POST /api/v1/rides/{id}/location` liên tục → marker chạy trên map. Commit: `feat(customer): realtime matching + tracking C6-C7`.

---

### Task F5: customer payment + rating (C8, C9)

**Files:**
- Create: `src/pages/PaymentPage.jsx` (C8: fare summary từ ride, chọn method `cash|card|wallet`, `POST /api/v1/payments` idempotent `{rideId, amount, method}` → poll `GET /api/v1/payments/{id}` tới COMPLETED/FAILED; FAILED → nút Retry)
- Create: `src/pages/RatingPage.jsx` (C9: 5 sao + comment + tip optional → `POST /api/v1/reviews` `{rideId, userId, driverId, rating, comment}`; 409 đã đánh giá → thông báo)

- [ ] **Step 1:** PaymentPage theo interface (poll 2s, tối đa 30s → hiển thị PENDING eventual-consistency message).
- [ ] **Step 2:** RatingPage; xong → `/home` + toast cảm ơn.
- [ ] **Step 3:** Verify flow trên compose. Commit: `feat(customer): payment + rating C8-C9`.

---

### Task F6: customer history + profile/wallet (C10, C11)

**Files:**
- Create: `src/pages/HistoryPage.jsx` (C10: `GET /api/v1/bookings?user_id=` + filter date/status, item: date, route summary, amount, status badge)
- Create: `src/pages/ProfilePage.jsx` (C11: tabs Profile/Wallet/Settings — profile từ `GET /api/v1/users/{id}`, saved locations localStorage, nút Logout gọi `/auth/logout` + clear state)

- [ ] **Step 1:** 2 page theo interface; empty-state tử tế.
- [ ] **Step 2:** Verify + xoá `apps/customer-app` code cũ còn sót (`git rm` file thừa). Build production `npm run build` xanh. Commit: `feat(customer): history + profile, complete C1-C11`.

---

### Task F7: driver-app rebuild (7 màn PDF)

**Files:**
- Delete: `apps/driver-app/src/`, `apps/driver-app/dist/`
- Create: `apps/driver-app/src/` — scaffold giống F2 (dùng chung `@cab/web-shared`, AuthProvider role Driver)
- Create: `src/pages/DriverHomePage.jsx` (map + **Online/Offline toggle** → `POST /api/v1/drivers/{id}/go-online|go-offline`; khi online gửi vị trí định kỳ 5s: `POST /api/v1/rides/{rideId}/location` khi đang có chuyến, ngoài chuyến gửi `PATCH /api/v1/drivers/{id}/location`)
- Create: `src/pages/IncomingRequestPage.jsx` (WS `ride.assigned` cho driver → modal Accept/Reject CTA lớn, đếm ngược 15s; Accept → `POST /api/v1/rides/{id}/accept`)
- Create: `src/pages/ActiveRidePage.jsx` (map route tới pickup → nút "Start ride" `POST /rides/{id}/start` → route tới drop → "Complete" `POST /rides/{id}/complete`)
- Create: `src/pages/EarningsPage.jsx` (thu nhập: `GET /api/v1/rides/driver/{id}/history` tổng amount theo ngày + realtime income widget cộng dồn khi complete)
- Create: `src/pages/DriverHistoryPage.jsx`

**Interfaces:**
- Consumes: driver endpoints + ride lifecycle (T5 backend); WS như F4.
- Geolocation: `navigator.geolocation.watchPosition` throttle 5s.

- [ ] **Step 1:** Scaffold + auth (login OTP với account driver seed `0909...` trong `database_test/auth-seed.sql`).
- [ ] **Step 2:** DriverHome + toggle + gửi vị trí; IncomingRequest modal qua WS.
- [ ] **Step 3:** ActiveRide 2 giai đoạn (to-pickup / to-drop) + Earnings + History.
- [ ] **Step 4:** Verify 2 trình duyệt song song (customer đặt — driver nhận, accept, chạy, complete; customer thấy marker + status đổi realtime). Build xanh. Commit: `feat(driver)!: rebuild driver app with leaflet`.

---

### Task F8: admin-dashboard rebuild (6 module PDF)

**Files:**
- Delete: `apps/admin-dashboard/src/`, `apps/admin-dashboard/dist/`
- Create: scaffold + auth (`POST /api/v1/auth/login/admin` + MFA challenge nếu bật)
- Create: `src/pages/DashboardPage.jsx` (KPI: tổng bookings/rides/revenue hôm nay từ `GET /api/v1/rides/stats`; card số driver online)
- Create: `src/pages/UsersPage.jsx` (`GET /api/v1/users` — bảng + search), `src/pages/DriversPage.jsx` (bảng driver + trạng thái)
- Create: `src/pages/RidesPage.jsx` (bảng rides mọi user, filter status)
- Create: `src/pages/LiveMapPage.jsx` (BaseMap toàn thành phố + DriverMarker mọi driver online, cập nhật WS `driver.location.updated` — không filter rideId)
- Create: `src/pages/SurgeControlPage.jsx` (xem surge theo zone: `GET /api/v1/pricing/...` hoặc đọc qua ai-insights forecast; slider override hệ số → lưu PricingRule qua API pricing nếu có endpoint, nếu không → hiển thị read-only + forecast chart demand từ `GET /api/v1/forecast/demand`)
- Create: `src/pages/AuditLogPage.jsx` (`GET /api/v1/auth/...` audit endpoints của auth-service — đọc `services/auth-service/src/routes/admin-auth.routes.js` để lấy path chính xác khi làm; hiển thị bảng login/action/timestamp)

**Interfaces:**
- Consumes: scope `admin:all` (route-registry yêu cầu cho `/users`, `/rides/stats`).

- [ ] **Step 1:** Scaffold + admin login (account admin seed).
- [ ] **Step 2:** Dashboard + Users + Drivers + Rides (bảng Tailwind thuần, không cài UI lib).
- [ ] **Step 3:** LiveMap + SurgeControl + AuditLog.
- [ ] **Step 4:** Verify từng module với compose (`--profile ai` cho forecast). Build xanh. Commit: `feat(admin)!: rebuild admin dashboard`.

---

### Task F9: Dockerize 3 app + đưa vào compose/swarm

**Files:**
- Create: `apps/customer-app/Dockerfile`, `apps/driver-app/Dockerfile`, `apps/admin-dashboard/Dockerfile` (multi-stage: node build → nginx:alpine serve `dist/` + copy `public/config.js` mount-able)
- Modify: `infra/docker-compose/docker-compose.local.yml` (thêm 3 service profile `web`, ports 5174/5175/5176, mem_limit 64m)
- Modify: `infra/docker-swarm/docker-stack.yml` + `build-images.sh` (thêm 3 image)

- [ ] **Step 1:** Viết 3 Dockerfile (giống nhau, khác build context) + nginx.conf SPA fallback (`try_files $uri /index.html`).
- [ ] **Step 2:** `docker compose --profile web up -d --build` → 3 app mở được, gọi API gateway OK (config.js trỏ `http://localhost:3000`).
- [ ] **Step 3:** Cập nhật swarm stack + scripts. Commit: `infra(web): dockerize 3 frontend apps, compose profile web`.

---

### Task F10: E2E happy-path cross-app + dọn dẹp

**Files:**
- Create: `tests/e2e/FRONTEND_CHECKLIST.md` — kịch bản demo 15 bước (map với màn hình C1–C11 + Driver + Admin) dùng cho buổi bảo vệ 120 phút
- Modify: xoá dependency/google refs còn sót: `grep -ri "google" apps/ packages/ --include=*.js*` phải = 0 (ngoài node_modules)

- [ ] **Step 1:** Chạy trọn kịch bản: Customer đặt xe → Agent match → Driver accept → tracking → complete → payment → rating → Admin thấy KPI/ride/audit. Ghi kết quả từng bước vào checklist (✅/❌ + fix ❌).
- [ ] **Step 2:** Quét google refs = 0; `npm run build` cả 3 app xanh; commit: `docs(e2e): frontend demo checklist; chore: remove legacy apps`.

---

## Self-Review checklist (đã chạy khi viết plan)

- Coverage spec 9A: C1–C11 (F2–F6), Driver 7 màn (F7 — Login/KYC=OTP login, toggle, incoming, navigate, track, earnings, history), Admin 6 module (F8). Mapping UI↔Service (9A.5) tôn trọng: Login→Auth, Đặt xe→Booking, Matching→Agent, GPS→Ride+WS, ETA→ETA, Thanh toán→Payment, Surge→Pricing.
- Không placeholder: endpoint/payload/WS message type ghi cụ thể; 1 điểm cần đọc-khi-làm được chỉ đích danh file (audit routes F8).
- Type consistency: `useAuth`/`useBooking`/`useRealtime`/map components dùng thống nhất tên giữa các task; API client duy nhất từ F1.
