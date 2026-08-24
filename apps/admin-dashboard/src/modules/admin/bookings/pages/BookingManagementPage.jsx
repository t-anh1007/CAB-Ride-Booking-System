import { BookingStatusBadge } from "@/components/status/BookingStatusBadge.jsx";
import { BOOKING_STATUS } from "@/constants/bookingStatus.js";

export function BookingManagementPage() {
  const bookings = [
    ["#BK102938", "User: Nguyễn Văn A", "Driver: Trần Minh H", BOOKING_STATUS.SEARCHING, "Hôm nay · 14:32", "45.000đ"],
    ["#BK102921", "User: Trần Thị B", "Driver: Nguyễn Văn T", BOOKING_STATUS.CONFIRMED, "Hôm nay · 12:05", "62.000đ"],
    ["#BK102910", "User: Lê Minh C", "Driver: —", BOOKING_STATUS.CANCELED, "Hôm qua · 21:18", "0đ"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý Booking</h1>
          <p className="text-sm text-slate-500 mt-0.5">Booking Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo mã, user, driver…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            {bookings.map(([code, user, driver, status, time, amount]) => (
              <div key={code} className="rounded-2xl border p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold">{code}</p>
                    <p className="text-xs text-slate-500 mt-1">{user}</p>
                    <p className="text-xs text-slate-500">{driver}</p>
                  </div>
                  <BookingStatusBadge status={status} />
                </div>

                <div className="flex justify-between text-xs text-slate-500 mt-3">
                  <span>{time}</span>
                  <span>{amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
