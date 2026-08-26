import { useMemo } from "react";
import { BaseMap, DriverMarker, StatusChip } from "@cab/web-shared";
import { useAdminRealtime } from "../providers/RealtimeProvider.jsx";

export default function LiveMapPage() {
  const { events, status } = useAdminRealtime();
  const drivers = useMemo(() => { const byId = new Map(); events.filter((event) => event.type === "driver.location.updated").forEach((event) => { const id = event.driverId || event.driver_id; const lat = Number(event.lat ?? event.latitude); const lng = Number(event.lng ?? event.longitude); if (id && Number.isFinite(lat) && Number.isFinite(lng)) byId.set(id, { ...event, id, lat, lng }); }); return [...byId.values()]; }, [events]);
  return <section className="page cab-admin-page"><p className="cab-eyebrow">ĐIỀU PHỐI TRỰC TIẾP</p><h1>Bản đồ vận hành</h1><div className="cab-map-toolbar"><StatusChip tone={status === "connected" ? "success" : "warning"}>Realtime {status}</StatusChip><span>{drivers.length} tài xế có vị trí</span></div><BaseMap>{drivers.map((driver) => <DriverMarker key={driver.id} position={[driver.lat, driver.lng]} heading={driver.heading} />)}</BaseMap><p className="muted">Vị trí chỉ hiển thị khi gateway gửi sự kiện hợp lệ.</p></section>;
}
