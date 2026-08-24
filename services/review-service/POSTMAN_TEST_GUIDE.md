# Hướng Dẫn Kéo Thả Test Review Service trên POSTMAN

Tài liệu này cung cấp hướng dẫn chi tiết từng bước (Step-by-Step) và dữ liệu cần nhập để kiểm thử độc lập service đánh giá.

⚠️ **Lưu ý quan trọng**: 
Dịch vụ của chúng ta hiện tại chạy **độc lập hoàn toàn** (không qua API Gateway). Hãy chắc chắn bạn đang để terminal chạy lệnh sau và hiện dòng chữ `[review-service] listening on port 3106`:
```bash
npm run dev:review
```

---

## 1. POST - Tạo đánh giá mới (Thành công)
**Mục đích:** Gửi một review hoàn chỉnh lên hệ thống.

**Các bước thao tác trong Postman:**
1. Tạo một tab mới (dấu `+` hoặc `New Request`).
2. Ở ô Method màu xanh, đổi `GET` thành **`POST`**.
3. Ở thanh URL, dán vào: `http://localhost:3106/api/v1/reviews`
4. Ở ngay dưới thanh URL, chọn tab **Body** -> Tích vào ô tròn **raw** -> Bấm vào chữ Text hiện ra và đổi thành **JSON**.
5. Copy đoạn dữ liệu dưới đây dán vào khung soạn thảo:
```json
{
  "rideId": "550e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "driverId": "550e8400-e29b-41d4-a716-446655440003",
  "rating": 5,
  "comment": "Tài xế rất thân thiện, xe sạch sẽ!"
}
```
6. Bấm nút **Send** màu xanh dương. Bạn sẽ nhận về `201 Created` và thông báo báo thành công ở phía cửa sổ dưới.

---

## 2. POST - Xử lý chống Spam (Idempotency)
**Mục đích:** Test cơ chế tự động chặn 1 khách hàng đánh giá 1 chuyến xe nhiều lần.
- Vẫn ở Tab Request vừa nãy, bạn hãy **bấm nút Send thêm một lần nữa** mà không thay đổi bất kỳ ký tự nào.
- Hệ thống sẽ trả về vòng chữ đỏ báo lỗi HTTP Code **`409 Conflict`** (Tức là API đã nhận diện bạn cố tình gửi lặp đánh giá spam và chặn lại ngay lập tức tại tầng service).

---

## 3. POST - Bẫy lỗi đánh giá quá quy định (Validation)
**Mục đích:** Test màng bọc lọc dữ liệu bị nhập sai thông số.
- Vẫn cấu hình như bước 1, nhưng bạn đổi dữ liệu Body thành:
```json
{
  "rideId": "111e8400-e29b-41d4-a716-446655440011",
  "userId": "222e8400-e29b-41d4-a716-446655440022",
  "driverId": "550e8400-e29b-41d4-a716-446655440003",
  "rating": 6, 
  "comment": "Đánh giá quá 5 sao để test bẫy lỗi"
}
```
- Bấm **Send**. Hệ thống sẽ báo cáo lỗi **`400 Bad Request`** ngay do số lượng `rating` vượt quá giới hạn 5 sao.

---

## 4. GET - Xem tất cả đánh giá của 1 cuốc xe
**Mục đích:** Khi màn hình app muốn hiển thị thông tin cuốc xe (Bao gồm danh sách các đánh giá của chuyến này).
- Tạo Tab `New Request` mới.
- **Method:** Để nguyên là **`GET`**
- **URL:** Dán dòng sau vào
  `http://localhost:3106/api/v1/reviews/ride/550e8400-e29b-41d4-a716-446655440001`
- Không cần nhập tab Body. Bấm **Send** và xem thông tin trả về dạng mảng lưới comment.

---

## 5. GET - Lấy toàn bộ đánh giá của 1 Bác Tài
**Mục đích:** Hiển thị trong Profile cá nhân của Bác Tài.
- Tạo Tab `New Request` mới. 
- **Method:** **`GET`**
- **URL:** 
  `http://localhost:3106/api/v1/reviews/driver/550e8400-e29b-41d4-a716-446655440003`
- Bấm **Send**.
- *Thông tin thú vị:* API này trả về toàn bộ mảng data các đánh giá cụ thể nhưng ĐỒNG THỜI tự động trả về luôn số lần đánh giá `totalReviews` và gộp lại thành điểm `averageRating` chung.

---

## 6. GET - Siêu truy vấn: Lấy Điểm Trung bình (Dành cho AI và Surge Pricing)
**Mục đích:** Trả về duy nhất con số điểm của Bác Tài để nạp vào hệ thống máy học (Machine learning Matching). Tách riêng để siêu tiết kiệm băng thông khi không cần load comment dài dòng. Mọi công đoạn tính toán diễn ra nhúng trong service.
- Tạo Tab `New Request` mới.
- **Method:** **`GET`**
- **URL:** 
  `http://localhost:3106/api/v1/reviews/driver/550e8400-e29b-41d4-a716-446655440003/average`
- Bấm **Send**.
