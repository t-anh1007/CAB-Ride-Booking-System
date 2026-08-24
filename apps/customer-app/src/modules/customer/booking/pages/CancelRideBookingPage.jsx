export function CancelRideBookingPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-[240px] bg-slate-200">
          <button className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-slate-700">
            ✕
          </button>

          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">MAP VIEW</div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-[460px] bg-white rounded-t-[28px] px-6 pt-5 pb-12 shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1.5 rounded-full bg-slate-300"></div>
          </div>

          <h1 className="text-lg font-semibold text-slate-900 mb-2">Huỷ chuyến đi</h1>

          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">⚠️</div>
            <div>
              <p className="text-sm font-semibold">Bạn có chắc muốn huỷ chuyến?</p>
              <p className="text-xs text-slate-500 mt-1">Việc huỷ chuyến có thể ảnh hưởng đến tài khoản của bạn</p>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
              <input type="radio" className="accent-slate-900" />
              <span className="text-sm">Tôi đổi ý, không đi nữa</span>
            </label>

            <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
              <input type="radio" className="accent-slate-900" />
              <span className="text-sm">Tài xế đến quá lâu</span>
            </label>

            <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
              <input type="radio" className="accent-slate-900" />
              <span className="text-sm">Chọn nhầm điểm đón / điểm đến</span>
            </label>

            <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
              <input type="radio" className="accent-slate-900" />
              <span className="text-sm">Lý do khác</span>
            </label>
          </div>

          <div className="flex gap-3 mt-2 mb-6">
            <button className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700">
              Giữ chuyến
            </button>
            <button className="flex-1 rounded-xl border border-red-500 py-3 text-sm font-medium text-red-600">
              Huỷ chuyến
            </button>
          </div>

          <div className="h-6"></div>
        </div>
      </div>
    </div>
  );
}
