import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRoute, RoutePolyline, BaseMap, PickupPin, DestinationPin } from "@cab/web-shared";
import { useBooking } from "../providers/BookingProvider.jsx";

export default function RideOptionsPage() {
  const { pickup, drop, quote, requestQuote, confirmBooking } = useBooking();
  const [error, setError] = useState("");
  const [route, setRoute] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (drop) fetchRoute([pickup.lat, pickup.lng], [drop.lat, drop.lng]).then(setRoute);
  }, [pickup, drop]);

  useEffect(() => {
    setSeconds(Number(quote?.expiresIn) || 0);
  }, [quote?.quoteId, quote?.expiresIn]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const choose = async (type) => {
    setQuoting(true);
    try {
      setError("");
      await requestQuote(type, route || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setQuoting(false);
    }
  };

  const book = async () => {
    try {
      const item = await confirmBooking();
      nav("/searching", { state: { bookingId: item.booking_id || item.id } });
    } catch (e) {
      setError(e.status === 503 ? "Không có tài xế trong khu vực" : e.message);
    }
  };

  const refresh = () => quote?.vehicleType ? choose(quote.vehicleType) : setError("Hãy chọn loại xe để lấy báo giá.");

  return <main className="page"><h1>Chọn xe</h1>{drop && <BaseMap center={[pickup.lat, pickup.lng]}><RoutePolyline geometry={route?.geometry} /><PickupPin position={[pickup.lat, pickup.lng]} /><DestinationPin position={[drop.lat, drop.lng]} /></BaseMap>}<div className="card"><p>{quoting ? "Đang cập nhật báo giá…" : quote ? (seconds ? `Báo giá còn ${seconds}s` : "Báo giá đã hết hạn") : "Chọn loại xe để nhận báo giá"}</p>{["bike", "standard", "premium", "suv"].map((type) => <button key={type} className="secondary" disabled={quoting} onClick={() => choose(type)}>{type}</button>)}{quote && <><h2>{quote.priceSnapshot?.amount || quote.amount || "—"} đ</h2><p>Hệ số surge: {quote.priceSnapshot?.surgeMultiplier || quote.surgeMultiplier || 1}</p>{seconds ? <button disabled={quoting} onClick={book}>Xác nhận đặt xe</button> : <button className="secondary" disabled={quoting} onClick={refresh}>Refresh quote</button>}</>}{error && <p className="state">{error}</p>}</div></main>;
}
