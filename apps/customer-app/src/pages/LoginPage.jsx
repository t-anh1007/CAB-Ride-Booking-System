import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CabButton, SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function LoginPage() {
  const [identity, setIdentity] = useState(""); const [otp, setOtp] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const { requestOtp, verifyOtp } = useAuth(); const nav = useNavigate();
  const send = async () => { setBusy(true); setError(""); try { await requestOtp(identity); setSent(true); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); setError(""); try { await verifyOtp(identity, otp); nav("/home"); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  return <main className="page cab-auth-page"><p className="cab-eyebrow">KHÁCH HÀNG CAB</p><h1>Chào mừng bạn trở lại</h1><p className="cab-lead">Nhập thông tin để nhận mã xác thực một lần.</p><section className="card cab-auth-card"><label>Số điện thoại hoặc email<input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="090..." autoComplete="username" /></label>{sent ? <label>Mã OTP 6 số<input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength="6" /></label> : null}<CabButton className="cab-full" onClick={sent ? verify : send} busy={busy} disabled={!identity || (sent && !otp)}>{sent ? "Xác minh OTP" : "Gửi mã OTP"}</CabButton>{error ? <SurfaceState kind="error" detail={error} /> : null}</section></main>;
}
