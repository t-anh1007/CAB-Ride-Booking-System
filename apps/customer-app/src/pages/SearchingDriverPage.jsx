import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import L from "leaflet";
import { Marker } from "react-leaflet";
import { BaseMap, StatusChip } from "@cab/web-shared";
import { useRealtimeEvents } from "../providers/RealtimeProvider.jsx";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useBooking } from "../providers/BookingProvider.jsx";
import { CarIllustration } from "../components/Icons.jsx";

const radarIcon = L.divIcon({ className: "cab-map-marker", html: "<span class='cx-radar' aria-hidden='true'><i></i><i></i><b></b></span>", iconSize: [240, 240], iconAnchor: [120, 120] });

export default function SearchingDriverPage() {
  const { events, status } = useRealtimeEvents(); const { client } = useAuth(); const { pickup } = useBooking(); const nav = useNavigate(); const location = useLocation(); const bookingId = location.state?.bookingId;
  const assigned = events.find((event) => (event.type === "driver.assigned" || event.type === "ride.assigned") && (!bookingId || String(event.bookingId || event.booking_id || "") === String(bookingId)));
  useEffect(() => { const id = assigned?.rideId || assigned?.ride_id; if (id) nav(`/tracking/${id}`, { replace: true }); }, [assigned?.rideId, assigned?.ride_id, nav]);
  const cancel = async () => { if (bookingId) await client.post(`/bookings/${bookingId}/cancel`, {}); nav("/home"); };
  const position = [pickup.lat, pickup.lng];
  return <main className="cx-screen">
    <BaseMap center={position} zoom={15} className="map cx-map"><Marker position={position} icon={radarIcon} interactive={false} /></BaseMap>
    <section className="cx-sheet cx-sheet--center" aria-label="Đang tìm tài xế">
      <span className="cx-grabber" aria-hidden="true" />
      <h1>Đang tìm tài xế</h1>
      <p className="cx-sub">Chúng tôi đang tìm tài xế gần bạn nhất</p>
      <CarIllustration />
      <StatusChip tone={status === "open" ? "success" : "warning"}>Realtime {status}</StatusChip>
      <button type="button" className="cx-btn cx-btn--outline" onClick={cancel}>Hủy chuyến</button>
    </section>
  </main>;
}
