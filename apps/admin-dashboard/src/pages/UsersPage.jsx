import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import DataState from "../components/DataState.jsx";

export default function UsersPage() {
    const { client } = useAuth();
    const [rows, setRows] = useState(null);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        client.get("/users")
            .then(result => {
                const payload = result.data || result;
                if (active) setRows(payload.items || payload);
            })
            .catch(cause => active && setError(cause.message));
        return () => { active = false; };
    }, [client]);

    const filtered = useMemo(() => Array.isArray(rows)
        ? rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
        : [], [rows, query]);

    return <section className="page cab-admin-page"><p className="cab-eyebrow">KHÁCH HÀNG</p><h1>Người dùng</h1>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm người dùng" aria-label="Tìm người dùng" />
        {error && <DataState error={error} />}
        {!error && !rows && <p className="muted">Đang tải…</p>}
        {Array.isArray(rows) && <table className="table"><thead><tr><th>Id</th><th>Tên</th><th>Số điện thoại</th></tr></thead><tbody>
            {filtered.map((row, index) => <tr key={row.userId || row.id || index}><td>{row.userId || row.id || "—"}</td><td>{row.fullName || row.name || "—"}</td><td>{row.phone || "—"}</td></tr>)}
        </tbody></table>}
    </section>;
}
