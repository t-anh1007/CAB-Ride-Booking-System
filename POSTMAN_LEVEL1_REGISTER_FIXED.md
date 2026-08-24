# Postman - Level 1 TC1 + TC2 đã sửa theo code mới

## Environment / Collection variables

```txt
baseUrl : http://localhost:3000
customerDestination : user@test.com
customerChannel : email
customerUserId : để trống, request TC1 sẽ tự set
customerAccessToken : để trống, TC2 sẽ tự set
customerRefreshToken : để trống, TC2 sẽ tự set
```

---

## 1. Đăng ký user thành công

### Request

```http
POST {{baseUrl}}/api/v1/auth/register
```

### Body

```json
{
  "email": "{{customerDestination}}",
  "password": "123456",
  "name": "Test User"
}
```

### Tests

```javascript
pm.test("TC1 - Register user successfully", () => {
  pm.response.to.have.status(201);

  const json = pm.response.json();
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data).to.be.an("object");

  pm.expect(json.data.user_id).to.exist;
  pm.expect(json.data.email).to.eql(pm.environment.get("customerDestination"));
  pm.expect(json.data.name).to.eql("Test User");
  pm.expect(json.data.role).to.eql("customer");

  pm.environment.set("customerUserId", json.data.user_id);
  pm.environment.set("customerDestination", json.data.email);
  pm.environment.set("customerChannel", "email");
});
```

> Quan trọng: request này set `customerUserId = json.data.user_id`. Tất cả các test booking phía sau phải dùng đúng `{{customerUserId}}` này.

---

## 2.1. Request OTP cho đúng user vừa đăng ký

### Request

```http
POST {{baseUrl}}/api/v1/auth/login/otp/request
```

### Body

```json
{
  "destination": "{{customerDestination}}",
  "role": "customer",
  "channel": "{{customerChannel}}"
}
```

### Tests

```javascript
pm.test("TC2.1 - OTP request accepted", () => {
  pm.response.to.have.status(202);

  const json = pm.response.json();
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data.debugOtpCode).to.exist;

  pm.environment.set("customerOtp", json.data.debugOtpCode);
});
```

---

## 2.2. Verify OTP trả JWT và kiểm tra user_id giống TC1

### Request

```http
POST {{baseUrl}}/api/v1/auth/login/otp/verify
```

### Body

```json
{
  "destination": "{{customerDestination}}",
  "role": "customer",
  "code": "{{customerOtp}}"
}
```

### Tests

```javascript
pm.test("TC2 - Customer login returns JWT", () => {
  pm.response.to.have.status(200);

  const json = pm.response.json();
  const token = json.data.accessToken || json.data.tokens?.accessToken;
  const refresh = json.data.refreshToken || json.data.tokens?.refreshToken;

  pm.expect(token).to.exist;
  pm.expect(refresh).to.exist;

  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  pm.expect(payload.sub).to.exist;
  pm.expect(payload.exp).to.exist;

  pm.environment.set("customerAccessToken", token);
  pm.environment.set("customerRefreshToken", refresh);

  const verifiedUserId = json.data.account.subject_id;
  pm.expect(verifiedUserId).to.eql(pm.environment.get("customerUserId"));
  pm.environment.set("customerUserId", verifiedUserId);
});
```

---

## Các request sau phải dùng user_id này

Ví dụ tạo booking:

```json
{
  "userId": "{{customerUserId}}",
  "pickup": { "lat": 10.76, "lng": 106.66, "address": "IUH" },
  "destination": { "lat": 10.77, "lng": 106.70, "address": "Ben Thanh" },
  "distanceKm": 5,
  "vehicleType": "bike",
  "paymentMethod": "CASH",
  "quoteId": "{{quoteId}}"
}
```
