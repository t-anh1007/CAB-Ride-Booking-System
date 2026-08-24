import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.js";
import { driverApi } from "@/services/driverApi.js";

export function DriverKycVehicleProfilePage() {
  const { session } = useAuth();
  const driverId = session?.subject_id || session?.id || session?.driverId;
  
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

  const getKycBanner = () => {
    if (loading) return null;
    if (driver?.kycStatus === "approved") {
      return (
        <div className="rounded-2xl bg-green-50 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">✅</div>
          <div>
            <p className="text-sm font-semibold text-green-900">Hồ sơ đã được duyệt</p>
            <p className="text-xs text-green-700 mt-1">Bạn có thể nhận chuyến ngay.</p>
          </div>
        </div>
      );
    }
    if (driver?.kycStatus === "rejected") {
      return (
        <div className="rounded-2xl bg-red-50 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">❌</div>
          <div>
            <p className="text-sm font-semibold text-red-900">Hồ sơ bị từ chối</p>
            <p className="text-xs text-red-700 mt-1">Vui lòng cập nhật lại giấy tờ.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl bg-yellow-50 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">🕒</div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Hồ sơ đang được duyệt</p>
          <p className="text-xs text-slate-500 mt-1">Vui lòng chờ trong 24-48 giờ để hệ thống xác minh thông tin.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Xác minh KYC</h1>
          <p className="text-xs text-slate-500 mt-0.5">Hoàn tất hồ sơ để nhận chuyến</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {getKycBanner()}

          <div className="rounded-2xl border">
            <div className="px-4 py-3 border-b text-sm font-semibold">Giấy tờ cá nhân</div>

            <div className="px-4 py-3 flex justify-between items-center text-sm">
              <span>CMND / CCCD</span>
              <span className={`font-medium ${driver?.kycStatus === "approved" ? "text-green-600" : "text-yellow-600"}`}>
                {driver?.kycStatus === "approved" ? "Đã duyệt" : "Tải lên"}
              </span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center text-sm">
              <span>Giấy phép lái xe</span>
              <span className={`font-medium ${driver?.kycStatus === "approved" ? "text-green-600" : "text-yellow-600"}`}>
                {driver?.kycStatus === "approved" ? "Đã duyệt" : "Tải lên"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border">
            <div className="px-4 py-3 border-b text-sm font-semibold">Thông tin xe</div>

            <div className="px-4 py-3 flex justify-between items-center text-sm">
              <span>Loại xe</span>
              <span className="font-medium text-slate-700">{driver?.vehicle?.type || "Chưa cập nhật"}</span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center text-sm">
              <span>Biển số</span>
              <span className="font-medium text-slate-700">{driver?.vehicle?.plateNumber || "Chưa cập nhật"}</span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center text-sm">
              <span>Giấy đăng ký xe</span>
              <span className={`font-medium ${driver?.kycStatus === "approved" ? "text-green-600" : "text-yellow-600"}`}>
                {driver?.kycStatus === "approved" ? "Đã duyệt" : "Tải lên"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border-dashed border-2 border-slate-300 p-4 text-center">
            <p className="text-sm text-slate-600 mb-2">Cập nhật hoặc bổ sung giấy tờ</p>
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Tải lên giấy tờ
            </button>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
