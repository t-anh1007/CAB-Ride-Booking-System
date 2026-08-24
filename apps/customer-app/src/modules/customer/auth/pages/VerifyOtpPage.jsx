import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@app/AuthProvider.jsx";
import { request } from "@/services/httpClient.js";

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const { setSession } = useContext(AuthContext);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const phone = localStorage.getItem("temp_login_phone");

  useEffect(() => {
    if (!phone) {
      navigate("/customer/auth/login");
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
      const response = await request("/api/v1/auth/login/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "customer",
          destination: phone,
          code: code
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setSession({
           accessToken: result.data?.accessToken || result.accessToken || result.tokens?.accessToken,
           role: "customer",
           user: result.data?.account || result.account || result.user
        });
        localStorage.removeItem("temp_login_phone");
        alert("Xác thực thành công!");
        navigate("/customer/booking/pickup");
      } else {
        const errorMsg = result.message || result.error || "Mã OTP không chính xác";
        alert(`LỖI XÁC THỰC: ${errorMsg}`);
      }
    } catch (error) {
      console.error("OTP Verify Error:", error);
      alert("LỖI KẾT NỐI: Không thể xác thực mã OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 flex items-center justify-center">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-8">
          <h1 className="text-2xl font-bold tracking-tight">Xác minh mã OTP</h1>
          <p className="text-slate-500 text-sm mt-1">Nhập mã 6 chữ số đã gửi đến {phone}</p>
        </div>

        <div className="flex-1 px-6 flex flex-col justify-center">
          <div className="flex justify-between gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                className="w-full h-14 rounded-xl border text-center text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
              />
            ))}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Không nhận được mã?{" "}
              <span className="font-medium text-slate-900 cursor-pointer" onClick={() => navigate("/customer/auth/login")}>Quay lại gửi lại mã</span>
            </p>
          </div>
        </div>

        <div className="px-6 pb-8">
          <button
            className={`w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-medium active:scale-[0.98] flex items-center justify-center gap-2 ${
              loading ? "opacity-70 pointer-events-none" : ""
            }`}
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Xác minh
          </button>
        </div>
      </div>
    </div>
  );
}
