export function PricingSurgeMonitorPage() {
  const areas = [
    ["Quận 1", "Surge", "bg-red-100 text-red-700", "x1.8", "text-red-700", "Tắt surge", "border-red-300 text-red-600"],
    ["Bình Thạnh", "Cao", "bg-yellow-100 text-yellow-700", "x1.4", "text-yellow-700", "Giảm surge", "border-yellow-300 text-yellow-700"],
    ["Tân Bình", "Bình thường", "bg-green-100 text-green-700", "x1.0", "text-green-700", "Bật surge", "border-slate-300 text-slate-700"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Giá & Surge</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pricing / Surge Monitor</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700 mb-1">Trạng thái hiện tại</p>
            <p className="text-lg font-semibold text-yellow-900">Surge đang hoạt động tại 3 khu vực</p>
          </div>

          <div className="space-y-4">
            {areas.map(([name, status, statusClass, multiplier, multiplierClass, actionLabel, actionClass]) => (
              <div key={name} className="rounded-2xl border p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold">{name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                </div>

                <div className="flex justify-between text-sm mb-3">
                  <span>Hệ số giá</span>
                  <span className={`font-semibold ${multiplierClass}`}>{multiplier}</span>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 rounded-xl bg-slate-100 py-2 text-sm">−</button>
                  <button className="flex-1 rounded-xl bg-slate-900 text-white py-2 text-sm">+</button>
                  <button className={`flex-1 rounded-xl border py-2 text-sm ${actionClass}`}>{actionLabel}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            Việc điều chỉnh surge ảnh hưởng trực tiếp đến giá chuyến đi và tỷ lệ nhận cuốc của tài xế.
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
