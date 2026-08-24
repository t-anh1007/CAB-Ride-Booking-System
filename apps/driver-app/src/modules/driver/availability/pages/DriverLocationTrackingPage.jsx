export function DriverLocationTrackingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Theo dõi vị trí</h1>
            <p className="text-xs text-slate-500 mt-0.5">Driver App</p>
          </div>

          <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">GPS bật</span>
        </div>

        <div className="flex-1 px-6 py-6">
          <div className="w-full h-full rounded-2xl bg-slate-200 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center mb-3 pointer-events-none">
              <div className="w-6 h-6 bg-blue-600 rounded-full border-4 border-white" />
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-blue-600 -mt-1" />
            </div>

            <div className="text-xs tracking-wide text-slate-500 select-none">MAP VIEW</div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="rounded-2xl bg-blue-50 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">📍</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Đang xác định vị trí</p>
              <p className="text-xs text-slate-600">Vị trí của bạn được cập nhật liên tục</p>
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
