import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function LoginPage() {
  const [phone, setPhone] = useState(""); const [otp, setOtp] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const { requestOtp, verifyOtp } = useAuth(); const nav = useNavigate();
  const submit = async () => { setBusy(true); setError(""); try { if (!sent) { await requestOtp(phone); setSent(true); } else { await verifyOtp(phone, otp); nav("/home"); } } catch (event) { setError(event.message); } finally { setBusy(false); } };
  return <main className="drv-auth">
    <div className="drv-auth__hero">
      <span className="drv-logo">CAB</span>
      <p className="drv-auth__eyebrow">Tài xế</p>
      <h1>Sẵn sàng nhận chuyến?</h1>
      <p>Đăng nhập để bật trạng thái hoạt động và kết nối hành khách.</p>
    </div>
    <form className="drv-sheet drv-auth__card" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label className="drv-field">Số điện thoại<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" autoComplete="tel" inputMode="tel" /></label>
      {sent ? <label className="drv-field">Mã OTP 6 số<input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Mã OTP" inputMode="numeric" autoComplete="one-time-code" /></label> : null}
      <button type="submit" className="drv-btn drv-btn--dark" aria-busy={busy || undefined} disabled={busy || !phone || (sent && !otp)}>{busy ? "Đang xử lý…" : sent ? "Xác minh OTP" : "Gửi OTP"}</button>
      {sent ? <p className="drv-muted drv-small drv-center">Mã OTP đã được gửi tới {phone}.</p> : null}
      {error ? <SurfaceState kind="error" detail={error} /> : null}
    </form>
  </main>;
}
