import { RideStatusBadge } from "@/components/status/RideStatusBadge.jsx";
import { RIDE_STATUS } from "@/constants/rideStatus.js";

export function RideManagementPage() {
  const rides = [
    ["#RD553210", "User: Nguyễn Văn A", "Driver: Trần Minh H", RIDE_STATUS.IN_PROGRESS, "3.2 km", "9 phút", "45.000đ"],
    ["#RD553198", "User: Trần Thị B", "Driver: —", RIDE_STATUS.REQUESTED, null, null, "62.000đ"],
    ["#RD553150", "User: Lê Minh C", "Driver: Nguyễn Văn T", RIDE_STATUS.COMPLETED, null, null, "38.000đ"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý chuyến đi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ride Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo mã chuyến, user, driver…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            {rides.map(([code, user, driver, status, distance, eta, amount]) => (
              <div key={code} className="rounded-2xl border p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold">{code}</p>
                    <p className="text-xs text-slate-500 mt-1">{user}</p>
                    <p className="text-xs text-slate-500">{driver}</p>
                  </div>
                  <RideStatusBadge status={status} />
                </div>

                {status === RIDE_STATUS.IN_PROGRESS ? (
                  <>
                    <div className="rounded-xl bg-slate-50 p-3 mt-3 text-xs">
                      <div className="flex justify-between mb-1">
                        <span>Khoảng cách còn lại</span>
                        <span>{distance}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Thời gian dự kiến</span>
                        <span>{eta}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Giá chuyến</span>
                        <span>{amount}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 rounded-xl border border-slate-300 py-2 text-xs">Tạm dừng</button>
                      <button className="flex-1 rounded-xl border border-yellow-300 py-2 text-xs text-yellow-700">Đổi tài xế</button>
                      <button className="flex-1 rounded-xl border border-red-300 py-2 text-xs text-red-600">Huỷ chuyến</button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs text-slate-500 mt-3">
                    <span>{status === RIDE_STATUS.REQUESTED ? "Hôm nay · 15:02" : "Hôm nay · 13:40"}</span>
                    <span>{amount}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
