export function DriverManagementPage() {
  const drivers = [
    ["Nguyễn Văn T", "59A-123.45 · Car", ["Online", "bg-green-100 text-green-700"], ["KYC OK", "bg-blue-100 text-blue-700"], "Tham gia: 02/01/2026", "bg-green-100", "🚗"],
    ["Trần Minh H", "59B-678.90 · Bike", ["Offline", "bg-slate-200 text-slate-600"], ["Chờ KYC", "bg-yellow-100 text-yellow-700"], "Tham gia: 18/03/2026", "bg-yellow-100", "🛵"],
    ["Lê Quốc P", "51C-999.99 · Car", ["Offline", "bg-slate-200 text-slate-600"], ["Bị khóa", "bg-red-100 text-red-700"], "Tham gia: 11/11/2025", "bg-red-100", "🚗"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý tài xế</h1>
          <p className="text-sm text-slate-500 mt-0.5">Driver Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, biển số…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            {drivers.map(([name, vehicle, primaryStatus, kycStatus, joinedAt, avatarClass, icon]) => (
              <div key={name} className="rounded-2xl border p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${avatarClass} flex items-center justify-center`}>{icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-slate-500">{vehicle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${primaryStatus[1]}`}>{primaryStatus[0]}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${kycStatus[1]}`}>{kycStatus[0]}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-slate-500 mt-3">
                  <span>{joinedAt}</span>
                  <span>Xem chi tiết ›</span>
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
