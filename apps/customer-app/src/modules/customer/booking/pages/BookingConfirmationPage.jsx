import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@app/BookingProvider.jsx";
import { useAuth } from "@app/AuthProvider.jsx";
import { request } from "@/services/httpClient.js";
import { v4 as uuidv4 } from 'uuid';

export function BookingConfirmationPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { pickup, destination, selectedRideOption, setBooking } = useBooking();
  const [loading, setLoading] = useState(false);

  const handleCreateBooking = async () => {
    if (!pickup || !destination || !selectedRideOption) return;

    setLoading(true);
    try {
      const idempotencyKey = uuidv4();
      
      // Gateway requires a valid UUID for userId
      // If session doesn't have a real UUID, we generate a stable one or a random one for testing
      const userId = session?.user?.subject_id || session?.user?.id || uuidv4();

      const payload = {
        userId: userId,
        pickup: {
          lat: pickup.lat,
          lng: pickup.lng,
          address: (pickup.address || "Vị trí đã chọn").substring(0, 250)
        },
        drop: {
          lat: destination.lat,
          lng: destination.lng,
          address: (destination.address || "Điểm đến").substring(0, 250)
        },
        vehicleType: selectedRideOption.id || "bike",
        paymentMethod: "CASH",
        distanceKm: selectedRideOption.distance > 0 ? selectedRideOption.distance : 0.1,
        price: selectedRideOption.price
      };

      console.log("[Booking] Sending payload to gateway:", payload);

      const response = await request("/api/v1/bookings", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        setBooking(result.data);
        navigate("/customer/booking/searching-driver");
      } else {
        console.error("[Booking] Gateway error:", result);
        alert(result.message || "Không thể đặt xe. Vui lòng kiểm tra lại thông tin.");
      }
    } catch (error) {
      console.error("Booking error:", error);
      alert("Đã có lỗi xảy ra khi kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  if (!pickup || !destination || !selectedRideOption) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col border-4 border-slate-900/5">
        <div className="px-6 pt-6 pb-4 border-b border-slate-50 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Xác nhận chuyến đi</h1>
          <button onClick={() => navigate(-1)} className="text-slate-400">✕</button>
        </div>

        <div className="flex-1 px-6 py-4 overflow-y-auto space-y-6">
          <div className="bg-slate-50 rounded-2xl p-4 relative">
            <div className="absolute left-[26px] top-[40px] bottom-[40px] border-l-2 border-dashed border-slate-300"></div>
            
            <div className="flex gap-4 relative mb-6">
              <div className="w-4 h-4 rounded-full bg-slate-900 border-4 border-white shadow-sm z-10"></div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Điểm đón</p>
                <p className="text-sm font-bold text-slate-900 truncate">{pickup.address}</p>
              </div>
            </div>

            <div className="flex gap-4 relative">
              <div className="w-4 h-4 rounded-full bg-red-500 border-4 border-white shadow-sm z-10"></div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Điểm đến</p>
                <p className="text-sm font-bold text-slate-900 truncate">{destination.address}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl">
                   {selectedRideOption.icon || "🚗"}
                </div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-slate-900">{selectedRideOption.type}</p>
                   <p className="text-xs text-slate-400">Dịch vụ tiêu chuẩn</p>
                </div>
                <div className="text-right">
                   <p className="text-sm font-bold text-slate-900">{selectedRideOption.price.toLocaleString()}đ</p>
                </div>
             </div>

             <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl">💵</div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-slate-900">Thanh toán</p>
                   <p className="text-xs text-slate-400">Tiền mặt</p>
                </div>
             </div>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-50">
          <div className="flex justify-between mb-4 px-2">
             <span className="text-sm text-slate-500 font-medium">Tổng số tiền</span>
             <span className="text-lg font-bold text-slate-900">{selectedRideOption.price.toLocaleString()}đ</span>
          </div>

          <button
            className={`w-full rounded-2xl bg-slate-900 text-white py-4 text-sm font-bold shadow-xl transition-all flex items-center justify-center gap-2 ${
              loading ? "opacity-70" : "active:scale-95"
            }`}
            onClick={handleCreateBooking}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Xác nhận đặt xe"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
