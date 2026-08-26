import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CabButton, StatusChip } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function IncomingRequestPage() {
  const { state } = useLocation(); const nav = useNavigate(); const { client, user } = useAuth(); const ride = state?.ride || {}; const [remaining, setRemaining] = useState(15); const [error, setError] = useState(""); const hasRide = Boolean(ride.rideId || ride.id);
  useEffect(() => { const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, []);
  const accept = async () => { try { const id = ride.rideId || ride.id; await client.post(`/rides/${id}/accept`, {}); nav(`/ride/${id}`); } catch (event) { setError(event.message); } };
  const reject = async () => { try { const id = ride.rideId || ride.id; await client.post(`/rides/${id}/cancel`, { driverId: user?.id, reason: "Driver declined request" }); nav("/home"); } catch (event) { setError(event.message); } };
  return <main className="page cab-incoming-page"><p className="cab-eyebrow">YÊU CẦU MỚI</p><h1>Chuyến đi đang chờ bạn</h1><section className="card cab-incoming-card"><StatusChip tone="warning">Còn {remaining} giây</StatusChip><div className="cab-route"><span>●</span><p>{ride.pickup?.label || "Điểm đón mới"}</p></div><div className="cab-route cab-route--drop"><span>●</span><p>{ride.drop?.label || "Điểm đến đang cập nhật"}</p></div><div className="cab-action-grid"><CabButton disabled={!hasRide} onClick={accept}>Nhận chuyến</CabButton><CabButton variant="danger" disabled={!hasRide} onClick={reject}>Từ chối</CabButton></div>{error ? <p className="state">{error}</p> : null}</section></main>;
}
