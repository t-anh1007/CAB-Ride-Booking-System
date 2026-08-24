export function BulkActionResultPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
            <h1 className="text-xl font-semibold text-slate-900">Hoàn tất thao tác hàng loạt</h1>
            <p className="text-sm text-slate-500 mt-1">Bulk action đã được xử lý</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Tổng</p>
              <p className="text-lg font-semibold text-slate-900">120</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-xs text-green-600">Thành công</p>
              <p className="text-lg font-semibold text-green-800">112</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-600">Thất bại</p>
              <p className="text-lg font-semibold text-red-800">8</p>
            </div>
          </div>

          <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-700">
            112 mục đã được xử lý thành công và cập nhật vào hệ thống.
          </div>

          <div className="rounded-2xl border p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-900">Mục xử lý thất bại</p>
            <div className="text-xs text-slate-600 space-y-2">
              {[
                ["#DRV10231", "Thiếu giấy tờ KYC"],
                ["#DRV10288", "Dữ liệu không hợp lệ"],
                ["#DRV10305", "Trạng thái đã thay đổi"]
              ].map(([id, reason]) => (
                <div key={id} className="flex justify-between">
                  <span>{id}</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Quay lại danh sách
          </button>

          <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
            Xuất báo cáo lỗi
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
