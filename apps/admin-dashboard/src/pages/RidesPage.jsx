import { useEffect, useState } from "react";
import { StatusChip, SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import DataState from "../components/DataState.jsx";

export default function RidesPage() {
  const { client } = useAuth(); const [stats, setStats] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; client.get("/rides/stats").then((result) => active && setStats(result.data || result)).catch((event) => active && setError(event.message)); return () => { active = false; }; }, [client]);
  return <section className="page cab-admin-page"><p className="cab-eyebrow">CHUYẾN ĐI</p><h1>Tóm tắt vận hành</h1>{error ? <DataState error={error} /> : null}{!error && !stats ? <SurfaceState kind="loading" detail="Đang tổng hợp dữ liệu chuyến đi." /> : null}{stats ? <article className="card cab-summary-card"><StatusChip tone="neutral">Aggregate-only · read-only</StatusChip><strong>{stats.totalRides ?? 0} chuyến</strong><p className="muted">Danh sách từng chuyến chưa có endpoint GET /rides công khai, nên CAB không hiển thị dữ liệu giả.</p></article> : null}</section>;
}
