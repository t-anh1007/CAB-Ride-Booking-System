export function NotificationLogsPage() {
  const logs = [
    ["Thông báo cuốc xe mới", "Đối tượng: Driver · Trần Minh H", "Đã gửi", "bg-green-100 text-green-700", "Bạn có cuốc xe mới trong khu vực gần.", "Loại: Booking", "Hôm nay · 15:45"],
    ["Thanh toán thất bại", "Đối tượng: User · Nguyễn Văn A", "Thất bại", "bg-red-100 text-red-700", "Giao dịch của bạn không thành công. Vui lòng thử lại.", "Loại: Payment", "Hôm nay · 14:12"],
    ["Khuyến mãi cuối tuần", "Đối tượng: User · Toàn hệ thống", "Đã lên lịch", "bg-yellow-100 text-yellow-700", "Nhận ưu đãi 20% cho chuyến đi cuối tuần này.", "Loại: Promotion", "Ngày mai · 08:00"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Log thông báo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Notification Logs</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo nội dung, đối tượng…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            {logs.map(([title, target, status, statusClass, content, type, time]) => (
              <div key={title} className="rounded-2xl border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-slate-500">{target}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                </div>

                <p className="text-sm text-slate-700">{content}</p>

                <div className="flex justify-between text-xs text-slate-500 mt-3">
                  <span>{type}</span>
                  <span>{time}</span>
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
