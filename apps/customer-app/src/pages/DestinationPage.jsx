import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchAddress } from "@cab/web-shared";
import { useBooking } from "../providers/BookingProvider.jsx";
import { Icon } from "../components/Icons.jsx";

const key = "cab.customer.recent.destinations";
const load = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };

export default function DestinationPage() {
  const [q, setQ] = useState(""), [rows, setRows] = useState([]), [recent, setRecent] = useState(load), [error, setError] = useState("");
  const { pickup, setDrop } = useBooking(), nav = useNavigate();
  useEffect(() => { if (q.trim().length < 3) { setRows([]); return; } const id = setTimeout(() => searchAddress(q).then(setRows).catch((e) => setError(e.message)), 800); return () => clearTimeout(id); }, [q]);
  const choose = (row) => { const next = [row, ...recent.filter((x) => x.label !== row.label)].slice(0, 5); localStorage.setItem(key, JSON.stringify(next)); setRecent(next); setDrop(row); nav("/options"); };
  const list = rows.length ? rows : recent;
  return <main className="cx-page">
    <header className="cx-page-head"><button type="button" className="cx-icon-btn" onClick={() => nav("/home")} aria-label="Quay lại"><Icon name="back" /></button><h1>Điểm đến</h1></header>
    <div className="cx-card cx-route-card cx-route-card--input">
      <div className="cx-route-row"><span className="cx-dot cx-dot--pickup" /><span className="cx-route-text"><small>Điểm đón</small><strong>{pickup.label}</strong></span></div>
      <label className="cx-route-row cx-search"><span className="cx-dot cx-dot--drop" /><span className="cx-route-text"><small>Nhập điểm đến</small><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên đường, địa điểm hoặc địa chỉ" /></span><Icon name="search" size={18} /></label>
    </div>
    {error && <p className="cx-alert" role="alert">Không thể tìm địa chỉ: {error}</p>}
    <p className="cx-section-label">{rows.length ? "Kết quả tìm kiếm" : "Điểm đến gần đây"}</p>
    <div className="cx-card cx-list">
      {list.map((row) => <button type="button" key={row.label} className="cx-list-item" onClick={() => choose(row)}><span className="cx-list-icon"><Icon name={rows.length ? "pin" : "clock"} size={18} /></span><span className="cx-list-text">{row.label}</span><Icon name="chevron" size={16} /></button>)}
      {!list.length && <p className="cx-empty-text" role="status">{q.trim().length >= 3 ? "Đang tìm địa chỉ…" : "Nhập ít nhất 3 ký tự để tìm điểm đến."}</p>}
    </div>
  </main>;
}
