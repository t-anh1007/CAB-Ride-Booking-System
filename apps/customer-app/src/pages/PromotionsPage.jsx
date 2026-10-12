import { Link } from "react-router-dom";
import { Icon } from "../components/Icons.jsx";

export default function PromotionsPage() {
  return <main className="cx-page">
    <header className="cx-page-head"><h1>Ưu đãi</h1></header>
    <div className="cx-card cx-empty">
      <Icon name="gift" size={32} />
      <p><strong>Chưa có ưu đãi</strong></p>
      <p>Hiện chưa có chương trình khuyến mãi nào dành cho bạn.</p>
      <Link to="/home" className="cx-btn cx-btn--secondary">Đặt xe ngay</Link>
    </div>
  </main>;
}
