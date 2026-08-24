import { BOOKING_STATUS } from "@/constants/bookingStatus.js";

const BOOKING_STATUS_STYLES = {
  [BOOKING_STATUS.DRAFT]: {
    className: "bg-slate-200 text-slate-700",
    label: "Nháp"
  },
  [BOOKING_STATUS.SEARCHING]: {
    className: "bg-yellow-100 text-yellow-700",
    label: "Đang xử lý"
  },
  [BOOKING_STATUS.MATCHED]: {
    className: "bg-blue-100 text-blue-700",
    label: "Đã ghép"
  },
  [BOOKING_STATUS.CONFIRMED]: {
    className: "bg-green-100 text-green-700",
    label: "Hoàn thành"
  },
  [BOOKING_STATUS.CANCELED]: {
    className: "bg-red-100 text-red-700",
    label: "Đã hủy"
  }
};

export function BookingStatusBadge({ status, label }) {
  const config = BOOKING_STATUS_STYLES[status] || {
    className: "bg-slate-200 text-slate-700",
    label: status || "Unknown"
  };

  return <span className={`text-xs px-2 py-1 rounded-full ${config.className}`}>{label || config.label}</span>;
}
