import { useBooking } from "@app/BookingProvider.jsx";
import { useNavigate } from "react-router-dom";
import { useEffect, useContext } from "react";
import { RealtimeContext } from "@app/RealtimeProvider.jsx";

export function DriverAssignedPage() {
  const navigate = useNavigate();
  const { ride, setRide } = useBooking();
  const { connection } = useContext(RealtimeContext);

  useEffect(() => {
    if (!ride) {
      navigate("/customer/booking/pickup");
      return;
    }

    // Listen for ride status changes (STARTED)
    if (connection) {
      const handleMessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const payload = message.payload || message;
          if ((message.type === "ride.status.changed" || message.type === "ride.status.updated") && 
              (payload?.rideId === ride.rideId || payload?.bookingId === ride.rideId)) {
            
            setRide(payload);
            if (payload.status === "STARTED" || payload.status === "IN_PROGRESS") {
              navigate("/customer/ride/tracking");
            }
          }
        } catch (e) {
          console.error("WS Error:", e);
        }
      };
      
      const target = connection.socket || connection;
      target.addEventListener('message', handleMessage);
      return () => target.removeEventListener('message', handleMessage);
    }
  }, [ride, navigate, connection, setRide]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 px-6 pt-6 z-10">
          <h1 className="text-lg font-semibold text-slate-900">Tài xế đã nhận chuyến</h1>
        </div>

        <div className="absolute inset-x-0 top-[70px] bottom-[320px] bg-slate-200 flex flex-col items-center justify-center">
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

          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl">
               {ride?.rideType === 'bike' ? '🛵' : '🚗'}
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{ride?.driverName || "Tài xế của bạn"}</p>
              <p className="text-xs text-slate-500 mt-0.5">⭐ 4.9 · Chuyến xe an toàn</p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">Đang tới</p>
              <p className="text-sm font-semibold">{ride?.etaMinutes || Math.ceil((ride?.distanceKm || ride?.distance_km || 0) * 2) || 2} phút</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Loại xe</span>
              <span className="capitalize">{ride?.rideType || ride?.vehicleType || 'Car'}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Biển số</span>
              <span>{ride?.vehicleInfo?.plateNumber || ride?.plateNumber || "59-CAB.123"}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Giá chuyến đi</span>
              <span>{(ride?.price || ride?.priceSnapshot || ride?.estimatedPrice || 0).toLocaleString()}đ</span>
            </div>
          </div>

          <div className="flex gap-3 mt-2 mb-4">
            <button className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:scale-[0.98]">
              Gọi tài xế
            </button>
            <button className="flex-1 rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600 active:scale-[0.98]">
              Huỷ chuyến
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
