import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CabButton, SurfaceState } from "@cab/web-shared";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mfa, setMfa] = useState("");
    const [recovery, setRecovery] = useState(false);
    const [challenge, setChallenge] = useState(null);
    const [error, setError] = useState("");
    const { login, verifyMfa } = useAuth();
    const nav = useNavigate();
    const setup = challenge?.mfaSetup;

    const submit = async () => {
        try {
            setError("");
            if (challenge) {
                await verifyMfa(recovery
                    ? { challengeToken: challenge.challengeToken, recoveryCode: mfa }
                    : { challengeToken: challenge.challengeToken, totpCode: mfa });
                nav("/");
                return;
            }

            const result = await login({ destination: email, password });
            if (result?.authStatus === "mfa_required") setChallenge(result);
            else nav("/");
        } catch (cause) {
            setError(cause.message);
        }
    };

    return <main className="ad-login"><section className="ad-login__brand"><span className="ad-logo ad-logo--xl">CAB</span><p>Hệ thống đặt xe toàn diện<br /><small>Khách hàng · Tài xế · Quản trị</small></p></section><section className="ad-login__form"><p className="ad-eyebrow">CAB · OPERATIONS</p><h1>Quản trị CAB</h1><p className="ad-lead">Đăng nhập an toàn để theo dõi hoạt động theo thời gian thực.</p><div className="ad-panel ad-login__card">
        <label>Email quản trị<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="ten@cab.vn" autoComplete="username" /></label>
        {!challenge ? <label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" /></label> : <>
            {setup && <section className="state" aria-label="Thiết lập MFA">
                <p>Thiết lập MFA lần đầu: thêm khóa này vào ứng dụng xác thực trước khi nhập mã.</p>
                {setup.totpSecret && <code>{setup.totpSecret}</code>}
                {setup.otpauthUrl && <p><a href={setup.otpauthUrl}>Mở ứng dụng xác thực</a></p>}
                {setup.recoveryCodes?.length > 0 && <p>Mã khôi phục: {setup.recoveryCodes.join(", ")}</p>}
            </section>}
            <label>{recovery ? "Mã khôi phục" : "Mã MFA 6 số"}<input value={mfa} onChange={event => setMfa(event.target.value)} placeholder={recovery ? "Nhập mã khôi phục" : "Nhập mã xác thực"} inputMode={recovery ? "text" : "numeric"} autoComplete="one-time-code" /></label>
            <label><input type="checkbox" checked={recovery} onChange={event => setRecovery(event.target.checked)} /> Dùng mã khôi phục</label>
        </>}
        <CabButton className="cab-full" onClick={submit}>{challenge ? "Xác minh MFA" : "Đăng nhập"}</CabButton>
        {error && <SurfaceState kind="error" detail={error} />}
    </div></section></main>;
}
