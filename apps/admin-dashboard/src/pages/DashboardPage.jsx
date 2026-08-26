import { useEffect, useState } from "react";
import { StatusChip, SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import DataState from "../components/DataState.jsx";

export default function DashboardPage() {
  const { client } = useAuth(); const [stats, setStats] = useState(null); const [available, setAvailable] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; Promise.all([client.get("/rides/stats"), client.get("/drivers/available")]).then(([rideResult, driverResult]) => { if (!active) return; setStats(rideResult.data || rideResult); const payload = driverResult.data || driverResult; setAvailable((payload.drivers || payload.items || payload || []).length); }).catch((event) => active && setError(event.message)); return () => { active = false; }; }, [client]);
  return <section className="page cab-admin-page"><p className="cab-eyebrow">TRUNG TÂM VẬN HÀNH</p><h1>Tổng quan hôm nay</h1>{error ? <DataState error={error} /> : null}{!error && !stats ? <SurfaceState kind="loading" detail="Đang lấy chỉ số vận hành từ hệ thống." /> : null}{stats ? <><div className="cab-kpi-grid"><article className="card"><p className="muted">Tổng chuyến</p><strong>{stats.totalRides ?? 0}</strong><StatusChip tone="success">Dữ liệu trực tiếp</StatusChip></article><article className="card"><p className="muted">Tài xế khả dụng</p><strong>{available ?? "—"}</strong><StatusChip tone="progress">Đang trực tuyến</StatusChip></article></div><section className="card"><h2>Phân bố trạng thái chuyến đi</h2><table className="table"><thead><tr><th>Trạng thái</th><th>Số chuyến</th></tr></thead><tbody>{Object.entries(stats.byStatus || {}).map(([status, count]) => <tr key={status}><td><StatusChip tone="neutral">{status}</StatusChip></td><td>{count}</td></tr>)}</tbody></table></section></> : null}</section>;
}
