import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useDriverRealtime } from "../providers/RealtimeProvider.jsx";

const amount = x => Number(typeof x?.priceSnapshot === "number" ? x.priceSnapshot : x?.priceSnapshot?.amount ?? x?.amount ?? x?.fare?.amount ?? x?.fare ?? 0);

export default function EarningsPage() {
  const { client, user } = useAuth(), { events } = useDriverRealtime(); const [rides, setRides] = useState(null), [error, setError] = useState("");
  useEffect(() => { if (user?.id) client.get("/rides/driver/" + user.id + "/history").then(x => setRides(x.data || x.rides || [])).catch(e => setError(e.message)) }, [client, user?.id]);
  const completed = events.filter(e => e.type === "ride.status.changed" && e.status === "COMPLETED"); const realtimeIncome = completed.reduce((sum, e) => sum + amount(e), 0);
  const total = useMemo(() => (rides || []).reduce((sum, x) => sum + amount(x), 0) + realtimeIncome, [rides, realtimeIncome]);
  return <main className="drv-page">
    <header className="drv-page__head"><h1>Thu nhập</h1><p className="drv-muted">Tổng hợp từ lịch sử chuyến đã hoàn thành.</p></header>
    {error && <p className="drv-alert" role="alert">Không tải được thu nhập: {error}</p>}
    {!error && rides === null && <div className="drv-sheet drv-skeleton" role="status">Đang tải thu nhập…</div>}
    {rides !== null && !error && <>
      <section className="drv-hero-card">
        <p className="drv-label">Tổng thu nhập</p>
        <p className="drv-big">{total.toLocaleString("vi-VN")}đ</p>
        <span className="drv-chip drv-chip--success">{rides.length} chuyến</span>
      </section>
      <section className="drv-sheet drv-kv">
        <div><span className="drv-muted">Từ lịch sử chuyến</span><strong>{(total - realtimeIncome).toLocaleString("vi-VN")}đ</strong></div>
        <div><span className="drv-muted">Từ sự kiện realtime</span><strong>{realtimeIncome.toLocaleString("vi-VN")}đ</strong></div>
      </section>
    </>}
  </main>;
}
