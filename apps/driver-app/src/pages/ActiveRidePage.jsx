import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { BaseMap, DriverMarker } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";
import Icon from "../components/Icon.jsx";

const titles = { pickup: "Đang chờ khách", drop: "Đang đưa khách đến nơi", done: "Chuyến đi hoàn thành" };
const actions = { pickup: "Bắt đầu chuyến", drop: "Hoàn thành chuyến", done: "Đã hoàn thành" };
const chips = { pickup: ["drv-chip--pending", "Chờ xác nhận"], drop: ["drv-chip--going", "Đang đi"], done: ["drv-chip--done", "Hoàn thành"] };

export default function ActiveRidePage() {
  const { id } = useParams(), { client } = useAuth(); const [phase, setPhase] = useState("pickup"), [note, setNote] = useState(""); const last = useRef(0), center = [10.7769, 106.7009];
  useEffect(() => { if (phase === "done" || !navigator.geolocation) return; const watch = navigator.geolocation.watchPosition(p => { if (Date.now() - last.current >= 5000) { last.current = Date.now(); client.post("/rides/" + id + "/location", { currentLocation: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {}) } }); return () => navigator.geolocation.clearWatch(watch) }, [client, id, phase]);
  const start = async () => { try { await client.post("/rides/" + id + "/start", {}); setPhase("drop") } catch (e) { setNote(e.message) } };
  const complete = async () => { try { await client.post("/rides/" + id + "/complete", {}); setPhase("done") } catch (e) { setNote(e.message) } };
  const act = () => phase === "pickup" ? start() : complete();
  const shortId = String(id).slice(0, 8);
  return <main className="drv-map-page cab-active-ride">
    <div className="drv-map">
      <BaseMap center={center} className="drv-leaflet"><DriverMarker position={center} /></BaseMap>
      <div className="drv-map-chip"><span className="drv-dot drv-dot--pickup" /><div><strong>{titles[phase]}</strong><span>Chuyến #{shortId}</span></div></div>
    </div>
    <section className="drv-panel">
      <div className="drv-sheet">
        <div className="drv-customer">
          <span className="drv-avatar" aria-hidden="true"><Icon name="user" size={26} /></span>
          <div><strong>Khách hàng</strong><span className="drv-muted drv-small">Chuyến #{shortId}</span></div>
          <span className={`drv-chip ${chips[phase][0]}`}>{chips[phase][1]}</span>
        </div>
        <div className="drv-contact">
          <button type="button" className="drv-icon-btn" disabled title="Chưa có số liên hệ"><i><Icon name="phone" /></i><span>Gọi</span></button>
          <button type="button" className="drv-icon-btn" disabled title="Chưa có kênh nhắn tin"><i><Icon name="chat" /></i><span>Nhắn tin</span></button>
        </div>
        <h1 className="drv-phase">{titles[phase]}</h1>
        <button type="button" className="drv-slide" disabled={phase === "done"} onClick={act}><span>{actions[phase]}</span><i><Icon name="arrow" /></i></button>
        {note && <p className="drv-alert" role="alert">{note}</p>}
        <div className="drv-fare"><span className="drv-label">Đơn giá chuyến này</span><span className="drv-tag">Tiền mặt</span></div>
      </div>
    </section>
  </main>;
}
