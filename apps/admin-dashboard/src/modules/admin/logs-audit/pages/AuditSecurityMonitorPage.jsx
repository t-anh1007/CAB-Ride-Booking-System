export function AuditSecurityMonitorPage() {
  const risks = [
    ["Admin đăng nhập bất thường", "Đối tượng: Admin · IP lạ", "High", "bg-red-100 text-red-700", "Phát hiện đăng nhập từ vị trí chưa từng ghi nhận.", "Hành động: Login", "Hôm nay · 15:58"],
    ["Thay đổi hệ số surge", "Đối tượng: Admin · Pricing", "Medium", "bg-yellow-100 text-yellow-700", "Admin đã điều chỉnh surge tại Quận 1 từ x1.4 → x1.8.", "Hành động: Update", "Hôm nay · 14:20"],
    ["Duyệt KYC tài xế", "Đối tượng: Driver · Trần Minh H", "Low", "bg-slate-200 text-slate-600", "Hồ sơ KYC được duyệt thành công.", "Hành động: Approve", "Hôm nay · 13:05"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Audit & bảo mật</h1>
          <p className="text-sm text-slate-500 mt-0.5">Audit / Security Monitor</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-xs text-green-700 mb-1">Trạng thái bảo mật</p>
            <p className="text-lg font-semibold text-green-900">Không phát hiện sự cố nghiêm trọng</p>
            <p className="text-xs text-green-600 mt-1">Hệ thống đang hoạt động an toàn</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">Low</p>
              <p className="text-lg font-semibold text-slate-900">124</p>
            </div>
            <div className="rounded-xl bg-yellow-50 p-3 text-center">
              <p className="text-xs text-yellow-600">Medium</p>
              <p className="text-lg font-semibold text-yellow-800">7</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-xs text-red-600">High</p>
              <p className="text-lg font-semibold text-red-800">1</p>
            </div>
          </div>

          <div className="space-y-4">
            {risks.map(([title, target, risk, riskClass, content, action, time]) => (
              <div key={title} className="rounded-2xl border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-slate-500">{target}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${riskClass}`}>{risk}</span>
                </div>

                <p className="text-sm text-slate-700">{content}</p>

                <div className="flex justify-between text-xs text-slate-500 mt-3">
                  <span>{action}</span>
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
