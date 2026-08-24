export function AdminAccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-3xl mb-6">🚫</div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Truy cập bị từ chối</h1>

          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Bạn không có quyền truy cập vào
            <br />
            chức năng hoặc tài nguyên này.
            <br />
            Vui lòng liên hệ quản trị viên để được cấp quyền.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left w-full mb-6">
            <p className="text-xs text-slate-600 mb-2">Nguyên nhân có thể:</p>
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              <li>Vai trò (role) không đủ quyền</li>
              <li>Chính sách truy cập (policy) bị giới hạn</li>
              <li>Tài khoản đang bị kiểm soát</li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Quay lại Dashboard
          </button>

          <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
            Liên hệ quản trị viên
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
