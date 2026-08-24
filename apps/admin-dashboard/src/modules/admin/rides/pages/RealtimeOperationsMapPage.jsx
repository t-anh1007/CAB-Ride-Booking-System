export function RealtimeOperationsMapPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Bản đồ vận hành</h1>
          <p className="text-sm text-slate-500 mt-0.5">Realtime Operations</p>
        </div>

        <div className="flex-1 px-6 py-6">
          <div className="w-full h-full rounded-2xl bg-slate-200 relative flex items-center justify-center">
            <div className="absolute top-1/3 left-1/3 flex flex-col items-center">
              <div className="w-4 h-4 bg-green-600 rounded-full border-2 border-white" />
            </div>
            <div className="absolute top-1/2 right-1/3 flex flex-col items-center">
              <div className="w-4 h-4 bg-green-600 rounded-full border-2 border-white" />
            </div>
            <div className="absolute bottom-1/3 left-1/2 flex flex-col items-center">
              <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">MAP VIEW</div>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-green-50 p-3 text-center">
              <p className="text-xs text-green-600">Driver online</p>
              <p className="text-lg font-semibold text-green-800">86</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600">Ride active</p>
              <p className="text-lg font-semibold text-blue-800">42</p>
            </div>
            <div className="rounded-xl bg-yellow-50 p-3 text-center">
              <p className="text-xs text-yellow-600">Chờ xử lý</p>
              <p className="text-lg font-semibold text-yellow-800">17</p>
            </div>
          </div>

          <div className="rounded-2xl border p-4 text-sm space-y-2">
            {[
              ["bg-green-600", "Driver đang online"],
              ["bg-blue-600", "Chuyến đang chạy"],
              ["bg-yellow-500", "Booking chờ xử lý"]
            ].map(([colorClass, label]) => (
              <div key={label} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${colorClass}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
