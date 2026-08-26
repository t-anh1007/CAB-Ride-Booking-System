import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BaseMap, DriverMarker, RoutePolyline, StatusChip } from "@cab/web-shared";
import { useRealtimeEvents } from "../providers/RealtimeProvider.jsx";

export default function RideTrackingPage() {
  const { id } = useParams(); const nav = useNavigate(); const { events, status } = useRealtimeEvents();
  const relevant = useMemo(() => events.filter((event) => String(event.rideId || event.ride_id) === id), [events, id]);
  const location = relevant.find((event) => event.type === "driver.location.updated"); const state = relevant.find((event) => event.type === "ride.status.changed"); const assigned = relevant.find((event) => event.type === "driver.assigned" || event.type === "ride.assigned"); const driver = assigned?.driver || state?.driver || {};
  useEffect(() => { if (state?.status === "COMPLETED") nav(`/payment/${id}`, { replace: true }); }, [state?.status, id, nav]);
  const point = location ? [Number(location.lat), Number(location.lng)] : [10.7769, 106.7009]; const geometry = state?.route?.geometry || assigned?.route?.geometry; const rideStatus = state?.status || assigned?.status || "Đang chờ";
  return <main className="page cab-map-page"><div className="cab-map-heading"><p className="cab-eyebrow">CHUYẾN ĐI ĐANG DIỄN RA</p><h1>Theo dõi tài xế</h1></div><BaseMap center={point}><RoutePolyline geometry={geometry} /><DriverMarker position={point} heading={location?.heading} /></BaseMap><section className="card cab-bottom-sheet"><StatusChip tone="progress">{rideStatus}</StatusChip><b>{driver.name || "Tài xế CAB"}</b><p>{driver.rating ?? "—"}★ · {driver.plate || "Đang cập nhật biển số"}</p><p className="muted">Đến điểm đón trong {driver.eta ?? state?.eta ?? "đang tính"} phút · Realtime {status}</p></section></main>;
}
