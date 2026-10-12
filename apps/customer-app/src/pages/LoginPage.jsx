import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function LoginPage() {
  const [identity, setIdentity] = useState(""); const [otp, setOtp] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const { requestOtp, verifyOtp } = useAuth(); const nav = useNavigate();
  const send = async () => { setBusy(true); setError(""); try { await requestOtp(identity); setSent(true); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); setError(""); try { await verifyOtp(identity, otp); nav("/home"); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  return <main className="cx-auth">
    <div className="cx-auth-brand"><span className="cx-logo">CAB</span><small>Khách hàng</small></div>
    <section className="cx-card cx-auth-card">
      <h1>{sent ? "Nhập mã xác thực" : "Chào mừng bạn trở lại"}</h1>
      <p className="cx-sub">{sent ? `Mã OTP 6 số đã được gửi tới ${identity}.` : "Nhập số điện thoại hoặc email để nhận mã xác thực một lần."}</p>
      <label className="cx-field">Số điện thoại hoặc email<input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="090..." autoComplete="username" disabled={sent && busy} /></label>
      {sent ? <label className="cx-field">Mã OTP 6 số<input className="cx-otp" value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength="6" placeholder="••••••" /></label> : null}
      <button type="button" className="cx-btn cx-btn--primary" onClick={sent ? verify : send} disabled={busy || !identity || (sent && !otp)} aria-busy={busy || undefined}>{busy ? "Đang xử lý…" : sent ? "Xác minh OTP" : "Gửi mã OTP"}</button>
      {sent ? <button type="button" className="cx-btn cx-btn--text" onClick={send} disabled={busy}>Gửi lại mã</button> : null}
      {error ? <SurfaceState kind="error" detail={error} /> : null}
    </section>
  </main>;
}
