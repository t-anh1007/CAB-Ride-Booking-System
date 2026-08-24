import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.js";

export function DriverSessionExpiredPage() {
  const navigate = useNavigate();
  const { clearSession } = useAuth();

  useEffect(() => {
    // Ensure any residual session state is cleared on mount
    clearSession();
  }, [clearSession]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-3xl mb-6">🔒</div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Phiên làm việc đã hết hạn</h1>

          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Vì lý do bảo mật, phiên đăng nhập
            <br />
            của bạn đã bị thu hồi.
            <br />
            Vui lòng đăng nhập lại để tiếp tục hoạt động.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left w-full mb-6">
            <p className="text-xs text-slate-600 mb-2">Điều này có thể xảy ra khi:</p>
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              <li>Bạn không hoạt động trong thời gian dài</li>
              <li>Đăng nhập trên thiết bị khác</li>
              <li>Hệ thống yêu cầu xác thực lại</li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-8">
          <button 
            onClick={() => navigate("/driver/auth/login", { replace: true })}
            className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]"
          >
            Đăng nhập lại
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
