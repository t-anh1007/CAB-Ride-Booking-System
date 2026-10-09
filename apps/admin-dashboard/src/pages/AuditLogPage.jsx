import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Chip, DemoNote, Loading, PageHead, Panel } from "../components/ui.jsx";
import { demoAudit } from "../data/demo.js";

export default function AuditLogPage() {
    const { client } = useAuth();
    const [entries, setEntries] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        client.get("/auth/admin/audit?limit=25")
            .then(result => {
                const payload = result.data || result;
                if (active) setEntries(payload.items || []);
            })
            .catch(cause => active && setError(cause.message));
        return () => { active = false; };
    }, [client]);

    const list = error ? demoAudit : entries;
    return <section className="ad-page"><PageHead eyebrow="HOẠT ĐỘNG HỆ THỐNG" title="Nhật ký kiểm toán" />
        {error && <DemoNote>Không tải được nhật ký ({error}). Đang hiển thị dữ liệu minh họa.</DemoNote>}
        {!error && !entries && <Loading />}
        {list && <Panel><div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>Thời điểm</th><th>Sự kiện</th><th>Trạng thái</th></tr></thead><tbody>
            {!list.length && <tr><td colSpan="3" className="ad-empty">Chưa có sự kiện audit.</td></tr>}
            {list.map(entry => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.eventType}</td><td><Chip status={entry.eventStatus} /></td></tr>)}
        </tbody></table></div></Panel>}
    </section>;
}
