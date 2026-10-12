import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useBooking } from "../providers/BookingProvider.jsx";
import { Icon } from "../components/Icons.jsx";

const amountFromRide = (ride) => typeof ride?.priceSnapshot === "number" ? ride.priceSnapshot : ride?.priceSnapshot?.amount ?? ride?.fare?.amount ?? ride?.amount;
const terminal = new Set(["COMPLETED", "FAILED", "COMPENSATED"]);
const methods = [["cash", "Tiền mặt", "cash"], ["card", "Thẻ", "wallet"], ["wallet", "Ví", "wallet"]];
const statusView = { COMPLETED: ["cx-chip--success", "Thành công"], FAILED: ["cx-chip--danger", "Lỗi"], COMPENSATED: ["cx-chip--neutral", "Đã hoàn tiền"] };

export default function PaymentPage() {
  const { id } = useParams(), nav = useNavigate(); const { client, user } = useAuth(); const { paymentMethod } = useBooking();
  const [method, setMethod] = useState(paymentMethod || "cash"), [ride, setRide] = useState(null), [payment, setPayment] = useState(null), [attempts, setAttempts] = useState(0), [note, setNote] = useState(""), [error, setError] = useState("");
  useEffect(() => { let active = true; client.get("/rides/" + id).then((result) => active && setRide(result.data || result)).catch((e) => active && setError(e.message)); return () => { active = false; }; }, [client, id]);
  useEffect(() => { const paymentId = payment?.paymentId; if (!paymentId || terminal.has(payment.status)) return; if (attempts >= 15) { setNote("Thanh toán vẫn đang chờ xác nhận. Bạn có thể quay lại kiểm tra sau."); return; } const timer = setTimeout(async () => { try { const result = await client.get("/payments/" + paymentId); setPayment(result.data || result); setAttempts((value) => value + 1); } catch (e) { setError(e.message); } }, 2000); return () => clearTimeout(timer); }, [client, payment?.paymentId, payment?.status, attempts]);
  const pay = async () => { const amount = Math.round(Number(amountFromRide(ride))); if (!user?.id || !Number.isInteger(amount) || amount <= 0) { setError("Không thể xác định thông tin chuyến đi hợp lệ để thanh toán."); return; } try { setError(""); setNote(""); setAttempts(0); const createdResult = await client.post("/payments", { rideId: id, userId: user?.id, amount, method }, { idempotent: true }); const created = createdResult.data || createdResult; const confirmed = method === "cash" ? await client.post("/payments/" + created.paymentId + "/confirm", { outcome: "success" }, { idempotent: true }) : created; setPayment(confirmed.data || confirmed); } catch (e) { setError(e.message); } };
  const amount = amountFromRide(ride);
  const [chipClass, chipText] = statusView[payment?.status] || (payment ? ["cx-chip--progress", "Đang xử lý"] : ["cx-chip--neutral", "Chưa tạo thanh toán"]);
  return <main className="cx-page">
    <header className="cx-page-head"><h1>Thanh toán</h1><span className={`cx-chip ${chipClass}`}>{chipText}</span></header>
    <div className="cx-card cx-total">
      <small>Tổng tiền chuyến đi</small>
      <strong>{ride ? (amount != null ? `${Number(amount).toLocaleString("vi-VN")}đ` : "—") : "Đang tải…"}</strong>
      {!ride && !error ? <p className="cx-empty-text" role="status">Đang tải chi tiết chuyến đi…</p> : null}
    </div>
    <p className="cx-section-label">Phương thức thanh toán</p>
    <div className="cx-card cx-list" role="radiogroup" aria-label="Phương thức thanh toán">
      {methods.map(([value, label, icon]) => <button key={value} type="button" role="radio" aria-checked={method === value} className={`cx-list-item${method === value ? " is-selected" : ""}`} onClick={() => setMethod(value)}><span className="cx-list-icon"><Icon name={icon} size={18} /></span><span className="cx-list-text">{label}</span><span className="cx-radio" aria-hidden="true" /></button>)}
    </div>
    {note && <p className="cx-alert cx-alert--warning">{note}</p>}
    {error && <p className="cx-alert" role="alert">{error}</p>}
    <div className="cx-stack">
      <button type="button" className="cx-btn cx-btn--primary" disabled={!ride} onClick={pay}>Thanh toán</button>
      {payment?.status === "COMPLETED" && <button type="button" className="cx-btn cx-btn--mint" onClick={() => nav("/rating/" + id)}>Đánh giá tài xế</button>}
      {payment?.status === "FAILED" && <button type="button" className="cx-btn cx-btn--secondary" onClick={pay}>Thử lại</button>}
    </div>
  </main>;
}
