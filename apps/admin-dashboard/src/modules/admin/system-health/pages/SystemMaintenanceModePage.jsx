export function SystemMaintenanceModePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-3xl mb-6">🛠️</div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Hệ thống đang bảo trì</h1>

          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Admin Dashboard tạm thời không khả dụng
            <br />
            để thực hiện bảo trì hệ thống.
            <br />
            Vui lòng quay lại sau khi bảo trì hoàn tất.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left w-full mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Trạng thái</span>
              <span className="font-medium text-orange-700">Maintenance</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Bắt đầu</span>
              <span className="font-medium">22:00 · 18/04/2026</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Dự kiến hoàn tất</span>
              <span className="font-medium">01:00 · 19/04/2026</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Làm mới trạng thái
          </button>
          <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
            Đăng xuất Admin
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
