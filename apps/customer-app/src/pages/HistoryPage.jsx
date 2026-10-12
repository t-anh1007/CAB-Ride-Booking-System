import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Icon } from "../components/Icons.jsx";

const labels = { PENDING: "Đang chờ", MATCHING: "Đang tìm tài xế", ASSIGNED: "Đã ghép tài xế", CANCELLED: "Đã hủy", COMPLETED: "Hoàn thành" };
const tones = { PENDING: "cx-chip--warning", MATCHING: "cx-chip--progress", ASSIGNED: "cx-chip--progress", CANCELLED: "cx-chip--danger", COMPLETED: "cx-chip--success" };

export default function HistoryPage() {
  const { client, user } = useAuth();
  const [items, setItems] = useState(null), [error, setError] = useState(""), [dateFilter, setDateFilter] = useState(""), [statusFilter, setStatusFilter] = useState("ALL");
  useEffect(() => { if (user?.id) client.get("/bookings?user_id=" + encodeURIComponent(user.id)).then((x) => setItems(x.data || x.bookings || [])).catch((e) => setError(e.message)); }, [client, user?.id]);
  const rows = useMemo(() => (items || []).filter((x) => (statusFilter === "ALL" || x.status === statusFilter) && (!dateFilter || String(x.createdAt || x.created_at || "").startsWith(dateFilter))), [items, statusFilter, dateFilter]);
  return <main className="cx-page">
    <header className="cx-page-head"><h1>Hoạt động</h1></header>
    <div className="cx-filters">
      <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} aria-label="Lọc ngày" />
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Lọc trạng thái"><option value="ALL">Mọi trạng thái</option><option value="COMPLETED">Hoàn thành</option><option value="CANCELLED">Đã hủy</option></select>
    </div>
    {error && <p className="cx-alert" role="alert">Không tải được lịch sử: {error}</p>}
    {!error && items === null && <div className="cx-card cx-skeleton" role="status"><span /><span /><span /><p className="cx-empty-text">Đang tải lịch sử chuyến đi…</p></div>}
    {items !== null && !rows.length && !error && <div className="cx-card cx-empty"><Icon name="activity" size={28} /><p>Chưa có chuyến đi nào phù hợp.</p></div>}
    <div className="cx-stack">
      {rows.map((x) => <article className="cx-card cx-trip" key={x.id || x.booking_id}>
        <span className="cx-list-icon"><Icon name="pin" size={18} /></span>
        <span className="cx-trip-main"><strong>{x.destinationAddress || x.drop?.label || "Chuyến đi CAB"}</strong><small>{x.createdAt || x.created_at || "—"}</small></span>
        <span className="cx-trip-side"><strong>{Number(x.priceSnapshot?.amount ?? x.priceSnapshot ?? x.amount ?? 0).toLocaleString()} đ</strong><span className={`cx-chip ${tones[x.status] || "cx-chip--neutral"}`}>{labels[x.status] || x.status}</span></span>
      </article>)}
    </div>
  </main>;
}
