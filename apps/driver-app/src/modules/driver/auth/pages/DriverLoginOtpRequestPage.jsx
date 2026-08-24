import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "@/services/httpClient.js";
import { authApi } from "@/services/authApi.js";

export function DriverLoginOtpRequestPage() {
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
      const result = await authApi.requestOtp(phone);

      if (result.success || result.data || result.challengeStatus === "accepted") {
        const debugCode = result.debugOtpCode || result.data?.debugOtpCode;
        if (debugCode) {
          console.log("DEBUG OTP CODE:", debugCode);
          alert(`Mã OTP Driver (Debug): ${debugCode}`);
        }
        localStorage.setItem("temp_driver_login_phone", phone);
        navigate("/driver/auth/verify-otp");
      } else {
        alert(result.message || "Không thể gửi OTP");
      }
    } catch (error) {
      console.error("OTP Request Error:", error);
      alert(error.message || "Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">🚖</div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Driver App</h1>
              <p className="text-xs text-slate-500">Đăng nhập dành cho tài xế</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6">
          <label className="text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>

          <div className="flex items-center rounded-xl border px-4 py-3 mb-3 focus-within:ring-2 focus-within:ring-slate-900">
            <span className="text-slate-400 mr-2 text-sm">+84</span>
            <input
              type="tel"
              placeholder="Nhập số điện thoại"
              className="flex-1 outline-none text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRequestOtp()}
            />
          </div>

          <p className="text-xs text-slate-500 mb-6">Mã OTP sẽ được gửi tới số điện thoại (Debug sẽ hiện alert)</p>
        </div>

        <div className="px-6 pb-8">
          <button
            className={`w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? "opacity-70 pointer-events-none" : ""
              }`}
            onClick={handleRequestOtp}
            disabled={loading}
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Gửi mã OTP
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
