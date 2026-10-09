import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchRoute, RoutePolyline, BaseMap, PickupPin, DestinationPin } from "@cab/web-shared";
import { useBooking } from "../providers/BookingProvider.jsx";
import { Icon, VehicleIcon } from "../components/Icons.jsx";

const vehicles = [
  { type: "bike", name: "Xe máy", seats: "1 người" },
  { type: "standard", name: "Xe tiêu chuẩn", seats: "4 chỗ" },
  { type: "premium", name: "Xe cao cấp", seats: "4 chỗ" },
  { type: "suv", name: "SUV", seats: "7 chỗ" }
];
const money = (value) => value == null || value === "" ? null : `${Number(value).toLocaleString("vi-VN")}đ`;

export default function RideOptionsPage() {
  const { pickup, drop, quote, requestQuote, confirmBooking } = useBooking();
  const [error, setError] = useState("");
  const [route, setRoute] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [pending, setPending] = useState(null);
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
    setPending(type);
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
  const selected = quoting ? pending : quote?.vehicleType;
  const amount = quote?.priceSnapshot?.amount || quote?.amount;
  const surge = quote?.priceSnapshot?.surgeMultiplier || quote?.surgeMultiplier || 1;
  const eta = route?.durationMin ? `~${Math.round(route.durationMin)} phút` : null;

  return <main className="cx-screen cx-screen--tall">
    <BaseMap center={[pickup.lat, pickup.lng]} className="map cx-map"><RoutePolyline geometry={route?.geometry} /><PickupPin position={[pickup.lat, pickup.lng]} />{drop && <DestinationPin position={[drop.lat, drop.lng]} />}</BaseMap>
    <button type="button" className="cx-fab cx-fab--menu" onClick={() => nav("/destination")} aria-label="Quay lại chọn điểm đến"><Icon name="back" /></button>
    <section className="cx-sheet" aria-label="Chọn loại xe">
      <span className="cx-grabber" aria-hidden="true" />
      <div className="cx-sheet-head"><h1>Chọn loại xe</h1>{quote && !quoting ? <span className={`cx-chip ${seconds ? "cx-chip--success" : "cx-chip--warning"}`}>{seconds ? `Báo giá còn ${seconds}s` : "Báo giá đã hết hạn"}</span> : null}</div>
      {drop ? <p className="cx-trip-line"><span className="cx-dot cx-dot--pickup" />{pickup.label}<Icon name="chevron" size={14} /><span className="cx-dot cx-dot--drop" />{drop.label}</p>
        : <div className="cx-empty"><p>Bạn chưa chọn điểm đến.</p><Link to="/destination" className="cx-btn cx-btn--secondary">Chọn điểm đến</Link></div>}
      <div className="cx-vehicles" role="radiogroup" aria-label="Loại xe">
        {vehicles.map(({ type, name, seats }) => {
          const active = selected === type;
          return <button key={type} type="button" role="radio" aria-checked={active} className={`cx-vehicle${active ? " is-selected" : ""}`} disabled={quoting || !drop} onClick={() => choose(type)}>
            <span className="cx-vehicle-icon"><VehicleIcon type={type} /></span>
            <span className="cx-vehicle-name"><strong>{name}</strong><small>{seats}</small></span>
            <span className="cx-vehicle-price"><strong>{active && quoting ? "Đang tính…" : active && quote ? money(amount) || "—" : "Xem giá"}</strong><small>{active && quote && surge > 1 ? `Surge x${surge}` : eta || ""}</small></span>
          </button>;
        })}
      </div>
      <div className="cx-pay-row"><Icon name="cash" /><span>Tiền mặt</span><small>Đổi khi thanh toán</small><Icon name="chevronDown" size={18} /></div>
      {error && <p className="cx-alert" role="alert">{error}</p>}
      {quote && !seconds
        ? <button type="button" className="cx-btn cx-btn--secondary" disabled={quoting} onClick={refresh}>Làm mới báo giá</button>
        : <button type="button" className="cx-btn cx-btn--primary" disabled={quoting || !quote} onClick={book}>{quote ? "Đặt xe" : "Chọn loại xe để nhận báo giá"}</button>}
    </section>
  </main>;
}
