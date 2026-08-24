export function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl">🛠️</div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
              <p className="text-sm text-slate-500">Quản trị & vận hành hệ thống</p>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Email quản trị</label>
            <input
              type="email"
              placeholder="admin@company.com"
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="mb-8">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Mật khẩu</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Đăng nhập
          </button>

          <p className="text-xs text-slate-500 text-center mt-6">Hệ thống yêu cầu xác thực 2 lớp (MFA)</p>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
