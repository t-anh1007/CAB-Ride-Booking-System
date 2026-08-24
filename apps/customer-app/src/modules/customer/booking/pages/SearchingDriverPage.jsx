import { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@app/BookingProvider.jsx";
import { RealtimeContext } from "@app/RealtimeProvider.jsx";
import { AuthContext } from "@app/AuthProvider.jsx";

export function SearchingDriverPage() {
  const navigate = useNavigate();
  const { booking, selectedRideOption, setRide } = useBooking();
  const { connect, connection, disconnect } = useContext(RealtimeContext);
  const { session } = useContext(AuthContext);

  useEffect(() => {
    if (!booking) {
      navigate("/customer/booking/pickup");
      return;
    }

    const conn = connect({
      client: "customer",
      token: session?.accessToken,
      onMessage: (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === "ride.assigned" || message.type === "ride.status.changed") {
            const payload = message.payload || message;
            if (payload?.bookingId === booking.bookingId || payload?.rideId === booking.bookingId) {
              setRide(payload);
              // Chỉ chuyển trang khi tài xế đã thực sự chấp nhận (ACCEPTED)
              if (payload.status === "ACCEPTED") {
                navigate("/customer/ride/driver-assigned");
              }
            }
          }
        } catch (e) {
          console.error("WS Message Error:", e);
        }
      }
    });

    return () => {
      // Don't disconnect here if we want to keep receiving updates in the next page
      // but we should probably manage connection at a higher level
    };
  }, [booking, connect, navigate, session?.accessToken, setRide]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute inset-0 bg-slate-200 flex items-center justify-center">
          <div className="text-slate-400 text-sm select-none">MAP VIEW</div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 bg-slate-900 rounded-full"></div>
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-slate-900 -mt-1"></div>
            </div>
          </div>
        </div>

        <div className="absolute top-0 inset-x-0 px-6 pt-6 z-10">
          <h1 className="text-lg font-semibold text-slate-900">Đang tìm tài xế</h1>
        </div>

        <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-[28px] px-6 pt-6 pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin"></div>
            <p className="mt-4 text-sm font-semibold">Đang tìm tài xế gần bạn</p>
            <p className="text-xs text-slate-500 mt-1 text-center">Vui lòng chờ trong giây lát</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span>Loại xe</span>
              <span className="capitalize">🚗 {selectedRideOption?.type}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Khoảng cách</span>
              <span>{selectedRideOption?.distance?.toFixed(1) || "..."} km</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Giá dự kiến</span>
              <span>{selectedRideOption?.price.toLocaleString()}đ</span>
            </div>
          </div>

          <button
            className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:scale-[0.98]"
            onClick={() => navigate("/customer/booking/pickup")}
          >
            Huỷ chuyến
          </button>
        </div>
      </div>
    </div>
  );
}
