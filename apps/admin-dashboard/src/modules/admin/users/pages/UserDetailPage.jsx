export function UserDetailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b flex items-center gap-3">
          <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm">‹</button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Chi tiết người dùng</h1>
            <p className="text-sm text-slate-500 mt-0.5">User Detail</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-xl">👤</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Nguyễn Văn A</p>
              <p className="text-xs text-slate-500">userA@gmail.com</p>
              <p className="text-xs text-slate-500">+84 909 123 456</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-blue-50 p-4 text-center">
              <p className="text-xs text-blue-600 mb-1">Tổng chuyến</p>
              <p className="text-2xl font-semibold text-blue-900">42</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-4 text-center">
              <p className="text-xs text-purple-600 mb-1">Tổng chi</p>
              <p className="text-2xl font-semibold text-purple-900">2.45 triệu</p>
            </div>
          </div>

          <div className="rounded-2xl border divide-y">
            {[
              ["Ngày đăng ký", "12/04/2026"],
              ["Nguồn đăng ký", "Mobile App"],
              ["Xác thực SĐT", "Đã xác thực"]
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-3 flex justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                <span className={`font-medium ${label === "Xác thực SĐT" ? "text-green-700" : ""}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">Hoạt động gần đây</p>
            {[
              ["📍 Quận 1 → Quận 3", "Hôm nay · 14:35"],
              ["📍 Bình Thạnh → Quận 1", "Hôm qua · 09:18"]
            ].map(([activity, time]) => (
              <div key={activity} className="rounded-2xl border p-4">
                <p className="text-sm">{activity}</p>
                <p className="text-xs text-slate-500 mt-1">{time}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border p-4 space-y-3">
            <p className="text-sm font-semibold">Hành động quản trị</p>
            <button className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-medium">Khóa / Mở khóa tài khoản</button>
            <button className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium">Đặt lại xác thực</button>
            <button className="w-full rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600">Khóa vĩnh viễn</button>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
