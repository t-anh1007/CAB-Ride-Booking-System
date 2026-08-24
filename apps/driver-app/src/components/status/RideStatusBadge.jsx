import { RIDE_STATUS } from "@/constants/rideStatus.js";

const RIDE_STATUS_STYLES = {
  [RIDE_STATUS.REQUESTED]: {
    className: "bg-yellow-100 text-yellow-700",
    label: "Chờ xử lý"
  },
  [RIDE_STATUS.ACCEPTED]: {
    className: "bg-blue-100 text-blue-700",
    label: "Đã nhận"
  },
  [RIDE_STATUS.PICKING_UP]: {
    className: "bg-indigo-100 text-indigo-700",
    label: "Đến đón"
  },
  [RIDE_STATUS.IN_PROGRESS]: {
    className: "bg-blue-100 text-blue-700",
    label: "Đang chạy"
  },
  [RIDE_STATUS.COMPLETED]: {
    className: "bg-green-100 text-green-700",
    label: "Hoàn thành"
  },
  [RIDE_STATUS.CANCELED]: {
    className: "bg-red-100 text-red-700",
    label: "Đã hủy"
  }
};

export function RideStatusBadge({ status, label }) {
  const config = RIDE_STATUS_STYLES[status] || {
    className: "bg-slate-200 text-slate-700",
    label: status || "Unknown"
  };

  return <span className={`text-xs px-2 py-1 rounded-full ${config.className}`}>{label || config.label}</span>;
}
