import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BaseMap, DriverMarker } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useDriverRealtime } from "../providers/RealtimeProvider.jsx";
import Icon from "../components/Icon.jsx";

const fareOf = (ride) => Number(typeof ride?.priceSnapshot === "number" ? ride.priceSnapshot : ride?.priceSnapshot?.amount ?? ride?.fare?.amount ?? ride?.fare ?? 0) || 0;
const isToday = (value) => { if (!value) return false; const d = new Date(value), now = new Date(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); };

export default function DriverHomePage() {
  const { client, user } = useAuth(); const { events } = useDriverRealtime(); const nav = useNavigate(); const [online, setOnline] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [today, setToday] = useState(null); const [acceptance, setAcceptance] = useState(null); const [rating, setRating] = useState(null);
  useEffect(() => { if (!user?.id) return;
    client.get(`/rides/driver/${user.id}/history`).then((x) => { const done = (x.data || []).filter((r) => String(r.status).toUpperCase() === "COMPLETED" && isToday(r.completedAt || r.updatedAt)); setToday({ count: done.length, income: done.reduce((sum, r) => sum + fareOf(r), 0) }); }).catch(() => {});
    client.get(`/drivers/${user.id}/acceptance`).then((x) => setAcceptance(x.data?.acceptanceRate ?? null)).catch(() => {});
    client.get(`/reviews/driver/${user.id}/average`).then((x) => setRating(x.data?.averageRating ?? null)).catch(() => {});
  }, [client, user?.id]);
  useEffect(() => { const request = events.find((event) => event.type === "ride.assigned" || event.type === "driver.assigned"); if (request) nav("/incoming", { state: { ride: request } }); }, [events, nav]);
  useEffect(() => { if (!online || !navigator.geolocation) return; let last = 0; const id = navigator.geolocation.watchPosition((position) => { if (Date.now() - last > 5000) { last = Date.now(); client.patch(`/drivers/${user?.id}/location`, { lat: position.coords.latitude, lng: position.coords.longitude }).catch(() => {}); } }); return () => navigator.geolocation.clearWatch(id); }, [online, user?.id, client]);
  const updateAvailability = async (target) => { if (pending) return; setPending(true); setError(""); try { await client.post(`/drivers/${user?.id}${target ? "/go-online" : "/go-offline"}`, {}); setOnline(target); } catch (event) { setError(event.message || "Không thể cập nhật trạng thái tài xế."); } finally { setPending(false); } };
  const mapCenter = [10.7769, 106.7009];
  return <main className="drv-map-page">
    <div className="drv-map">
      <BaseMap center={mapCenter} className="drv-leaflet"><DriverMarker position={mapCenter} /></BaseMap>
      <div className="drv-map-top">
        <button type="button" className="drv-fab" aria-label="Tài khoản" onClick={() => nav("/profile")}><Icon name="menu" /></button>
        <button type="button" className="drv-fab" aria-label="Thông báo"><Icon name="bell" /></button>
      </div>
    </div>
    <section className="drv-panel" aria-label="Tổng quan hôm nay">
      <div className="drv-sheet">
        <div className="drv-stat-head">
          <div><p className="drv-label">Doanh thu hôm nay</p><p className="drv-big">{today ? today.income.toLocaleString("vi-VN") + "đ" : "—"}</p></div>
          <p className="drv-muted">{today ? today.count : "—"} chuyến</p>
        </div>
        <div className="drv-stat-row">
          <div><p className="drv-label">Tỉ lệ nhận chuyến</p><p className="drv-mid">{typeof acceptance === "number" ? Math.round(acceptance * 100) + "%" : "—"}</p></div>
          <div><p className="drv-label">Đánh giá</p><p className="drv-mid"><span className="drv-star">★</span> {typeof rating === "number" ? rating.toLocaleString("vi-VN") : "—"}</p></div>
        </div>
        <button type="button" className={`drv-power ${online ? "is-on" : ""}`} aria-pressed={online} aria-busy={pending || undefined} disabled={pending} onClick={() => updateAvailability(!online)}>
          <span className="drv-power__icon"><Icon name="power" /></span>
          <span>{pending ? "Đang cập nhật…" : online ? "Đang hoạt động" : "Bật nhận chuyến"}</span>
        </button>
        <p className="drv-muted drv-small drv-center">{online ? "Vị trí được cập nhật tối đa mỗi 5 giây." : "Bạn đang ngoại tuyến."}</p>
        {error ? <p className="drv-alert" role="alert">Không thể cập nhật trạng thái: {error}</p> : null}
      </div>
    </section>
  </main>;
}
