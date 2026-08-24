export function NetworkServiceErrorPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-3xl mb-6">
            📡
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Không thể kết nối</h1>

          <p className="text-sm text-slate-500 leading-relaxed">
            Kết nối mạng hoặc dịch vụ hiện không khả dụng.
            <br />
            Vui lòng kiểm tra internet và thử lại sau.
          </p>
        </div>

        <div className="px-6 pb-8">
          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Thử lại
          </button>
        </div>

        <div className="h-6"></div>
      </div>
    </div>
  );
}
