import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";

const amount = x => typeof x?.priceSnapshot === "number" ? x.priceSnapshot : x?.priceSnapshot?.amount ?? x?.amount ?? x?.fare?.amount ?? x?.fare ?? "—";
const labels = { ASSIGNED: "Đã nhận", ACCEPTED: "Đang đến điểm đón", IN_PROGRESS: "Đang chạy", COMPLETED: "Hoàn thành" };
const tones = { ASSIGNED: "pending", ACCEPTED: "progress", IN_PROGRESS: "going", COMPLETED: "done", CANCELLED: "cancel" };

export default function DriverHistoryPage() {
  const { client, user } = useAuth(); const [rides, setRides] = useState(null), [error, setError] = useState("");
  useEffect(() => { if (user?.id) client.get("/rides/driver/" + user.id + "/history").then(x => setRides(x.data || x.rides || [])).catch(e => setError(e.message)) }, [client, user?.id]);
  return <main className="drv-page">
    <header className="drv-page__head"><h1>Hoạt động</h1><p className="drv-muted">Lịch sử chuyến đi của bạn.</p></header>
    {error && <p className="drv-alert" role="alert">Không tải được lịch sử: {error}</p>}
    {!error && rides === null && <div className="drv-sheet drv-skeleton" role="status">Đang tải lịch sử chuyến đi…</div>}
    <ul className="drv-list">
      {(rides || []).map(x => { const v = amount(x); return <li className="drv-sheet drv-list__item" key={x.rideId || x.ride_id || x.id}>
        <div><strong>Chuyến #{String(x.rideId || x.ride_id || x.id || "").slice(0, 8)}</strong><span className={`drv-chip drv-chip--${tones[x.status] || "pending"}`}>{labels[x.status] || x.status}</span></div>
        <strong className="drv-list__amount">{typeof v === "number" ? v.toLocaleString("vi-VN") : v}đ</strong>
      </li>; })}
    </ul>
    {rides !== null && !rides.length && !error && <div className="drv-sheet drv-empty"><strong>Chưa có chuyến đi</strong><p className="drv-muted">Bật “Đang hoạt động” ở Trang chủ để bắt đầu nhận chuyến.</p></div>}
  </main>;
}
