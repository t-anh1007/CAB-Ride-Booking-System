export function UserManagementPage() {
  const users = [
    ["Nguyễn Văn A", "userA@gmail.com", "Active", "bg-green-100 text-green-700", "Đăng ký: 12/04/2026", "bg-blue-100"],
    ["Trần Thị B", "0909 123 456", "Đã khóa", "bg-yellow-100 text-yellow-700", "Đăng ký: 05/03/2026", "bg-purple-100"],
    ["Lê Minh C", "leminhc@company.com", "Suspended", "bg-red-100 text-red-700", "Đăng ký: 18/02/2026", "bg-slate-200"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý người dùng</h1>
          <p className="text-sm text-slate-500 mt-0.5">User Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo tên, email, SĐT…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            {users.map(([name, contact, status, statusClass, registeredAt, avatarClass]) => (
              <div key={name} className="rounded-2xl border p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${avatarClass} flex items-center justify-center`}>👤</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-slate-500">{contact}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                </div>

                <div className="flex justify-between text-xs text-slate-500 mt-3">
                  <span>{registeredAt}</span>
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
