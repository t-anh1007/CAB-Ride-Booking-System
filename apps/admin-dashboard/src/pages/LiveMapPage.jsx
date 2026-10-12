import { useMemo } from "react";
import { useAdminRealtime } from "../providers/RealtimeProvider.jsx";
import { Chip, PageHead } from "../components/ui.jsx";
import OpsMap from "../components/OpsMap.jsx";
import { demoZones } from "../data/demo.js";

export default function LiveMapPage() {
  const { events, status } = useAdminRealtime();
  const drivers = useMemo(() => { const byId = new Map(); events.filter((event) => event.type === "driver.location.updated").forEach((event) => { const id = event.driverId || event.driver_id; const lat = Number(event.lat ?? event.latitude); const lng = Number(event.lng ?? event.longitude); if (id && Number.isFinite(lat) && Number.isFinite(lng)) byId.set(id, { ...event, id, lat, lng }); }); return [...byId.values()]; }, [events]);
  return <section className="ad-page"><PageHead eyebrow="ĐIỀU PHỐI TRỰC TIẾP" title="Bản đồ vận hành"><Chip tone={status === "connected" ? "success" : "warning"}>Realtime {status}</Chip><Chip tone="info">{drivers.length} tài xế có vị trí</Chip></PageHead>
    <OpsMap className="ad-map--tall" zones={demoZones} drivers={drivers} />
    <p className="ad-foot">Vị trí chỉ hiển thị khi gateway gửi sự kiện hợp lệ. Vùng nhu cầu là lớp minh họa.</p></section>;
}
