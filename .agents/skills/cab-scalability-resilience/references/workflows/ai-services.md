# Workflow: ai-services

## Mục tiêu
Chuẩn hóa resilience review cho các thành phần AI / ML phục vụ Matching và Dynamic Surge Pricing. 
Đặc trưng của AI-ML là tốn tài nguyên và dễ dàng timeout nếu lưu lượng đột biến.

## Phạm vi
- `AI-ML/` modules (Matching engine, Surge predictors, ETAs).

---

## Scenario AI-1: AI Model Timeout Degradation (Fallback Heuristics)

### Objective
- Kiểm tra tính kháng lỗi nếu luồng Infer model ETA hoặc Surge Rate bị treo quá lâu. Hệ thống phải rẽ nhánh (Degrade) về logic Rule-based hoặc giải thuật đơn giản (Heuristic) để duy trì hoạt động thay vì sụp đổ.

### Entry Conditions
- Luồng tính toán ETA hoặc Matching của AI/ML đang mở tải.
- Đóng/Tắt container ML interface, hoặc delay hàm predict của model > 3000ms.

### Activation Method
- Push lượng tọa độ lớn / Gọi Model Inference liên tục. Cài delay bằng mock server cho AI Model Endpoint.

### Step-by-step Procedure
1. Gọi API Get AI Surge / Matching / ETA.
2. Endpoint Model châm ngòi timeout.
3. Observe Service gọi Model. Chờ xem Circuit breaker hoặc timeout limit có chém đứt connection AI không.
4. Đọc response trả vế. Payload phải nhận được ETA/Surge heuristic tĩnh (logic backup).

### Required Evidence
- AI Interface Logs (ví dụ: gRPC deadline exceeded, REST 504).
- Core service log ghi nhận "Fallback to rule-based ETA".
- Result Payload response.

### Result Rules
- **PASS**: Hệ thống mượt mà ngắt Model AI chậm chạp, thả lưới lưới an toàn là thuật toán base (như công thức tinh quãng đường Euclide).
- **FAIL**: Toàn hệ thống nghẽn vì chờ Model chạy Inference, scale sập.
- **MISSING_EVIDENCE**: Thiếu Code/Log cho thuật toán dự phòng, ML container lỗi là Backend báo 500 chết chung.
- **ARCHITECTURE_DRIFT**: Kiến trúc hô hào AI nhưng code thực tế chỉ có file if-else đơn giản, chưa thực sự có AI module nào được mount lên để gọi tới.

### Exit Conditions
- Phân loại rõ "Có AI thật không" hay "Chỉ có Rule engine gọi nhầm tên AI".

### Report Mapping
- `workflow_selected = ai-services`
- `scenario = AI-1`
- `missing_evidence_or_architecture_drift`: Đây là phần hay bị DRIFT nhất do quá trình phát triển dự án chưa thực sự đóng gói model AI, ưu tiên rà soát mục này kĩ lưỡng.
