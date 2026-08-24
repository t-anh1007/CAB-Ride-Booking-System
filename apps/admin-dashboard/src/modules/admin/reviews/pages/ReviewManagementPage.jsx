export function ReviewManagementPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý đánh giá</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo user, driver, nội dung…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold">Driver: Trần Minh H</p>
                  <p className="text-xs text-slate-500">User: Nguyễn Văn A · #BK102921</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Bình thường</span>
              </div>

              <div className="flex items-center gap-1 text-yellow-400 text-sm mb-2">★ ★ ★ ★ ★</div>
              <p className="text-sm text-slate-700">Tài xế thân thiện, chạy xe an toàn và đúng giờ.</p>

              <div className="flex justify-between text-xs text-slate-500 mt-3">
                <span>Hôm nay · 14:40</span>
                <span>Hành động ›</span>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold">Driver: Lê Quốc P</p>
                  <p className="text-xs text-slate-500">User: Trần Thị B · #BK102880</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Bị gắn cờ</span>
              </div>

              <div className="flex items-center gap-1 text-yellow-400 text-sm mb-2">★ ★ ☆ ☆ ☆</div>
              <p className="text-sm text-slate-700">Thái độ không tốt, đến trễ và không xin lỗi.</p>

              <div className="flex gap-2 mt-3">
                <button className="flex-1 rounded-xl border border-red-300 py-2 text-xs text-red-600">Gỡ đánh giá</button>
                <button className="flex-1 rounded-xl bg-slate-900 text-white py-2 text-xs">Giữ & theo dõi</button>
              </div>
            </div>

            <div className="rounded-2xl border p-4 opacity-70">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold">Driver: Nguyễn Văn T</p>
                  <p className="text-xs text-slate-500">User: Lê Minh C · #BK102750</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Đã gỡ</span>
              </div>

              <div className="flex items-center gap-1 text-yellow-400 text-sm mb-2">★ ☆ ☆ ☆ ☆</div>
              <p className="text-sm text-slate-700">Nội dung vi phạm chính sách cộng đồng.</p>

              <div className="flex gap-2 mt-3">
                <button className="flex-1 rounded-xl border border-slate-300 py-2 text-xs">Khôi phục</button>
              </div>
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
