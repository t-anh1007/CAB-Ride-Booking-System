export function NotificationCenterPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Thông báo</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-6">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                ✅
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Chuyến đi hoàn thành</p>
                <p className="text-xs text-slate-500 mt-1">
                  Chuyến đi đến Vincom Đồng Khởi đã hoàn thành. Tổng tiền 45.000đ.
                </p>
                <p className="text-[11px] text-slate-400 mt-2">2 phút trước</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">💳</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Thanh toán thành công</p>
                <p className="text-xs text-slate-500 mt-1">Bạn đã thanh toán thành công chuyến đi bằng tiền mặt.</p>
                <p className="text-[11px] text-slate-400 mt-2">Hôm nay · 14:36</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">⭐</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Đánh giá tài xế</p>
                <p className="text-xs text-slate-500 mt-1">Cảm ơn bạn đã đánh giá tài xế Nguyễn Văn A.</p>
                <p className="text-[11px] text-slate-400 mt-2">Hôm nay · 14:40</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">🎁</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Ưu đãi mới dành cho bạn</p>
                <p className="text-xs text-slate-500 mt-1">Nhận ngay ưu đãi 20% cho chuyến đi tiếp theo.</p>
                <p className="text-[11px] text-slate-400 mt-2">12/04 · 09:00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
