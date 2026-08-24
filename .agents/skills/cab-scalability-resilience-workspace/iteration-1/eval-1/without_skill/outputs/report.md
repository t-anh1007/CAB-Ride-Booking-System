# Payment Resilience

Hệ thống có file `retryEngine.js` triển khai exponential backoff.
Khi provider lỗi liên tục, retryCount tăng lên cho đến khi đạt giới hạn maxRetries. Khi đó payment chuyển sang `FAILED`. Hệ thống dùng Saga để compensation và không double charge.

Kết luận: Hệ thống pass.
