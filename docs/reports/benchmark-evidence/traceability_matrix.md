# Traceability Matrix — 121 TC (sinh tự động)

- Covered: **50/121 = 41.3%**
- Pass (trên TC đã cover): **29/50 = 58.0%**

| TC | Tiêu đề (rút gọn) | Nguồn test | Trạng thái |
|---|---|---|---|
| TC1 | Đăng ký user thành công | postman:newman-lv6 | PASS |
| TC2 | Đăng nhập trả JWT hợp lệ | postman:newman-lv6 | PASS |
| TC3 | Tạo booking với input hợp lệ | postman:newman-lv6, unit:booking-service | PASS |
| TC4 | Lấy danh sách booking của user | postman:newman-lv6, unit:booking-service | FAIL |
| TC5 | Driver chuyển trạng thái online | postman:newman-lv6, unit:driver-service | FAIL |
| TC6 | Booking được tạo với status = | postman:newman-lv6, unit:booking-service | FAIL |
| TC7 | Gọi | postman:newman-lv6 | PASS |
| TC8 | Pricing | postman:newman-lv6, unit:pricing-service | FAIL |
| TC9 | Notification gửi thành công | postman:newman-lv6 | FAIL |
| TC10 | Logout invalidate token | postman:newman-lv6 | PASS |
| TC11 | Booking thiếu pickup → lỗi 400User gửi request tạo booking n | postman:newman-cab-levels, unit:booking-service | PASS |
| TC12 | Sai format lat/lng → reject | unit:booking-service | PASS |
| TC13 | Driver offline không nhận | unit:driver-service | PASS |
| TC14 | Payment method invalid → rejectUser chọn phương thức thanh t | unit:payment-service | PASS |
| TC15 | ETA với distance = 0 Pickup = Drop { | - | NOT COVERED |
| TC16 | Pricing với demand_index = 0 | unit:pricing-service | FAIL |
| TC17 | Fraud | - | NOT COVERED |
| TC18 | Token expired → 401 | - | NOT COVERED |
| TC19 | Duplicate booking request | unit:booking-service | PASS |
| TC20 | Input quá lớn (payload size test) | - | NOT COVERED |
| TC21 | Booking → gọi ETA service | postman:newman-cab-levels | PASS |
| TC22 | Booking → gọi | - | NOT COVERED |
| TC23 | AI | unit:driver-service | PASS |
| TC24 | Booking → Payment → | postman:newman-cab-levels | FAIL |
| TC25 | Kafka event ride_requested được | unit:booking-service | PASS |
| TC26 | Driver nhận notification | - | NOT COVERED |
| TC27 | Booking update trạng thái | unit:ride-service | PASS |
| TC28 | MCP context được fetch thành côngAI | - | NOT COVERED |
| TC29 | API Gateway route đúng serviceRequest đi qua | - | NOT COVERED |
| TC30 | Retry khi | unit:pricing-service | PASS |
| TC31 | Transaction tạo booking thành | postman:newman-cab-levels, unit:booking-service | FAIL |
| TC32 | Rollback khi lỗi giữa chừng Lỗi xảy ra sau khi insert | unit:ride-service | PASS |
| TC33 | Payment th ất bại → rollback | - | NOT COVERED |
| TC34 | Idempotent transaction (duplicate | unit:payment-service | PASS |
| TC35 | Concurrent booking (race | - | NOT COVERED |
| TC36 | Saga transaction – success flow | unit:payment-service | PASS |
| TC37 | Saga transaction – failure + | unit:payment-service | PASS |
| TC38 | Kafka event consistency (outbox | unit:booking-service | PASS |
| TC39 | Partial failure (network issue) | - | NOT COVERED |
| TC40 | Data integrity (ACID) Transaction phức tạp tương ứng nhiều | - | NOT COVERED |
| TC41 |  | - | NOT COVERED |
| TC42 | Pricing surge > 1 khi demand cao demand cao demand_index = 2 | unit:pricing-service | FAIL |
| TC43 | Fraud score > threshold → | - | NOT COVERED |
| TC44 | Recommendation trả top-3 | - | NOT COVERED |
| TC45 | Forecast trả dữ liệu đúng format dự báo nhu cầu historical d | - | NOT COVERED |
| TC46 | Model version được trả về đúng nhiều version model request T | - | NOT COVERED |
| TC47 | AI latency < 200ms service real-time nhiều request latency < | - | NOT COVERED |
| TC48 | Drift detection trigger data thay đổi theo thời gian | - | NOT COVERED |
| TC49 | Model fallback khi lỗi model lỗi simulate model crash fallba | - | NOT COVERED |
| TC50 | Input bất thư ờng → model không | - | NOT COVERED |
| TC51 | Agent chọn driver gần nhất nhiều driver available D1: 5km | postman:newman-lv6 | FAIL |
| TC52 | Agent chọn driver có rating cao | postman:newman-lv6 | FAIL |
| TC53 | Agent cân bằng ETA vs price trade-off | postman:newman-lv6 | FAIL |
| TC54 | Agent gọi đúng tool (ETA vs | postman:newman-lv6 | FAIL |
| TC55 | Agent xử lý context thiếu dữ liệu thiếu dữ liệu driver Đưa r | postman:newman-lv6 | FAIL |
| TC56 | Agent retry khi service lỗi ETA service fail Đưa ra một luồn | postman:newman-lv6 | PASS |
| TC57 | Agent không chọn driver offline driver list có offline Đưa r | postman:newman-lv6, unit:driver-service | FAIL |
| TC58 | Agent log decision đầy đủ agent hoạt động Đưa ra một luồng n | postman:newman-lv6 | FAIL |
| TC59 | Agent xử lý nhiều request song | postman:newman-lv6 | FAIL |
| TC60 | Agent fallback rule-based khi | postman:newman-lv6 | FAIL |
| TC61 | 1000 requests/second booking nhiều user đặt xe cùng lúc | k6:booking-load.js | FAIL |
| TC62 | ETA service under load | k6:eta-load.js | PASS |
| TC63 | Pricing service under spike surge giờ cao điểm spike request | k6:spike-pricing.js, unit:pricing-service | PASS |
| TC64 | Kafka throughput test nhiều event (ride_requested) hàng nghì | - | NOT COVERED |
| TC65 | DB connection pool exhaustion quá nhiều connection | - | NOT COVERED |
| TC66 | Redis cache hit rate > 90% cache được sử dụng nhiều request  | - | NOT COVERED |
| TC67 | API Gateway rate limit traffic cao vượt threshold | - | NOT COVERED |
| TC68 | P95 latency < 300ms đo performance | k6:booking-load.js, unit:booking-service | FAIL |
| TC69 | Load test giờ cao điểm mô phỏng giờ cao điểm load tăng dần:  | k6:booking-load.js | PASS |
| TC70 | Auto scaling hoạt động hệ thống dùng Kubernetes / Swarm CPU/ | - | NOT COVERED |
| TC71 | Driver service down → fallbackDriver | - | NOT COVERED |
| TC72 | Pricing service timeout → retryPricing chậm hoặc không phản  | unit:pricing-service | PASS |
| TC73 | Kafka down → buffer event | unit:booking-service | PASS |
| TC74 | DB failover | - | NOT COVERED |
| TC75 | Circuit breaker open | - | NOT COVERED |
| TC76 | Partial system failure handling Một phần hệ thống lỗi bookin | - | NOT COVERED |
| TC77 | Retry exponential backoff | - | NOT COVERED |
| TC78 | Service mesh routing fail routing lỗi request qua mesh: (ser | - | NOT COVERED |
| TC79 | Network partition test các service không giao tiếp được simu | - | NOT COVERED |
| TC80 | Graceful degradation hệ thống quá tải hoặc lỗi user request  | - | NOT COVERED |
| TC81 | SQL injection attempt | - | NOT COVERED |
| TC82 | XSS input test | - | NOT COVERED |
| TC83 | JWT tampering | - | NOT COVERED |
| TC84 | Unauthorized | - | NOT COVERED |
| TC85 | Rate limit attack | - | NOT COVERED |
| TC86 | Replay attack (idempotency) | unit:payment-service | PASS |
| TC87 | Data encryption at rest Dữ liệu lưu trong | - | NOT COVERED |
| TC88 | mTLS communication Service-to-service communication | - | NOT COVERED |
| TC89 | RBAC enforcement Role-based access control user role = DRIVE | - | NOT COVERED |
| TC90 | Sensitive data masking | - | NOT COVERED |
| TC91 | Request không có token | postman:newman-cab-levels | PASS |
| TC92 | Token không hợp lệ (tampered) | postman:newman-cab-levels | PASS |
| TC93 | Token hết hạn | - | NOT COVERED |
| TC94 | Service-to-service authentication | - | NOT COVERED |
| TC95 | RBAC – user không có quyền | postman:newman-cab-levels | FAIL |
| TC96 | Least privilege (driver không truy | - | NOT COVERED |
| TC97 | API Gateway kiểm tra tất cả | - | NOT COVERED |
| TC98 | Rate limiting chống abuse | - | NOT COVERED |
| TC99 | Data encryption in transit Giao tiếp giữa các service | - | NOT COVERED |
| TC100 | Audit logging (security trace) | - | NOT COVERED |
| TC101 | Deploy service thành công | - | NOT COVERED |
| TC102 | Health check endpoint | - | NOT COVERED |
| TC103 | Environment variables đúng | - | NOT COVERED |
| TC104 | Service connect database | - | NOT COVERED |
| TC105 | Service connect | - | NOT COVERED |
| TC106 | Rolling update (zero downtime) | - | NOT COVERED |
| TC107 | Auto scaling (HPA) Tải tăng cao Simulate CPU > threshold Pod | - | NOT COVERED |
| TC108 | Service mesh routing | - | NOT COVERED |
| TC109 | Config sai → fail fast ENV sai (DB URL sai) DATABASE_URL inv | - | NOT COVERED |
| TC110 | Rollback deployment | - | NOT COVERED |
| TC111 | Logging đầy đủ request | - | NOT COVERED |
| TC112 | Structured logging format | - | NOT COVERED |
| TC113 | Metrics được expose | - | NOT COVERED |
| TC114 | Dashboard hiển thị đúng | - | NOT COVERED |
| TC115 | Distributed tracing hoạt động | - | NOT COVERED |
| TC116 | Alert khi error rate cao | - | NOT COVERED |
| TC117 | Alert khi latency cao | - | NOT COVERED |
| TC118 | AI service monitoring | - | NOT COVERED |
| TC119 | Kafka monitoring Event streaming hoạt động Publish ride_requ | - | NOT COVERED |
| TC120 | Resource monitoring (CPU, | - | NOT COVERED |
| TC121 |  | - | NOT COVERED |
