import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BaseMap, DestinationPin, DriverMarker, RoutePolyline } from "@cab/web-shared";
import { useRealtimeEvents } from "../providers/RealtimeProvider.jsx";
import { useBooking } from "../providers/BookingProvider.jsx";
import { Icon } from "../components/Icons.jsx";

const steps = ["Đã đặt xe", "Tài xế nhận", "Đang di chuyển", "Đến nơi"];
const stepOf = { ASSIGNED: 1, ACCEPTED: 1, ARRIVED: 1, PICKED_UP: 2, IN_PROGRESS: 2, COMPLETED: 3 };
const initials = (name = "") => name.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "TX";

export default function RideTrackingPage() {
  const { id } = useParams(); const nav = useNavigate(); const { events, status } = useRealtimeEvents(); const { drop, quote } = useBooking();
  const relevant = useMemo(() => events.filter((event) => String(event.rideId || event.ride_id) === id), [events, id]);
  const location = relevant.find((event) => event.type === "driver.location.updated"); const state = relevant.find((event) => event.type === "ride.status.changed"); const assigned = relevant.find((event) => event.type === "driver.assigned" || event.type === "ride.assigned"); const driver = assigned?.driver || state?.driver || {};
  useEffect(() => { if (state?.status === "COMPLETED") nav(`/payment/${id}`, { replace: true }); }, [state?.status, id, nav]);
  const point = location ? [Number(location.lat), Number(location.lng)] : [10.7769, 106.7009]; const geometry = state?.route?.geometry || assigned?.route?.geometry; const rideStatus = state?.status || assigned?.status || "Đang chờ";
  const statusText = ({ ASSIGNED: "Đã ghép tài xế", ACCEPTED: "Tài xế đang đến", IN_PROGRESS: "Đang trên chuyến đi" })[rideStatus] || rideStatus;
  const eta = driver.eta ?? state?.eta; const distanceKm = state?.distanceKm ?? assigned?.distanceKm; const current = stepOf[rideStatus] ?? 0;
  const arrival = eta != null ? new Date(Date.now() + Number(eta) * 60000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const fare = state?.fare?.amount ?? state?.amount ?? quote?.priceSnapshot?.amount ?? quote?.amount;
  const share = () => navigator.share?.({ title: "Chuyến đi CAB", text: `Tôi đang trên chuyến đi CAB cùng ${driver.name || "tài xế"} (${driver.plate || "—"}).` }).catch(() => {});
  return <main className="cx-screen cx-screen--tall">
    <BaseMap center={point} className="map cx-map"><RoutePolyline geometry={geometry} /><DriverMarker position={point} heading={location?.heading} />{drop && <DestinationPin position={[drop.lat, drop.lng]} />}</BaseMap>
    <div className="cx-float-chip" role="status"><span className="cx-dot cx-dot--pickup" /><span><small>Đến nơi</small><strong>{arrival || "Đang tính"}{distanceKm != null ? ` · ${String(distanceKm).replace(".", ",")} km` : ""}</strong></span></div>
    <section className="cx-sheet" aria-label="Theo dõi chuyến đi">
      <span className="cx-grabber" aria-hidden="true" />
      <div className="cx-driver">
        <span className="cx-avatar" aria-hidden="true">{initials(driver.name)}</span>
        <span className="cx-driver-info"><strong>{driver.name || "Tài xế CAB"}</strong><small>{driver.plate || "Đang cập nhật biển số"}{driver.vehicle ? ` · ${driver.vehicle}` : ""}</small><span className="cx-chip cx-chip--progress">{statusText}</span></span>
        <span className="cx-rating">★ {driver.rating ?? "—"}</span>
      </div>
      <div className="cx-actions">
        <a href={driver.phone ? `tel:${driver.phone}` : undefined} aria-disabled={!driver.phone}><span><Icon name="phone" /></span>Gọi</a>
        <a href={driver.phone ? `sms:${driver.phone}` : undefined} aria-disabled={!driver.phone}><span><Icon name="chat" /></span>Nhắn tin</a>
        <button type="button" onClick={share}><span><Icon name="share" /></span>Chia sẻ</button>
        <button type="button" className="is-danger" aria-disabled="true" title="Liên hệ tổng đài để hủy chuyến đang diễn ra"><span><Icon name="close" /></span>Hủy</button>
      </div>
      <div className="cx-eta-row">
        <span><small>Đến nơi sau</small><strong>{eta != null ? `${eta} phút` : "Đang tính"}</strong>{distanceKm != null ? <em> ({String(distanceKm).replace(".", ",")} km)</em> : null}</span>
        <span className="cx-fare"><strong>{fare != null ? `${Number(fare).toLocaleString("vi-VN")}đ` : "—"}</strong><small>Tiền mặt</small></span>
      </div>
      <ol className="cx-stepper" aria-label="Tiến trình chuyến đi">
        {steps.map((label, index) => <li key={label} className={index < current ? "is-done" : index === current ? "is-current" : ""}><i aria-hidden="true" /><span>{label}</span></li>)}
      </ol>
      <div className="cx-rate">
        <small>Đánh giá chuyến đi · Kết nối {status}</small>
        <div className="cx-stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} sao`} onClick={() => nav(`/rating/${id}`)}>★</button>)}</div>
      </div>
    </section>
  </main>;
}
