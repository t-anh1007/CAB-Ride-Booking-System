export function RefundManagementPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý hoàn tiền</h1>
          <p className="text-sm text-slate-500 mt-0.5">Refund Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo mã refund, booking, user…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">#RF320198</p>
                  <p className="text-xs text-slate-500 mt-1">Booking: #BK102921</p>
                  <p className="text-xs text-slate-500">User: Trần Thị B</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Chờ duyệt</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 mt-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Số tiền</span>
                  <span>62.000đ</span>
                </div>
                <div className="flex justify-between">
                  <span>Lý do</span>
                  <span>Huỷ chuyến do tài xế</span>
                </div>
                <div className="flex justify-between">
                  <span>Thời gian</span>
                  <span>Hôm nay · 15:10</span>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button className="flex-1 rounded-xl border border-red-300 py-2 text-xs text-red-600">Từ chối</button>
                <button className="flex-1 rounded-xl bg-slate-900 text-white py-2 text-xs">Duyệt hoàn tiền</button>
              </div>
            </div>

            {[
              ["#RF320150", "Booking: #BK102880", "User: Nguyễn Văn A", "Đã duyệt", "bg-green-100 text-green-700", "45.000đ", "Thanh toán lỗi", "Hôm qua · 10:22"],
              ["#RF320099", "Booking: #BK102750", "User: Lê Minh C", "Từ chối", "bg-red-100 text-red-700", "38.000đ", "Không đủ điều kiện", "12/04 · 18:40"]
            ].map(([id, booking, user, status, statusClass, amount, reason, time]) => (
              <div key={id} className="rounded-2xl border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold">{id}</p>
                    <p className="text-xs text-slate-500 mt-1">{booking}</p>
                    <p className="text-xs text-slate-500">{user}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 mt-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Số tiền</span>
                    <span>{amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lý do</span>
                    <span>{reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời gian</span>
                    <span>{time}</span>
                  </div>
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
