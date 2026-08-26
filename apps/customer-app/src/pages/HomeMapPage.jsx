import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BaseMap, CabButton, PickupPin, StatusChip, reverseGeocode } from "@cab/web-shared";
import { useBooking } from "../providers/BookingProvider.jsx";

export default function HomeMapPage() {
  const { pickup, setPickup } = useBooking(); const nav = useNavigate(); const [locating, setLocating] = useState(true);
  const update = async (lat, lng) => { const label = await reverseGeocode(lat, lng) || "Điểm đón đã chọn"; setPickup({ lat, lng, label }); setLocating(false); };
  useEffect(() => { if (!navigator.geolocation) { setLocating(false); return; } const id = navigator.geolocation.getCurrentPosition((position) => update(position.coords.latitude, position.coords.longitude), () => setLocating(false), { enableHighAccuracy: true, timeout: 7000 }); return () => navigator.geolocation.clearWatch?.(id); }, []);
  const position = [pickup.lat, pickup.lng];
  return <main className="page cab-map-page"><div className="cab-map-heading"><p className="cab-eyebrow">BẮT ĐẦU CHUYẾN ĐI</p><h1>Đón bạn ở đâu?</h1></div><BaseMap center={position} onMapClick={([lat, lng]) => update(lat, lng)}><PickupPin position={position} draggable onDragEnd={(event) => { const point = event.target.getLatLng(); update(point.lat, point.lng); }} /></BaseMap><section className="card cab-bottom-sheet"><StatusChip tone={locating ? "warning" : "success"}>{locating ? "Đang định vị" : "Điểm đón đã chọn"}</StatusChip><b>{pickup.label}</b><p className="muted">{locating ? "Đang xác định vị trí của bạn…" : "Kéo pin hoặc chạm bản đồ để điều chỉnh điểm đón."}</p><CabButton className="cab-full" onClick={() => nav("/destination")}>Chọn điểm đến</CabButton></section></main>;
}
