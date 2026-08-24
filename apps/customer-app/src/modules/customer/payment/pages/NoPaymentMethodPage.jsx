export function NoPaymentMethodPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center text-3xl mb-6">
            💳
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">Chưa có phương thức thanh toán</h1>

          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Để hoàn tất chuyến đi, bạn cần
            <br />
            thêm phương thức thanh toán hợp lệ
            <br />
            hoặc nạp tiền vào ví.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 text-left w-full mb-6">
            <p className="text-xs text-slate-600 mb-2">Bạn có thể thêm:</p>
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              <li>Thẻ ngân hàng (Visa, MasterCard)</li>
              <li>Ví điện tử (MoMo, ZaloPay…)</li>
              <li>Hoặc sử dụng tiền mặt (nếu được hỗ trợ)</li>
            </ul>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
            Thêm phương thức thanh toán
          </button>
          <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
            Quay lại
          </button>
        </div>

        <div className="h-6"></div>
      </div>
    </div>
  );
}
