import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { BaseMap, DestinationPin, DriverMarker, PickupPin, RoutePolyline, fetchRoute } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import Icon from "../components/Icon.jsx";

const titles = { pickup: "Đang chờ khách", drop: "Đang đưa khách đến nơi", done: "Chuyến đi hoàn thành" };
const actions = { pickup: "Bắt đầu chuyến", drop: "Hoàn thành chuyến", done: "Đã hoàn thành" };
const point = (p) => { const lat = p?.lat ?? p?.latitude ?? p?.coordinates?.[1], lng = p?.lng ?? p?.longitude ?? p?.coordinates?.[0]; return typeof lat === "number" && typeof lng === "number" ? [lat, lng] : null; };
const place = (p) => p?.address || p?.label || (point(p) ? point(p).map((v) => v.toFixed(5)).join(", ") : "—");
const fare = (ride) => { const v = typeof ride?.priceSnapshot === "number" ? ride.priceSnapshot : ride?.priceSnapshot?.amount ?? ride?.fare?.amount ?? ride?.fare; return typeof v === "number" ? v.toLocaleString("vi-VN") + "đ" : "—"; };
const phaseOf = (status) => ({ IN_PROGRESS: "drop", COMPLETED: "done" })[String(status || "").toUpperCase()] || "pickup";
const chips = { pickup: ["drv-chip--pending", "Chờ xác nhận"], drop: ["drv-chip--going", "Đang đi"], done: ["drv-chip--done", "Hoàn thành"] };

export default function ActiveRidePage() {
  const { id } = useParams(), { client } = useAuth(); const [phase, setPhase] = useState("pickup"), [note, setNote] = useState(""); const last = useRef(0); const [ride, setRide] = useState(null), [customer, setCustomer] = useState(null), [route, setRoute] = useState(null);
  const pickup = point(ride?.pickup), drop = point(ride?.destination), center = pickup || [10.7769, 106.7009];
  useEffect(() => { let alive = true; client.get("/rides/" + id).then((x) => { const r = x.data || x; if (!alive) return; setRide(r); setPhase(phaseOf(r.status)); if (r.userId) client.get("/users/" + r.userId + "/contact").then((c) => alive && setCustomer(c.data || c)).catch(() => {}); }).catch((e) => alive && setNote(e.message)); return () => { alive = false; }; }, [client, id]);
  useEffect(() => { if (!pickup || !drop) return; let alive = true; fetchRoute(pickup, drop).then((r) => alive && setRoute(r)); return () => { alive = false; }; }, [pickup?.[0], pickup?.[1], drop?.[0], drop?.[1]]);
  useEffect(() => { if (phase === "done" || !navigator.geolocation) return; const watch = navigator.geolocation.watchPosition(p => { if (Date.now() - last.current >= 5000) { last.current = Date.now(); client.post("/rides/" + id + "/location", { currentLocation: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {}) } }); return () => navigator.geolocation.clearWatch(watch) }, [client, id, phase]);
  const start = async () => { try { await client.post("/rides/" + id + "/start", {}); setPhase("drop") } catch (e) { setNote(e.message) } };
  const complete = async () => { try { await client.post("/rides/" + id + "/complete", {}); setPhase("done") } catch (e) { setNote(e.message) } };
  const act = () => phase === "pickup" ? start() : complete();
  const shortId = String(id).slice(0, 8);
  return <main className="drv-map-page cab-active-ride">
    <div className="drv-map">
      <BaseMap key={center.join(",")} center={center} className="drv-leaflet"><DriverMarker position={center} /><PickupPin position={pickup} /><DestinationPin position={drop} />{route ? <RoutePolyline geometry={route.geometry} /> : null}</BaseMap>
      <div className="drv-map-chip"><span className="drv-dot drv-dot--pickup" /><div><strong>{titles[phase]}</strong><span>Chuyến #{shortId}</span></div></div>
    </div>
    <section className="drv-panel">
      <div className="drv-sheet">
        <div className="drv-customer">
          <span className="drv-avatar" aria-hidden="true"><Icon name="user" size={26} /></span>
          <div><strong>{customer?.name || "Khách hàng"}</strong><span className="drv-muted drv-small">{customer?.phone || "Chuyến #" + shortId}</span></div>
          <span className={`drv-chip ${chips[phase][0]}`}>{chips[phase][1]}</span>
        </div>
        <div className="drv-contact">
          {customer?.phone ? <a className="drv-icon-btn" href={"tel:" + customer.phone}><i><Icon name="phone" /></i><span>Gọi</span></a> : <button type="button" className="drv-icon-btn" disabled title="Chưa có số liên hệ"><i><Icon name="phone" /></i><span>Gọi</span></button>}
          <button type="button" className="drv-icon-btn" disabled title="Chưa có kênh nhắn tin"><i><Icon name="chat" /></i><span>Nhắn tin</span></button>
        </div>
        <h1 className="drv-phase">{titles[phase]}</h1>
        <ol className="drv-route">
          <li><i className="drv-dot drv-dot--pickup" /><div><strong>{place(ride?.pickup)}</strong><span>Điểm đón</span></div></li>
          <li><i className="drv-dot drv-dot--drop" /><div><strong>{place(ride?.destination)}</strong><span>Điểm đến</span></div></li>
        </ol>
        <p className="drv-muted drv-small">Quãng đường: {typeof (ride?.distanceKm ?? route?.distanceKm) === "number" ? (ride?.distanceKm ?? route.distanceKm).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " km" : "—"} · Thời gian dự kiến: {typeof (ride?.etaMinutes ?? route?.durationMin) === "number" ? Math.ceil(ride?.etaMinutes ?? route.durationMin) + " phút" : "—"}</p>
        <button type="button" className="drv-slide" disabled={phase === "done"} onClick={act}><span>{actions[phase]}</span><i><Icon name="arrow" /></i></button>
        {note && <p className="drv-alert" role="alert">{note}</p>}
        <div className="drv-fare"><span className="drv-label">Đơn giá chuyến này</span><strong>{fare(ride)}</strong><span className="drv-tag">Tiền mặt</span></div>
      </div>
    </section>
  </main>;
}
