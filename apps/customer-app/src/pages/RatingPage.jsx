import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function RatingPage() {
  const { id } = useParams(), nav = useNavigate(); const { client, user } = useAuth();
  const [rating, setRating] = useState(5), [comment, setComment] = useState(""), [ride, setRide] = useState(null), [note, setNote] = useState("");
  useEffect(() => { let active = true; client.get("/rides/" + id).then((result) => active && setRide(result.data || result)).catch((e) => active && setNote(e.message)); return () => { active = false; }; }, [client, id]);
  const submit = async () => { const driverId = ride?.driverId || ride?.driver_id; if (!user?.id || !driverId) { setNote("Chưa thể xác định tài xế của chuyến đi này."); return; } try { await client.post("/reviews", { rideId: id, userId: user?.id, driverId, rating, comment }); setNote("Cảm ơn đánh giá của bạn"); } catch (e) { setNote(e.status === 409 ? "Bạn đã đánh giá chuyến này" : e.message); } };
  return <main className="cx-page">
    <header className="cx-page-head"><h1>Đánh giá chuyến đi</h1></header>
    <div className="cx-card cx-rating-card">
      <span className="cx-avatar cx-avatar--lg" aria-hidden="true">★</span>
      <p className="cx-sub">Chuyến đi của bạn thế nào?</p>
      <div className="cx-stars cx-stars--lg" role="radiogroup" aria-label="Số sao đánh giá">{[1, 2, 3, 4, 5].map((x) => <button key={x} type="button" role="radio" aria-checked={rating === x} aria-label={`${x} sao`} className={x <= rating ? "is-on" : ""} onClick={() => setRating(x)}>★</button>)}</div>
      <label className="cx-field">Nhận xét<textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Chia sẻ trải nghiệm" /></label>
      {note && <p className="cx-alert cx-alert--info" role="status">{note}</p>}
      <button type="button" className="cx-btn cx-btn--primary" disabled={!ride} onClick={submit}>Gửi đánh giá</button>
      <button type="button" className="cx-btn cx-btn--text" onClick={() => nav("/home")}>Về trang chủ</button>
    </div>
  </main>;
}
