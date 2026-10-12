import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CarIllustration } from "../components/Icons.jsx";

const key = "cab.customer.onboarding.complete";

export default function OnboardingPage() {
  const nav = useNavigate();
  useEffect(() => { if (localStorage.getItem(key) === "true") nav("/login", { replace: true }); }, [nav]);
  const done = () => { localStorage.setItem(key, "true"); nav("/login"); };

  return <main className="cx-auth cx-onboarding">
    <div className="cx-auth-brand"><span className="cx-logo">CAB</span><small>Hệ thống đặt xe toàn diện</small></div>
    <section className="cx-card cx-auth-card">
      <CarIllustration />
      <h1>Đi an tâm,<br />đến đúng lúc.</h1>
      <p className="cx-sub">Một chuyến đi rõ ràng từ điểm đón đến thanh toán.</p>
      <ol className="cx-steps-list" aria-label="Cách CAB hoạt động">
        <li><b>1</b><span><strong>Chọn điểm đến</strong><small>Điều chỉnh vị trí trên bản đồ</small></span></li>
        <li><b>2</b><span><strong>Chọn loại xe</strong><small>Báo giá minh bạch trước khi đặt</small></span></li>
        <li><b>3</b><span><strong>Theo dõi chuyến đi</strong><small>Nhận trạng thái tài xế trực tiếp</small></span></li>
      </ol>
      <button type="button" className="cx-btn cx-btn--primary" onClick={done}>Bắt đầu</button>
      <Link className="cx-btn cx-btn--text" to="/login">Đã dùng CAB? Đăng nhập</Link>
    </section>
  </main>;
}
