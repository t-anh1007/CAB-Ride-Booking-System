export function PaymentMethodSelectionPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-[220px] bg-slate-200">
          <button className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-slate-700">
            ←
          </button>
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">MAP VIEW</div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-[520px] bg-white rounded-t-[28px] px-6 pt-5 pb-14 shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1.5 rounded-full bg-slate-300"></div>
          </div>

          <h1 className="text-lg font-semibold text-slate-900 mb-4">Chọn phương thức thanh toán</h1>

          <div className="space-y-3 mb-6">
            <div className="rounded-xl border-2 border-slate-900 bg-slate-50 px-4 py-3 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">💵</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Tiền mặt</p>
                <p className="text-xs text-slate-500">Thanh toán sau chuyến đi</p>
              </div>
              <span className="font-semibold">✓</span>
            </div>

            <div className="rounded-xl border px-4 py-3 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">💳</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Thẻ ngân hàng</p>
                <p className="text-xs text-slate-500">Visa • MasterCard</p>
              </div>
            </div>

            <div className="rounded-xl border px-4 py-3 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">📱</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Ví điện tử</p>
                <p className="text-xs text-slate-500">MoMo, ZaloPay…</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Giá chuyến đi</span>
              <span>45.000đ</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Tổng thanh toán</span>
              <span>45.000đ</span>
            </div>
          </div>

          <div className="mb-6">
            <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
              Xác nhận thanh toán
            </button>
          </div>

          <div className="h-6"></div>
        </div>
      </div>
    </div>
  );
}
