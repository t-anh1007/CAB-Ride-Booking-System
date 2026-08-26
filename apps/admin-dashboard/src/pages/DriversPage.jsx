import { useEffect, useState } from "react";
import { StatusChip, SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import DataState from "../components/DataState.jsx";

export default function DriversPage() {
  const { client } = useAuth(); const [rows, setRows] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; client.get("/drivers/available").then((result) => { const payload = result.data || result; if (active) setRows(payload.drivers || payload.items || payload); }).catch((event) => active && setError(event.message)); return () => { active = false; }; }, [client]);
  return <section className="page cab-admin-page"><p className="cab-eyebrow">ĐỘI TÁC</p><h1>Tài xế khả dụng</h1>{error ? <DataState error={error} /> : null}{!error && !rows ? <SurfaceState kind="loading" detail="Đang đồng bộ trạng thái trực tuyến." /> : null}{Array.isArray(rows) ? <table className="table"><thead><tr><th>Id</th><th>Tên</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.driverId || row.id || index}><td>{row.driverId ?? row.id ?? "—"}</td><td>{row.name ?? row.fullName ?? "—"}</td><td><StatusChip tone="success">{row.status ?? row.availability ?? "—"}</StatusChip></td></tr>)}</tbody></table> : null}</section>;
}
