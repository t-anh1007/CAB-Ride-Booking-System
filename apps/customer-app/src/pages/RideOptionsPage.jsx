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
const payMethods = [["cash", "Tiền mặt"], ["card", "Thẻ"], ["wallet", "Ví"]];
const remaining = (q) => q ? Math.max(0, Math.round((Number(q.expiresIn) || 0) - (Date.now() - (q.receivedAt || Date.now())) / 1000)) : 0;
const money = (value) => value == null || value === "" ? null : `${Number(value).toLocaleString("vi-VN")}đ`;

export default function RideOptionsPage() {
  const { pickup, drop, quote, setQuote, fetchQuote, requestQuote, confirmBooking, paymentMethod, setPaymentMethod } = useBooking();
  const [quotes, setQuotes] = useState({});
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState("");
  const [route, setRoute] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [pending, setPending] = useState(null);
  const nav = useNavigate();

  // Báo giá song song cho mọi loại xe (pricing-service nhận vehicleType) để hiện giá từng dòng.
  const loadAll = async (nextRoute) => {
    setLoadingAll(true);
    const results = await Promise.allSettled(vehicles.map(({ type }) => fetchQuote(type, nextRoute || {})));
    const map = {};
    results.forEach((result, index) => { if (result.status === "fulfilled") map[vehicles[index].type] = result.value; });
    setQuotes(map);
    setLoadingAll(false);
    const failed = results.find((result) => result.status === "rejected");
    if (!Object.keys(map).length && failed) setError(failed.reason?.status === 503 ? "Không có tài xế trong khu vực" : failed.reason?.message || "Không lấy được báo giá");
    return map;
  };

  useEffect(() => {
    if (!drop) return;
    let active = true;
    fetchRoute([pickup.lat, pickup.lng], [drop.lat, drop.lng]).catch(() => null).then((next) => {
      if (!active) return;
      setRoute(next);
      loadAll(next);
    });
    return () => { active = false; };
  }, [pickup, drop]);

  useEffect(() => {
    setSeconds(remaining(quote));
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
      const cached = quotes[type];
      if (cached && remaining(cached) > 0) setQuote(cached);
      else { const next = await requestQuote(type, route || {}); setQuotes((old) => ({ ...old, [type]: next })); }
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

  const refresh = async () => {
    setError("");
    const map = await loadAll(route);
    if (quote?.vehicleType) setQuote(map[quote.vehicleType] || null);
  };
  const selected = quoting ? pending : quote?.vehicleType;
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
          const item = active && quote && !quoting ? quote : quotes[type];
          const itemAmount = item?.priceSnapshot?.amount ?? item?.amount;
          const itemSurge = item?.priceSnapshot?.surgeMultiplier || item?.surgeMultiplier || 1;
          const itemEta = item?.priceSnapshot?.duration ? `~${parseInt(item.priceSnapshot.duration, 10)} phút` : eta;
          const label = (active && quoting) || (loadingAll && !item) ? "Đang tính…" : item ? money(itemAmount) || "—" : "Xem giá";
          return <button key={type} type="button" role="radio" aria-checked={active} className={`cx-vehicle${active ? " is-selected" : ""}`} disabled={quoting || !drop} onClick={() => choose(type)}>
            <span className="cx-vehicle-icon"><VehicleIcon type={type} /></span>
            <span className="cx-vehicle-name"><strong>{name}</strong><small>{seats}</small></span>
            <span className="cx-vehicle-price"><strong>{label}</strong><small>{item && itemSurge > 1 ? `Surge x${itemSurge}` : itemEta || ""}</small></span>
          </button>;
        })}
      </div>
      <label className="cx-pay-row"><Icon name={paymentMethod === "cash" ? "cash" : "wallet"} /><select className="cx-pay-select" aria-label="Phương thức thanh toán" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{payMethods.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><small>Đổi khi thanh toán</small><Icon name="chevronDown" size={18} /></label>
      {error && <p className="cx-alert" role="alert">{error}</p>}
      {quote && !seconds
        ? <button type="button" className="cx-btn cx-btn--secondary" disabled={quoting} onClick={refresh}>Làm mới báo giá</button>
        : <button type="button" className="cx-btn cx-btn--primary" disabled={quoting || !quote} onClick={book}>{quote ? "Đặt xe" : "Chọn loại xe để nhận báo giá"}</button>}
    </section>
  </main>;
}
