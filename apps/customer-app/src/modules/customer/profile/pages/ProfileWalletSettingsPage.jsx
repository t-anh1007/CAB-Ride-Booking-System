export function ProfileWalletSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Tài khoản</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="rounded-2xl border p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-xl">👤</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Nguyễn Văn B</p>
              <p className="text-xs text-slate-500">0123 456 789</p>
            </div>
            <span className="text-slate-400">›</span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Ví & thanh toán</p>
              <span className="text-slate-400">›</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Số dư</span>
              <span className="font-semibold">0đ</span>
            </div>
          </div>

          <div className="rounded-2xl border divide-y">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                🔔
                <span className="text-sm">Thông báo</span>
              </div>
              <span className="text-slate-400">›</span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                🔐
                <span className="text-sm">Bảo mật</span>
              </div>
              <span className="text-slate-400">›</span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                ❓
                <span className="text-sm">Trợ giúp & hỗ trợ</span>
              </div>
              <span className="text-slate-400">›</span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                📄
                <span className="text-sm">Điều khoản & chính sách</span>
              </div>
              <span className="text-slate-400">›</span>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 p-4 flex items-center justify-center">
            <span className="text-sm font-medium text-red-600">Đăng xuất</span>
          </div>
        </div>

        <div className="h-6"></div>
      </div>
    </div>
  );
}
