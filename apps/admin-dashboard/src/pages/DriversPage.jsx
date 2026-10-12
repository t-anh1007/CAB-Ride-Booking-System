import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Chip, DemoNote, Loading, PageHead, Panel } from "../components/ui.jsx";
import { demoDriverRows } from "../data/demo.js";

export default function DriversPage() {
  const { client } = useAuth(); const [rows, setRows] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; client.get("/drivers/available").then((result) => { const payload = result.data || result; if (active) setRows(payload.drivers || payload.items || payload); }).catch((event) => active && setError(event.message)); return () => { active = false; }; }, [client]);
  const list = error ? demoDriverRows : rows;
  return <section className="ad-page">
    <PageHead eyebrow="ĐỐI TÁC" title="Tài xế khả dụng">{Array.isArray(list) && <Chip tone="success">{list.length} trực tuyến</Chip>}</PageHead>
    {error && <DemoNote>Không tải được danh sách ({error}). Đang hiển thị dữ liệu minh họa.</DemoNote>}
    {!error && !rows && <Loading text="Đang đồng bộ trạng thái trực tuyến…" />}
    {Array.isArray(list) && <Panel>
      <div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>Mã tài xế</th><th>Tên</th><th>Phương tiện</th><th>Trạng thái</th></tr></thead><tbody>
        {!list.length && <tr><td colSpan="4" className="ad-empty">Chưa có tài xế trực tuyến.</td></tr>}
        {list.map((row, index) => { const name = row.name ?? row.fullName ?? "—"; const status = row.status ?? row.availability; return <tr key={row.driverId || row.id || index}><td className="ad-mono">{row.driverId ?? row.id ?? "—"}</td><td><span className="ad-person"><span className="ad-avatar ad-avatar--sm">{name[0]}</span>{name}</span></td><td>{row.vehicle ?? row.licensePlate ?? "—"}</td><td>{status ? <Chip status={status} /> : <Chip tone="success">Trực tuyến</Chip>}</td></tr>; })}
      </tbody></table></div>
    </Panel>}
  </section>;
}
