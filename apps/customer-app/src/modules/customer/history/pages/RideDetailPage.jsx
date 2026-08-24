export function RideDetailPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-[220px] bg-slate-200">
          <button className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-slate-700">
            ←
          </button>
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">MAP VIEW</div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-[560px] bg-white rounded-t-[28px] px-6 pt-6 pb-14 shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center mb-5">
            <div className="w-10 h-1.5 rounded-full bg-slate-300"></div>
          </div>

          <div className="mb-4">
            <h1 className="text-lg font-semibold text-slate-900">Chi tiết chuyến đi</h1>
            <p className="text-xs text-slate-500 mt-0.5">Hoàn thành · Hôm nay, 14:35</p>
          </div>

          <div className="rounded-2xl border p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="text-green-600">●</span>
                <span className="h-6 border-l border-dashed border-slate-300"></span>
                <span className="text-red-500">●</span>
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">Điểm đón</p>
                <p className="text-slate-500 mb-2">Vị trí hiện tại của bạn</p>
                <p className="font-medium">Điểm đến</p>
                <p className="text-slate-500">Vincom Đồng Khởi, Quận 1</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4 mb-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">🚗</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Nguyễn Văn A</p>
              <p className="text-xs text-slate-500">⭐ 4.8 · 1.240 chuyến</p>
            </div>
            <div className="text-xs text-slate-500 text-right">
              Biển số
              <br />
              <span className="text-sm font-medium text-slate-900">59A‑123.45</span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span>Phương thức</span>
              <span className="font-medium">💵 Tiền mặt</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tổng thanh toán</span>
              <span className="font-semibold">45.000đ</span>
            </div>
          </div>

          <div className="mb-6">
            <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
              Gửi phản hồi
            </button>
          </div>

          <div className="h-6"></div>
        </div>
      </div>
    </div>
  );
}
