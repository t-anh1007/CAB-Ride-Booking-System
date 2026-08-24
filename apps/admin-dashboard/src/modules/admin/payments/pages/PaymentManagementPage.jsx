import { PaymentStatusBadge } from "@/components/status/PaymentStatusBadge.jsx";
import { PAYMENT_STATUS } from "@/constants/paymentStatus.js";

export function PaymentManagementPage() {
  const payments = [
    ["#PM984321", "Booking: #BK102921", "User: Trần Thị B", PAYMENT_STATUS.PAID, "💳 Ví điện tử", "62.000đ", "Hôm nay · 12:06"],
    ["#PM984310", "Booking: #BK102938", "User: Nguyễn Văn A", PAYMENT_STATUS.PENDING, "💵 Tiền mặt", "45.000đ", "Hôm nay · 14:32"],
    ["#PM984200", "Booking: #BK102910", "User: Lê Minh C", PAYMENT_STATUS.FAILED, "💳 Thẻ ngân hàng", "38.000đ", "Hôm qua · 21:18"]
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Quản lý thanh toán</h1>
          <p className="text-sm text-slate-500 mt-0.5">Payment Management</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tìm theo mã GD, booking, user…"
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-medium">Lọc</button>
          </div>

          <div className="space-y-4">
            {payments.map(([id, booking, user, status, method, amount, time]) => (
              <div key={id} className="rounded-2xl border p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold">{id}</p>
                    <p className="text-xs text-slate-500 mt-1">{booking}</p>
                    <p className="text-xs text-slate-500">{user}</p>
                  </div>
                  <PaymentStatusBadge status={status} />
                </div>

                <div className="rounded-xl bg-slate-50 p-3 mt-3 text-xs">
                  <div className="flex justify-between mb-1">
                    <span>Phương thức</span>
                    <span>{method}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Số tiền</span>
                    <span>{amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời gian</span>
                    <span>{time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
