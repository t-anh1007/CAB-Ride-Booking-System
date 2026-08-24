import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDriverRide } from "@app/DriverRideProvider.jsx";
import { rideApi } from "@/services/rideApi.js";
import { request } from "@/services/httpClient.js";

export function StartRidePage() {
  const navigate = useNavigate();
  const { currentRide, setCurrentRide } = useDriverRide();
  const [loading, setLoading] = useState(false);

  const handleStartRide = async () => {
    if (!currentRide) return;

    setLoading(true);
    try {
      const rideId = currentRide.rideId || currentRide.id;
      const driverId = currentRide.driverId || "driver-123";
      
      const result = await rideApi.startRide(rideId, driverId);
      
      if (result.success || result.data) {
        setCurrentRide(result.data || result);
        navigate("/driver/ride/in-progress");
      } else {
        alert(result.message || "Failed to start ride");
      }
    } catch (error) {
      console.error("Start ride error:", error);
      alert(error.message || "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Bắt đầu chuyến đi</h1>
            <p className="text-xs text-slate-500 mt-0.5">Đã đón khách</p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">Online</span>
        </div>

        <div className="flex-1 px-6 py-6">
          <div className="w-full h-full rounded-2xl bg-slate-200 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center mb-3 pointer-events-none">
              <div className="w-6 h-6 bg-blue-600 rounded-full border-4 border-white" />
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-blue-600 -mt-1" />
            </div>

            <div className="text-xs tracking-wide text-slate-500 select-none">MAP VIEW</div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="rounded-2xl bg-white border shadow-sm p-4 mb-4">
            <p className="text-sm font-medium mb-1">Điểm đến</p>
            <p className="text-xs text-slate-500 truncate">{currentRide?.destination?.address || "Đang xác định..."}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Khoảng cách</span>
              <span>{Number(currentRide?.distanceKm || 0).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Thời gian dự kiến</span>
              <span>{currentRide?.etaMinutes || Math.ceil((currentRide?.distanceKm || 0) * 2) || 10} phút</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Thu nhập</span>
              <span>{(currentRide?.priceSnapshot || currentRide?.estimatedPrice || 45000).toLocaleString()}đ</span>
            </div>
          </div>

          <div className="mb-4">
            <button
              className={`w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-medium active:scale-[0.98] flex items-center justify-center gap-2 ${
                loading ? "opacity-70 pointer-events-none" : ""
              }`}
              onClick={handleStartRide}
              disabled={loading}
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Bắt đầu chuyến đi
            </button>
          </div>

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
