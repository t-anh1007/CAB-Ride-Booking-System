import { useNavigate } from "react-router-dom";
import { useDriverRide } from "@app/DriverRideProvider.jsx";
import { rideApi } from "@/services/rideApi.js";
import { useState } from "react";

export function DriverIncomingRideRequestPage() {
  const navigate = useNavigate();
  const { currentRide, setCurrentRide } = useDriverRide();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!currentRide) return;

    setLoading(true);
    try {
      const rideId = currentRide.rideId || currentRide.id;

      const result = await rideApi.acceptRide(rideId);

      if (result.success || result.data) {
        setCurrentRide(result.data || result);
        navigate("/driver/ride/navigate-pickup");
      } else {
        alert(result.message || "Failed to accept ride");
      }
    } catch (error) {
      console.error("Accept ride error:", error);
      alert(error.message || "Không có quyền nhận chuyến đi này (403 Forbidden)");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    navigate("/driver/availability/dashboard");
  };

  if (!currentRide) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <p>Không có yêu cầu mới</p>
        <button
          onClick={() => navigate("/driver/availability/dashboard")}
          className="mt-4 text-sm text-slate-400 underline"
        >
          Quay lại dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-end p-6 relative overflow-hidden">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900 z-0"></div>

      <div className="w-full max-w-sm bg-white rounded-[32px] p-6 z-10 shadow-2xl transform transition-all animate-in slide-in-from-bottom-8 duration-500">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-4 animate-bounce">
            🚗
          </div>
          <h1 className="text-xl font-bold text-slate-900">Yêu cầu mới!</h1>
          <p className="text-sm text-slate-500">{(currentRide.distanceKm || currentRide.distance_km || 0).toFixed(1)} km · {Math.ceil((currentRide.distanceKm || currentRide.distance_km || 0) * 2)} phút di chuyển</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="text-green-600">●</span>
              <span className="h-6 border-l border-dashed border-slate-300"></span>
              <span className="text-red-500">●</span>
            </div>
            <div className="flex-1 text-sm overflow-hidden">
              <p className="font-medium text-slate-900">Điểm đón</p>
              <p className="text-slate-500 mb-2 line-clamp-2 leading-relaxed">{currentRide.pickup?.address || "Hồ Chí Minh, Việt Nam"}</p>
              <p className="font-medium text-slate-900">Điểm đến</p>
              <p className="text-slate-500 line-clamp-2 leading-relaxed">{currentRide.destination?.address || "Hồ Chí Minh, Việt Nam"}</p>
            </div>
          </div>

          <div className="flex justify-between items-center py-3 border-t border-b">
            <div>
              <p className="text-xs text-slate-500">Giá chuyến đi</p>
              <p className="text-lg font-bold text-slate-900">
                {Number(currentRide.priceSnapshot || currentRide.price || currentRide.estimatedPrice || 0).toLocaleString()}đ
              </p>
            </div>
            {/* <div className="text-right">
              <p className="text-xs text-slate-500">Loại xe</p>
              <p className="text-sm font-semibold text-slate-900 capitalize">{currentRide.rideType || currentRide.vehicleType || "Car"}</p>
            </div> */}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-900 font-semibold active:scale-95 transition-transform"
            onClick={handleDecline}
          >
            Từ chối
          </button>
          <button
            className={`flex-[2] py-4 rounded-2xl bg-slate-900 text-white font-semibold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${loading ? "opacity-70 pointer-events-none" : ""
              }`}
            onClick={handleAccept}
            disabled={loading}
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Chấp nhận
          </button>
        </div>
      </div>

      <div className="mt-8 text-white/40 text-xs font-medium z-10">
        Tự động từ chối sau 15 giây...
      </div>
    </div>
  );
}
