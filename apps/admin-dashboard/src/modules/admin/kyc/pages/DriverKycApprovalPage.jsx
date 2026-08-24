export function DriverKycApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b flex items-center gap-3">
          <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm">‹</button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Duyệt hồ sơ KYC</h1>
            <p className="text-sm text-slate-500 mt-0.5">Driver KYC Approval</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-xl">🚗</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Trần Minh H</p>
              <p className="text-xs text-slate-500">0909 123 456</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Chờ duyệt</span>
          </div>

          <div className="rounded-2xl border divide-y">
            <div className="px-4 py-3 text-sm font-semibold">Giấy tờ cá nhân</div>
            <div className="px-4 py-3 flex justify-between text-sm">
              <span>CMND / CCCD</span>
              <span className="text-green-700 font-medium">Đã gửi</span>
            </div>
            <div className="px-4 py-3 flex justify-between text-sm">
              <span>Giấy phép lái xe</span>
              <span className="text-green-700 font-medium">Đã gửi</span>
            </div>
          </div>

          <div className="rounded-2xl border divide-y">
            <div className="px-4 py-3 text-sm font-semibold">Thông tin xe</div>
            <div className="px-4 py-3 flex justify-between text-sm">
              <span>Loại xe</span>
              <span className="font-medium">🛵 Bike</span>
            </div>
            <div className="px-4 py-3 flex justify-between text-sm">
              <span>Biển số</span>
              <span className="font-medium">59B-678.90</span>
            </div>
            <div className="px-4 py-3 flex justify-between text-sm">
              <span>Đăng ký xe</span>
              <span className="text-green-700 font-medium">Đã gửi</span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold mb-2">Ghi chú nội bộ</p>
            <textarea
              rows="3"
              placeholder="Nhập ghi chú cho quyết định duyệt / từ chối…"
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex gap-3">
            <button className="flex-1 rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600">Từ chối</button>
            <button className="flex-1 rounded-xl bg-slate-900 text-white py-3 text-sm font-medium">Duyệt hồ sơ</button>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
