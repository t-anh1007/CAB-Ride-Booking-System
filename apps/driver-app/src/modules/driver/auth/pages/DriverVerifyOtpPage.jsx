import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@app/AuthProvider.jsx";
import { authApi } from "@/services/authApi.js";
import { request } from "@/services/httpClient.js";

export function DriverVerifyOtpPage() {
  const navigate = useNavigate();
  const { setSession } = useContext(AuthContext);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const phone = localStorage.getItem("temp_driver_login_phone");

  useEffect(() => {
    if (!phone) {
      navigate("/driver/auth/login");
    }
  }, [phone, navigate]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      alert("Vui lòng nhập đủ 6 số");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.verifyOtp(phone, code);
      
      if (result.success || result.data || result.authStatus === "verified") {
        const sessionData = result.data || result;
        setSession({
          accessToken: sessionData.accessToken || sessionData.tokens?.accessToken,
          role: "driver",
          user: sessionData.account || sessionData.user,
          ...sessionData
        });
        localStorage.removeItem("temp_driver_login_phone");
        navigate("/driver/availability/dashboard");
      } else {
        alert(result.message || "Mã OTP không chính xác");
      }
    } catch (error) {
      console.error("OTP Verify Error:", error);
      alert(error.message || "Lỗi xác thực");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">🚖</div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Xác minh OTP</h1>
              <p className="text-xs text-slate-500">Driver App</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6">
          <p className="text-sm text-slate-600 mb-4">
            Nhập mã OTP đã gửi đến {phone}
          </p>

          <div className="flex justify-between gap-2 mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                className="w-full h-14 rounded-xl border text-center text-xl font-semibold outline-none focus:ring-2 focus:ring-slate-900"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
              />
            ))}
          </div>

          <p className="text-xs text-slate-500 text-center">
            Không nhận được mã? <span className="text-slate-900 font-medium cursor-pointer">Gửi lại</span>
          </p>
        </div>

        <div className="px-6 pb-8">
          <button
            className={`w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? "opacity-70 pointer-events-none" : ""
              }`}
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Xác minh
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
