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

    return <main className="page cab-admin-login"><p className="cab-eyebrow">CAB · OPERATIONS</p><h1>Quản trị CAB</h1><p className="cab-lead">Đăng nhập an toàn để theo dõi hoạt động theo thời gian thực.</p><div className="card">
        <input value={email} onChange={event => setEmail(event.target.value)} placeholder="Email quản trị" autoComplete="username" />
        {!challenge ? <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mật khẩu" autoComplete="current-password" /> : <>
            {setup && <section className="state" aria-label="Thiết lập MFA">
                <p>Thiết lập MFA lần đầu: thêm khóa này vào ứng dụng xác thực trước khi nhập mã.</p>
                {setup.totpSecret && <code>{setup.totpSecret}</code>}
                {setup.otpauthUrl && <p><a href={setup.otpauthUrl}>Mở ứng dụng xác thực</a></p>}
                {setup.recoveryCodes?.length > 0 && <p>Mã khôi phục: {setup.recoveryCodes.join(", ")}</p>}
            </section>}
            <input value={mfa} onChange={event => setMfa(event.target.value)} placeholder={recovery ? "Mã khôi phục" : "Mã MFA 6 số"} />
            <label><input type="checkbox" checked={recovery} onChange={event => setRecovery(event.target.checked)} /> Dùng mã khôi phục</label>
        </>}
        <CabButton className="cab-full" onClick={submit}>{challenge ? "Xác minh MFA" : "Đăng nhập"}</CabButton>
        {error && <SurfaceState kind="error" detail={error} />}
    </div></main>;
}
