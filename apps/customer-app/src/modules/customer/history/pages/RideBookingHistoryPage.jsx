import { RideStatusBadge } from "@/components/status/RideStatusBadge.jsx";
import { RIDE_STATUS } from "@/constants/rideStatus.js";

export function RideBookingHistoryPage() {
  const recentTrips = [
    ["📍 Vị trí hiện tại → Vincom Đồng Khởi", RIDE_STATUS.COMPLETED, "Hôm nay · 14:35", "45.000đ"],
    ["🏠 Nhà → Công ty", RIDE_STATUS.COMPLETED, "Hôm qua · 08:12", "38.000đ"]
  ];

  const earlierTrips = [
    ["📍 Sân bay → Nhà", RIDE_STATUS.CANCELED, "12/04 · 21:10", "0đ"],
    ["🏬 Vincom Thảo Điền → Nhà", RIDE_STATUS.COMPLETED, "09/04 · 18:40", "62.000đ"]
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Lịch sử chuyến đi</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-3">Gần đây</p>

            {recentTrips.map(([route, status, time, price]) => (
              <div key={`${route}-${time}`} className="rounded-2xl border p-4 mb-3 last:mb-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="text-sm font-medium">{route}</div>
                  <RideStatusBadge status={status} />
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                  <span>{time}</span>
                  <span className="text-sm font-semibold text-slate-900">{price}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-3">Trước đó</p>

            {earlierTrips.map(([route, status, time, price]) => (
              <div key={`${route}-${time}`} className="rounded-2xl border p-4 mb-3 last:mb-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="text-sm font-medium">{route}</div>
                  <RideStatusBadge status={status} />
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                  <span>{time}</span>
                  <span className="text-sm font-semibold text-slate-900">{price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6"></div>
      </div>
    </div>
  );
}
