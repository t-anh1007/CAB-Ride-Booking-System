import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import { Marker } from "react-leaflet";
import { BaseMap, PickupPin, reverseGeocode } from "@cab/web-shared";
import { useBooking } from "../providers/BookingProvider.jsx";
import { Icon } from "../components/Icons.jsx";

const meIcon = L.divIcon({ className: "cab-map-marker", html: "<span class='cx-me-dot' aria-label='Vị trí của tôi'></span>", iconSize: [22, 22], iconAnchor: [11, 11] });

export default function HomeMapPage() {
  const { pickup, setPickup, drop } = useBooking(); const nav = useNavigate(); const [locating, setLocating] = useState(true); const [me, setMe] = useState(null);
  const update = async (lat, lng) => { const label = await reverseGeocode(lat, lng) || "Điểm đón đã chọn"; setPickup({ lat, lng, label }); setLocating(false); };
  const locate = () => { if (!navigator.geolocation) { setLocating(false); return; } setLocating(true); return navigator.geolocation.getCurrentPosition((position) => { setMe([position.coords.latitude, position.coords.longitude]); update(position.coords.latitude, position.coords.longitude); }, () => setLocating(false), { enableHighAccuracy: true, timeout: 7000 }); };
  useEffect(() => { const id = locate(); return () => navigator.geolocation?.clearWatch?.(id); }, []);
  const position = [pickup.lat, pickup.lng];
  return <main className="cx-screen">
    <BaseMap center={position} className="map cx-map" onMapClick={([lat, lng]) => update(lat, lng)}>
      {me ? <Marker position={me} icon={meIcon} /> : null}
      <PickupPin position={position} draggable onDragEnd={(event) => { const point = event.target.getLatLng(); update(point.lat, point.lng); }} />
    </BaseMap>
    <Link to="/profile" className="cx-fab cx-fab--menu" aria-label="Mở menu tài khoản"><Icon name="menu" /></Link>
    <button type="button" className="cx-fab cx-fab--locate" onClick={locate} aria-label="Về vị trí của tôi"><Icon name="locate" /></button>
    <section className="cx-sheet" aria-label="Chọn điểm đón">
      <span className="cx-grabber" aria-hidden="true" />
      <div className="cx-route-card">
        <button type="button" className="cx-route-row" onClick={locate}>
          <span className="cx-dot cx-dot--pickup" aria-hidden="true" />
          <span className="cx-route-text"><small>Điểm đón</small><strong>{locating ? "Đang xác định vị trí của bạn…" : pickup.label}</strong></span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="cx-route-row" onClick={() => nav("/destination")}>
          <span className="cx-dot cx-dot--drop" aria-hidden="true" />
          <span className="cx-route-text"><small>Điểm đến</small><strong className={drop ? "" : "cx-placeholder"}>{drop?.label || "Bạn muốn đến đâu?"}</strong></span>
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <p className="cx-hint">Kéo pin hoặc chạm bản đồ để điều chỉnh điểm đón.</p>
      <div className="cx-quick">
        <button type="button" onClick={() => nav("/destination")}><Icon name="house" /><span>Nhà riêng</span></button>
        <button type="button" onClick={() => nav("/destination")}><Icon name="briefcase" /><span>Công ty</span></button>
        <button type="button" onClick={() => nav("/destination")}><Icon name="heart" /><span>Ưa thích</span></button>
      </div>
      <button type="button" className="cx-btn cx-btn--primary" onClick={() => nav("/destination")}>Đặt xe</button>
    </section>
  </main>;
}
