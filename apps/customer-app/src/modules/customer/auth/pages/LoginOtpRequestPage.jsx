import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "@/services/httpClient.js";

export function LoginOtpRequestPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!phone) {
      alert("Vui lòng nhập số điện thoại");
      return;
    }
    
    setLoading(true);
    try {
      const response = await request("/api/v1/auth/login/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "customer",
          destination: phone,
          channel: "sms"
        })
      });

      const result = await response.json();

      // TRƯỜNG HỢP THÀNH CÔNG (200, 202)
      if (response.ok) {
        // Hiện OTP Alert nếu có mã debug
        if (result.data?.debugOtpCode || result.debugOtpCode) {
          const otp = result.data?.debugOtpCode || result.debugOtpCode;
          alert(`[DEBUG] Mã OTP của bạn là: ${otp}`);
        } else {
          alert("Mã OTP đã được gửi! Hãy kiểm tra log Backend.");
        }
        
        localStorage.setItem("temp_login_phone", phone);
        navigate("/customer/auth/verify-otp");
      } 
      // TRƯỜNG HỢP LỖI (400, 401, 500...)
      else {
        let errorMsg = result.message || result.error || "Không thể gửi OTP";
        
        // Nếu errorMsg vẫn là object, biến nó thành chuỗi
        if (typeof errorMsg === "object") {
          errorMsg = JSON.stringify(errorMsg);
        }
        
        // Bóc tách lỗi validation nếu có
        if (result.data?.issues) {
          const issuesList = result.data.issues.map(i => `- ${i.path}: ${i.message}`).join("\n");
          errorMsg = `Lỗi nhập liệu:\n${issuesList}`;
        }
        
        alert(`LỖI: ${errorMsg}`);
      }
    } catch (error) {
      console.error("OTP Request Error:", error);
      alert("LỖI KẾT NỐI: Không thể kết nối tới Server. Hãy đảm bảo Gateway đang chạy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 flex items-center justify-center">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-8">
          <h1 className="text-2xl font-bold tracking-tight">Chào mừng bạn</h1>
          <p className="text-slate-500 text-sm mt-1">Đăng nhập để tiếp tục đặt chuyến đi</p>
        </div>

        <div className="flex-1 px-6 flex flex-col justify-center">
          <label className="text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>

          <div className="flex items-center rounded-xl border px-4 py-3 focus-within:ring-2 focus-within:ring-slate-900">
            <span className="text-slate-400 text-sm mr-2">+84</span>
            <input
              type="tel"
              placeholder="Nhập số điện thoại"
              className="flex-1 outline-none text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRequestOtp()}
            />
          </div>

          <p className="text-xs text-slate-500 mt-3">Mã OTP sẽ hiện Alert sau khi gửi thành công</p>
        </div>

        <div className="px-6 pb-8">
          <button
            className={`w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-medium active:scale-[0.98] flex items-center justify-center gap-2 ${
              loading ? "opacity-70 pointer-events-none" : ""
            }`}
            onClick={handleRequestOtp}
            disabled={loading}
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Gửi mã OTP
          </button>
        </div>
      </div>
    </div>
  );
}
