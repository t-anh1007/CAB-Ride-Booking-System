import { PaymentStatusBadge } from "@/components/status/PaymentStatusBadge.jsx";
import { PAYMENT_STATUS } from "@/constants/paymentStatus.js";

export function PaymentResultPage() {
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
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-3xl">✅</div>
            <div className="mt-4">
              <PaymentStatusBadge status={PAYMENT_STATUS.PAID} />
            </div>
            <h1 className="text-lg font-semibold mt-3">Thanh toán thành công</h1>
            <p className="text-sm text-slate-500 mt-1 text-center">Cảm ơn bạn đã sử dụng dịch vụ</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Phương thức</span>
              <span>💵 Tiền mặt</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Mã giao dịch</span>
              <span>#CB123456</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
              <span>Tổng thanh toán</span>
              <span>45.000đ</span>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <button className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-medium active:scale-[0.98]">
              Đánh giá chuyến đi
            </button>
            <button className="w-full rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-700 active:scale-[0.98]">
              Xem lịch sử chuyến đi
            </button>
          </div>

          <div className="h-6"></div>
        </div>
      </div>
    </div>
  );
}
