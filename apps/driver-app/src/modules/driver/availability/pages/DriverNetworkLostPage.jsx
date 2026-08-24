export function DriverNetworkLostPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-3xl mb-6">📶</div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Mất kết nối mạng</h1>

          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Kết nối Internet hoặc hệ thống
            <br />
            đang bị gián đoạn.
            <br />
            Ứng dụng sẽ không nhận cuốc trong thời gian này.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left w-full mb-6">
            <p className="text-xs text-slate-600 mb-2">Vui lòng kiểm tra:</p>
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              <li>Kết nối Wi-Fi hoặc 4G/5G</li>
              <li>Chế độ máy bay đã tắt</li>
              <li>GPS vẫn đang hoạt động</li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Thử kết nối lại
          </button>

          <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
            Thoát tạm thời
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
