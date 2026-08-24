import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.js";
import { driverApi } from "@/services/driverApi.js";
import { authApi } from "@/services/authApi.js";
import { useNavigate } from "react-router-dom";

export function DriverProfilePage() {
  const { session, clearSession } = useAuth();
  const navigate = useNavigate();
  const driverId = session?.subject_id || session?.id || session?.driverId;
  const phone = session?.destination || "Chưa cập nhật";
  
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;
    const fetchDriver = async () => {
      try {
        const res = await driverApi.getDriver(driverId);
        setDriver(res.data);
      } catch (err) {
        console.error("Failed to fetch driver", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDriver();
  }, [driverId]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearSession();
      navigate("/driver/auth/login", { replace: true });
    }
  };

  const name = driver?.profile?.firstName 
    ? `${driver.profile.firstName} ${driver.profile.lastName || ''}` 
    : "Tài xế Cab";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Hồ sơ tài xế</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-xl">🚖</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{loading ? "Đang tải..." : name}</p>
              <p className="text-xs text-slate-500">⭐ {driver?.rating || "5.0"} · {driver?.totalTrips || 0} chuyến</p>
            </div>
            {driver?.kycStatus === "approved" ? (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Đã KYC</span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Chưa KYC</span>
            )}
          </div>

          <div className="rounded-2xl border divide-y">
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-slate-600">Số điện thoại</span>
              <span className="text-sm font-medium">{phone}</span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-slate-600">CMND / CCCD</span>
              <span className="text-sm font-medium">{driver?.kycStatus === "approved" ? "Đã cập nhật" : "Tải lên"}</span>
            </div>
          </div>

          <div className="rounded-2xl border">
            <div className="px-4 py-3 border-b text-sm font-semibold">Thông tin xe</div>

            <div className="px-4 py-3 flex justify-between text-sm">
              <span>Loại xe</span>
              <span className="font-medium text-slate-700">{driver?.vehicle?.type || "Chưa cập nhật"}</span>
            </div>

            <div className="px-4 py-3 flex justify-between text-sm">
              <span>Biển số</span>
              <span className="font-medium text-slate-700">{driver?.vehicle?.plateNumber || "Chưa cập nhật"}</span>
            </div>
          </div>

          <div className="rounded-2xl border divide-y">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>⚙️</span>
                <span className="text-sm">Cài đặt</span>
              </div>
              <span className="text-slate-400">›</span>
            </div>

            <div 
              className="px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={handleLogout}
            >
              <div className="flex items-center gap-3 text-red-600">
                <span>🚪</span>
                <span className="text-sm font-medium">Đăng xuất</span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
