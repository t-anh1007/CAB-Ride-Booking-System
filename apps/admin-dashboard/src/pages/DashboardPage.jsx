import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useAdminRealtime } from "../providers/RealtimeProvider.jsx";
import { Chip, DemoNote, Icon, Panel } from "../components/ui.jsx";
import OpsMap from "../components/OpsMap.jsx";
import { demoAudit, demoDrivers, demoKpis, demoRides, demoZones, formatVnd } from "../data/demo.js";

const today = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const hhmm = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };

export default function DashboardPage() {
  const { client } = useAuth();
  const { events } = useAdminRealtime();
  const [stats, setStats] = useState(null); const [available, setAvailable] = useState(null); const [error, setError] = useState("");
  const [audit, setAudit] = useState(null); const [reload, setReload] = useState(0);
  useEffect(() => { let active = true; setError(""); Promise.all([client.get("/rides/stats"), client.get("/drivers/available")]).then(([rideResult, driverResult]) => { if (!active) return; setStats(rideResult.data || rideResult); const payload = driverResult.data || driverResult; setAvailable((payload.drivers || payload.items || payload || []).length); }).catch((event) => active && setError(event.message)); return () => { active = false; }; }, [client, reload]);
  useEffect(() => { let active = true; client.get("/auth/admin/audit?limit=5").then((result) => { const payload = result.data || result; if (active) setAudit(payload.items || []); }).catch(() => active && setAudit([])); return () => { active = false; }; }, [client, reload]);

  const live = useMemo(() => { const byId = new Map(); events.filter((e) => e.type === "driver.location.updated").forEach((e) => { const id = e.driverId || e.driver_id; const lat = Number(e.lat ?? e.latitude); const lng = Number(e.lng ?? e.longitude); if (id && Number.isFinite(lat) && Number.isFinite(lng)) byId.set(id, { ...e, id, lat, lng }); }); return [...byId.values()]; }, [events]);
  const loading = !error && !stats;
  const kpis = demoKpis.map((k) => {
    if (k.key === "rides" && stats) return { ...k, value: stats.totalRides ?? 0, delta: stats.deltas?.rides, real: true };
    if (k.key === "drivers" && available != null) return { ...k, value: available, delta: stats?.deltas?.drivers, real: true };
    if ((k.key === "rides" || k.key === "drivers") && loading) return { ...k, pending: true };
    return { ...k, demo: true };
  });
  const auditRows = audit?.length ? audit.map((a) => ({ ...a, actor: a.actor || a.actorType || a.accountId?.slice?.(0, 8) || "System" })) : demoAudit;
  const statusRows = Object.entries(stats?.byStatus || {});

  return <section className="ad-page">
    <div className="ad-toolbar">
      <div className="ad-toolbar__group">
        <button type="button" className="ad-filter is-active"><Icon name="calendar" size={16} />Hôm nay</button>
        <label className="ad-select"><select aria-label="Ngày" defaultValue={today}><option>{today}</option></select><Icon name="chevron" size={16} /></label>
      </div>
      <div className="ad-toolbar__group">
        <label className="ad-select"><select aria-label="Khu vực" defaultValue="all"><option value="all">Tất cả khu vực</option><option value="central">Trung tâm</option></select><Icon name="chevron" size={16} /></label>
        <button type="button" className="ad-iconbtn ad-iconbtn--light" onClick={() => setReload((x) => x + 1)} aria-label="Làm mới"><Icon name="refresh" size={18} /></button>
      </div>
    </div>
    {error && <DemoNote>Không kết nối được hệ thống ({error}) — chỉ số có nhãn “minh họa” là dữ liệu mẫu.</DemoNote>}

    <div className="ad-kpis">{kpis.map((k) => <article key={k.key} className="ad-kpi">
      <p>{k.label}{k.demo && <span className="ad-tag">minh họa</span>}</p>
      {k.pending ? <span className="ad-skeleton" /> : <strong>{k.money ? formatVnd(k.value) : Number(k.value).toLocaleString("vi-VN")}</strong>}
      {k.pending ? <span className="ad-delta ad-delta--muted">Đang tải…</span> : k.delta != null ? <span className="ad-delta"><Icon name="arrowUp" size={13} />{k.delta}% so với hôm qua</span> : <span className="ad-delta ad-delta--muted">Dữ liệu trực tiếp</span>}
    </article>)}</div>

    <Panel title="Bản đồ trực tiếp" action={<Link className="ad-link" to="/map">Mở rộng</Link>}>
      <OpsMap zones={demoZones} drivers={live.length ? live : demoDrivers} />
    </Panel>

    <div className="ad-split">
      <Panel title="Chuyến xe gần đây" action={<Link className="ad-link" to="/rides">Xem tất cả</Link>}>
        <div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>Mã chuyến</th><th>Thời gian</th><th>Điểm đón</th><th>Điểm đến</th><th>Giá tiền</th><th>Trạng thái</th></tr></thead><tbody>
          {demoRides.map((r) => <tr key={r.id}><td className="ad-mono">{r.id}</td><td>{r.time}</td><td>{r.from}</td><td>{r.to}</td><td>{formatVnd(r.fare)}</td><td><Chip status={r.status} /></td></tr>)}
        </tbody></table></div>
        <p className="ad-foot">Minh họa — gateway chưa có endpoint danh sách chuyến.{statusRows.length > 0 && <> Thực tế: {statusRows.map(([s, c]) => `${s} ${c}`).join(" · ")}</>}</p>
      </Panel>
      <Panel title="Nhật ký kiểm toán" action={<Link className="ad-link" to="/audit">Xem tất cả</Link>}>
        <ul className="ad-log">{auditRows.slice(0, 5).map((a) => <li key={a.id}><time>{hhmm(a.createdAt)}</time><b>{a.actor}</b><span>{a.eventType}</span><i className={`ad-dot ad-dot--${/fail|error/i.test(a.eventStatus) ? "danger" : /warn/i.test(a.eventStatus) ? "warning" : "success"}`} /></li>)}</ul>
        {!audit?.length && <p className="ad-foot">Minh họa — chưa nhận được sự kiện audit.</p>}
      </Panel>
    </div>
  </section>;
}
