import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BaseMap } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

const money = (ride) => { const v = typeof ride.priceSnapshot === "number" ? ride.priceSnapshot : ride.priceSnapshot?.amount ?? ride.fare?.amount ?? ride.fare ?? ride.amount; return typeof v === "number" ? v.toLocaleString("vi-VN") + "đ" : "—"; };
const km = (ride) => { const v = ride.distanceKm ?? ride.distance_km; return typeof v === "number" ? v.toLocaleString("vi-VN") + " km" : "—"; };

export default function IncomingRequestPage() {
  const { state } = useLocation(); const nav = useNavigate(); const { client, user } = useAuth(); const ride = state?.ride || {}; const [remaining, setRemaining] = useState(15); const [error, setError] = useState(""); const hasRide = Boolean(ride.rideId || ride.id);
  useEffect(() => { const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, []);
  const reportOutcome = (outcome) => { client.post(`/drivers/${user?.id}/request-outcome`, { outcome }).catch(() => {}); };
  const accept = async () => { try { const id = ride.rideId || ride.id; await client.post(`/rides/${id}/accept`, {}); reportOutcome("accepted"); nav(`/ride/${id}`); } catch (event) { setError(event.message); } };
  const reject = async () => { try { const id = ride.rideId || ride.id; await client.post(`/rides/${id}/cancel`, { driverId: user?.id, reason: "Driver declined request" }); reportOutcome("rejected"); nav("/home"); } catch (event) { setError(event.message); } };
  const C = 2 * Math.PI * 34;
  return <main className="drv-map-page drv-incoming">
    <div className="drv-map drv-map--dim" aria-hidden="true"><BaseMap className="drv-leaflet" /></div>
    <section className="drv-panel drv-panel--modal">
      <div className="drv-sheet drv-request" role="dialog" aria-labelledby="req-title">
        <h1 id="req-title" className="drv-request__title">Yêu cầu mới</h1>
        <div className="drv-ring" role="timer" aria-label={`Còn ${remaining} giây`}>
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="drv-ring__bg" /><circle cx="40" cy="40" r="34" className="drv-ring__fg" strokeDasharray={C} strokeDashoffset={C * (1 - remaining / 15)} /></svg>
          <span><strong>{remaining}</strong>giây</span>
        </div>
        <ol className="drv-route">
          <li><i className="drv-dot drv-dot--pickup" /><div><strong>{ride.pickup?.label || "Điểm đón mới"}</strong>{ride.pickup?.district ? <span>{ride.pickup.district}</span> : null}</div></li>
          <li><i className="drv-dot drv-dot--drop" /><div><strong>{ride.drop?.label || "Điểm đến đang cập nhật"}</strong>{ride.drop?.district ? <span>{ride.drop.district}</span> : null}</div></li>
        </ol>
        <p className="drv-muted">Khoảng cách: {km(ride)}</p>
        <div className="drv-price"><strong>{money(ride)}</strong><span className="drv-tag">{ride.paymentMethod === "CARD" ? "Thẻ" : "Tiền mặt"}</span></div>
        {!hasRide ? <p className="drv-muted drv-small" role="status">Chưa có yêu cầu hợp lệ — đang chờ dữ liệu chuyến.</p> : null}
        <button type="button" className="drv-btn drv-btn--mint" disabled={!hasRide} onClick={accept}>Nhận chuyến</button>
        <button type="button" className="drv-btn drv-btn--danger" disabled={!hasRide} onClick={reject}>Từ chối</button>
        {error ? <p className="drv-alert" role="alert">{error}</p> : null}
      </div>
    </section>
  </main>;
}
