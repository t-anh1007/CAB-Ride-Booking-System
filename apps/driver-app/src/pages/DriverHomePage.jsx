import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BaseMap, CabButton, DriverMarker, StatusChip } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useDriverRealtime } from "../providers/RealtimeProvider.jsx";

export default function DriverHomePage() {
  const { client, user } = useAuth(); const { events } = useDriverRealtime(); const nav = useNavigate(); const [online, setOnline] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  useEffect(() => { const request = events.find((event) => event.type === "ride.assigned" || event.type === "driver.assigned"); if (request) nav("/incoming", { state: { ride: request } }); }, [events, nav]);
  useEffect(() => { if (!online || !navigator.geolocation) return; let last = 0; const id = navigator.geolocation.watchPosition((position) => { if (Date.now() - last > 5000) { last = Date.now(); client.patch(`/drivers/${user?.id}/location`, { lat: position.coords.latitude, lng: position.coords.longitude }).catch(() => {}); } }); return () => navigator.geolocation.clearWatch(id); }, [online, user?.id, client]);
  const updateAvailability = async (target) => { if (pending) return; setPending(true); setError(""); try { await client.post(`/drivers/${user?.id}${target ? "/go-online" : "/go-offline"}`, {}); setOnline(target); } catch (event) { setError(event.message || "Không thể cập nhật trạng thái tài xế."); } finally { setPending(false); } };
  const mapCenter = [10.7769, 106.7009]; return <main className="page cab-map-page"><div className="cab-map-heading"><p className="cab-eyebrow">TRẠNG THÁI HOẠT ĐỘNG</p><h1>Sẵn sàng nhận chuyến</h1></div><BaseMap center={mapCenter}><DriverMarker position={mapCenter} /></BaseMap><section className="card cab-bottom-sheet"><StatusChip tone={online ? "success" : "neutral"}>{online ? "Đang trực tuyến" : "Đang ngoại tuyến"}</StatusChip><p className="muted">Vị trí được cập nhật tối đa mỗi 5 giây khi trực tuyến.</p><CabButton className="cab-full" busy={pending} onClick={() => updateAvailability(!online)}>{online ? "Tắt nhận chuyến" : "Bật nhận chuyến"}</CabButton>{error ? <p className="state">Không thể cập nhật trạng thái: {error}</p> : null}</section></main>;
}
