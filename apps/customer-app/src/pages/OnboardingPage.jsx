import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CabButton } from "@cab/web-shared";

const key = "cab.customer.onboarding.complete";

export default function OnboardingPage() {
  const nav = useNavigate();
  useEffect(() => { if (localStorage.getItem(key) === "true") nav("/login", { replace: true }); }, [nav]);
  const done = () => { localStorage.setItem(key, "true"); nav("/login"); };

  return <main className="page cab-onboarding">
    <p className="cab-eyebrow">CAB · ĐẶT XE TOÀN DIỆN</p>
    <h1>Đi an tâm,<br />đến đúng lúc.</h1>
    <p className="cab-lead">Một chuyến đi rõ ràng từ điểm đón đến thanh toán.</p>
    <section className="cab-flow-card" aria-label="Cách CAB hoạt động">
      <div><b>01</b><span><strong>Chọn điểm đến</strong><small>Điều chỉnh vị trí trên bản đồ</small></span></div>
      <div><b>02</b><span><strong>Chọn loại xe</strong><small>Báo giá minh bạch trước khi đặt</small></span></div>
      <div><b>03</b><span><strong>Theo dõi chuyến đi</strong><small>Nhận trạng thái tài xế trực tiếp</small></span></div>
    </section>
    <CabButton className="cab-full" onClick={done}>Bắt đầu</CabButton>
    <Link className="cab-login-link" to="/login">Đã dùng CAB? Đăng nhập</Link>
  </main>;
}
