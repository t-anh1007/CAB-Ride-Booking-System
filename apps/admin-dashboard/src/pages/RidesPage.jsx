import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Chip, DemoNote, Loading, PageHead, Panel } from "../components/ui.jsx";
import { demoRides, formatVnd } from "../data/demo.js";

export default function RidesPage() {
  const { client } = useAuth(); const [stats, setStats] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; client.get("/rides/stats").then((result) => active && setStats(result.data || result)).catch((event) => active && setError(event.message)); return () => { active = false; }; }, [client]);
  const byStatus = Object.entries(stats?.byStatus || {});
  return <section className="ad-page">
    <PageHead eyebrow="CHUYẾN XE" title="Tóm tắt vận hành" />
    {error && <DemoNote>Không tải được thống kê ({error}). Bảng dưới là dữ liệu minh họa.</DemoNote>}
    {!error && !stats && <Loading text="Đang tổng hợp dữ liệu chuyến đi…" />}
    {stats && <div className="ad-kpis">
      <article className="ad-kpi"><p>Tổng số chuyến</p><strong>{Number(stats.totalRides ?? 0).toLocaleString("vi-VN")}</strong><span className="ad-delta ad-delta--muted">Aggregate · chỉ đọc</span></article>
      {byStatus.slice(0, 3).map(([status, count]) => <article className="ad-kpi" key={status}><p>{status}</p><strong>{count}</strong><Chip status={status} /></article>)}
    </div>}
    {stats && <Panel title="Phân bố trạng thái chuyến đi">
      <div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>Trạng thái</th><th>Số chuyến</th></tr></thead><tbody>
        {!byStatus.length && <tr><td colSpan="2" className="ad-empty">Chưa có chuyến đi.</td></tr>}
        {byStatus.map(([status, count]) => <tr key={status}><td><Chip status={status} /></td><td>{count}</td></tr>)}
      </tbody></table></div>
      <p className="ad-foot">Danh sách từng chuyến chưa có endpoint GET /rides công khai, nên CAB không hiển thị dữ liệu giả.</p>
    </Panel>}
    {error && <Panel title="Chuyến xe gần đây (minh họa)">
      <div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>Mã chuyến</th><th>Thời gian</th><th>Điểm đón</th><th>Điểm đến</th><th>Giá tiền</th><th>Trạng thái</th></tr></thead><tbody>
        {demoRides.map((r) => <tr key={r.id}><td className="ad-mono">{r.id}</td><td>{r.time}</td><td>{r.from}</td><td>{r.to}</td><td>{formatVnd(r.fare)}</td><td><Chip status={r.status} /></td></tr>)}
      </tbody></table></div>
    </Panel>}
  </section>;
}
