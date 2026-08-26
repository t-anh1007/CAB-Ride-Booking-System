import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CabButton, SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function LoginPage() {
  const [phone, setPhone] = useState(""); const [otp, setOtp] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const { requestOtp, verifyOtp } = useAuth(); const nav = useNavigate();
  const submit = async () => { setBusy(true); setError(""); try { if (!sent) { await requestOtp(phone); setSent(true); } else { await verifyOtp(phone, otp); nav("/home"); } } catch (event) { setError(event.message); } finally { setBusy(false); } };
  return <main className="page cab-auth-page"><p className="cab-eyebrow">TÀI XẾ CAB</p><h1>Sẵn sàng nhận chuyến?</h1><p className="cab-lead">Đăng nhập để bật trạng thái hoạt động và kết nối hành khách.</p><section className="card cab-auth-card"><label>Số điện thoại<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" autoComplete="tel" /></label>{sent ? <label>Mã OTP 6 số<input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Mã OTP" inputMode="numeric" autoComplete="one-time-code" /></label> : null}<CabButton className="cab-full" onClick={submit} busy={busy} disabled={!phone || (sent && !otp)}>{sent ? "Xác minh OTP" : "Gửi OTP"}</CabButton>{error ? <SurfaceState kind="error" detail={error} /> : null}</section></main>;
}
