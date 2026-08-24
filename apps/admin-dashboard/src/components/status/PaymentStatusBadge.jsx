import { PAYMENT_STATUS } from "@/constants/paymentStatus.js";

const PAYMENT_STATUS_STYLES = {
  [PAYMENT_STATUS.PENDING]: {
    className: "bg-yellow-100 text-yellow-700",
    label: "Đang xử lý"
  },
  [PAYMENT_STATUS.AUTHORIZED]: {
    className: "bg-blue-100 text-blue-700",
    label: "Đã xác thực"
  },
  [PAYMENT_STATUS.PAID]: {
    className: "bg-green-100 text-green-700",
    label: "Thành công"
  },
  [PAYMENT_STATUS.FAILED]: {
    className: "bg-red-100 text-red-700",
    label: "Thất bại"
  },
  [PAYMENT_STATUS.REFUNDED]: {
    className: "bg-purple-100 text-purple-700",
    label: "Đã hoàn tiền"
  }
};

export function PaymentStatusBadge({ status, label }) {
  const config = PAYMENT_STATUS_STYLES[status] || {
    className: "bg-slate-200 text-slate-700",
    label: status || "Unknown"
  };

  return <span className={`text-xs px-2 py-1 rounded-full ${config.className}`}>{label || config.label}</span>;
}
