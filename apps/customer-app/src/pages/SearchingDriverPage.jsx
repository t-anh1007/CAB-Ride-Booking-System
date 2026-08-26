import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CabButton, StatusChip } from "@cab/web-shared";
import { useRealtimeEvents } from "../providers/RealtimeProvider.jsx";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function SearchingDriverPage() {
  const { events, status } = useRealtimeEvents(); const { client } = useAuth(); const nav = useNavigate(); const location = useLocation(); const bookingId = location.state?.bookingId;
  const assigned = events.find((event) => (event.type === "driver.assigned" || event.type === "ride.assigned") && (!bookingId || String(event.bookingId || event.booking_id || "") === String(bookingId)));
  useEffect(() => { const id = assigned?.rideId || assigned?.ride_id; if (id) nav(`/tracking/${id}`, { replace: true }); }, [assigned?.rideId, assigned?.ride_id, nav]);
  const cancel = async () => { if (bookingId) await client.post(`/bookings/${bookingId}/cancel`, {}); nav("/home"); };
  return <main className="page cab-searching-page"><p className="cab-eyebrow">GHÉP TÀI XẾ</p><h1>Đang tìm tài xế gần bạn</h1><section className="card cab-searching-card"><div className="cab-searching-pulse" aria-hidden="true">⌖</div><StatusChip tone={status === "connected" ? "success" : "warning"}>Realtime {status}</StatusChip><p>Chúng tôi sẽ báo ngay khi có tài xế phù hợp với hành trình của bạn.</p><CabButton variant="danger" className="cab-full" onClick={cancel}>Hủy chuyến</CabButton></section></main>;
}
