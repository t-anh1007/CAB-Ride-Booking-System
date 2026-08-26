import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import DataState from "../components/DataState.jsx";

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

    return <section><h1>Nhật ký audit</h1>
        {error && <DataState error={error} />}
        {!error && !entries && <p className="muted">Đang tải…</p>}
        {entries && <table className="table"><thead><tr><th>Thời điểm</th><th>Sự kiện</th><th>Trạng thái</th></tr></thead><tbody>
            {entries.map(entry => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.eventType}</td><td>{entry.eventStatus}</td></tr>)}
        </tbody></table>}
    </section>;
}
