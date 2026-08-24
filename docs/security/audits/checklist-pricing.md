# Security Fix Checklist - PRICING-SERVICE

---

## 🔴 P0 - Critical Risks

- [ ] **Risk**: **Fare Manipulation** (Client sends `distanceKm`/`durationMin`)
    - **Gợi ý Fix**: 
        - Sửa `services/pricing-service/src/controllers/pricingController.js`.
        - Loại bỏ 2 tham số này khỏi `req.body`.
        - Tích hợp ETA service hoặc Maps service nội bộ để tự tính toán dựa trên `pickup` và `destination`.
    - **Trạng thái**: Pending

- [ ] **Risk**: **Broken Price Integrity** (Booking service ignores/trusts price)
    - **Gợi ý Fix**: 
        - Sửa `services/booking-service/src/controllers/bookingController.js`.
        - Khi tạo booking, phải gọi nội bộ sang `pricing-service` để lấy báo giá chính thức và lưu vào `priceSnapshot`.
    - **Trạng thái**: Pending

- [ ] **Risk**: **IDOR in Booking Creation**
    - **Gợi ý Fix**: 
        - Kiểm tra `userId` trong JWT (`req.auth.userId`) so với `userId` trong request body.
        - Reject request nếu không trùng khớp.
    - **Trạng thái**: Pending

---

## 🟡 P1 - High Risks

- [ ] **Risk**: **Business Metrics Leak** (Exposing supply/demand counts)
    - **Gợi ý Fix**: 
        - Mask hoặc loại bỏ hoàn toàn field `metrics` trong response JSON của `getQuote`.
    - **Trạng thái**: Pending

- [ ] **Risk**: **Insecure Gateway Routing Policy**
    - **Gợi ý Fix**: 
        - Cập nhật `gateway/api-gateway/src/route-registry.js`.
        - Bổ sung `rateLimit` và `validationSchema` riêng cho `/api/v1/pricing/quote`.
    - **Trạng thái**: Pending

---

## 🔵 P2 - Medium Risks

- [ ] **Risk**: **Plaintext Intra-service Communication**
    - **Gợi ý Fix**: 
        - Cấu hình mTLS cho cụm Swarm.
    - **Trạng thái**: Pending
