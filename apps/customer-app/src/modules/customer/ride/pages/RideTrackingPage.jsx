import { useBooking } from "@app/BookingProvider.jsx";
import { useNavigate } from "react-router-dom";
import { useEffect, useContext, useState } from "react";
import { RealtimeContext } from "@app/RealtimeProvider.jsx";

export function RideTrackingPage() {
  const navigate = useNavigate();
  const { ride, setRide, destination } = useBooking();
  const { connection } = useContext(RealtimeContext);
  const [eta, setEta] = useState(10);

  useEffect(() => {
    if (!ride) {
      navigate("/customer/booking/pickup");
      return;
    }

    if (connection) {
       // Status check
       if (ride.status === "COMPLETED") {
          navigate("/customer/review/rating");
       }
    }
  }, [ride, navigate, connection]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 px-6 pt-6 z-10">
          <h1 className="text-lg font-semibold text-slate-900">Đang di chuyển</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tài xế đang đưa bạn đến điểm đến</p>
        </div>

        <div className="absolute inset-x-0 top-[80px] bottom-[320px] bg-slate-200 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center mb-3 pointer-events-none">
            <div className="w-6 h-6 bg-slate-900 rounded-full"></div>
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-slate-900 -mt-1"></div>
          </div>

          <div className="text-xs tracking-wide text-slate-500 select-none">MAP VIEW</div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-[320px] bg-white rounded-t-[28px] px-6 pt-5 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1.5 rounded-full bg-slate-300"></div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">🚗</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Đang trên đường</p>
              <p className="text-xs text-slate-500">Còn khoảng {eta} phút đến điểm đến</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Khoảng cách còn lại</span>
              <span>{Number(ride?.distanceKm || 0).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Thời gian dự kiến</span>
              <span>{ride?.etaMinutes || Math.ceil((ride?.distanceKm || 0) * 2) || eta} phút</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Điểm đến</span>
              <span className="truncate ml-4">{destination?.address || "Vincom Đồng Khởi"}</span>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:scale-[0.98]">
              Gọi tài xế
            </button>
            <button className="flex-1 rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600 active:scale-[0.98]">
              Trợ giúp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
