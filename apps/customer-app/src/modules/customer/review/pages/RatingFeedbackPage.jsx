export function RatingFeedbackPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-[220px] bg-slate-200">
          <button className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-slate-700">
            ✕
          </button>
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">MAP VIEW</div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-[520px] bg-white rounded-t-[28px] px-6 pt-6 pb-14 shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center mb-5">
            <div className="w-10 h-1.5 rounded-full bg-slate-300"></div>
          </div>

          <div className="flex flex-col items-center mb-5">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl">🚗</div>
            <p className="mt-3 text-sm font-semibold">Nguyễn Văn A</p>
            <p className="text-xs text-slate-500">Tài xế · 4.8⭐</p>
          </div>

          <div className="flex justify-center gap-2 mb-5 text-2xl">
            <span className="text-yellow-400">★</span>
            <span className="text-yellow-400">★</span>
            <span className="text-yellow-400">★</span>
            <span className="text-yellow-400">★</span>
            <span className="text-slate-300">★</span>
          </div>

          <div className="mb-6">
            <textarea
              rows="4"
              placeholder="Hãy chia sẻ cảm nhận của bạn về chuyến đi…"
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            ></textarea>
          </div>

          <div className="mb-6">
            <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
              Gửi đánh giá
            </button>
          </div>

          <div className="h-6"></div>
        </div>
      </div>
    </div>
  );
}
