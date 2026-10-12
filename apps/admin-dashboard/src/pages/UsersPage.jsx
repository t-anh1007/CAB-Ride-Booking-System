import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { DemoNote, Icon, Loading, PageHead, Panel } from "../components/ui.jsx";
import { demoUsers } from "../data/demo.js";

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

    const source = error ? demoUsers : rows;
    const filtered = useMemo(() => Array.isArray(source)
        ? source.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
        : [], [source, query]);

    return <section className="ad-page">
        <PageHead eyebrow="KHÁCH HÀNG" title="Người dùng">
            <label className="ad-search"><Icon name="search" size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm người dùng" aria-label="Tìm người dùng" /></label>
        </PageHead>
        {error && <DemoNote>Không tải được người dùng ({error}). Đang hiển thị dữ liệu minh họa.</DemoNote>}
        {!error && !rows && <Loading />}
        {Array.isArray(source) && <Panel><div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>Mã</th><th>Tên</th><th>Số điện thoại</th></tr></thead><tbody>
            {!filtered.length && <tr><td colSpan="3" className="ad-empty">Không tìm thấy người dùng phù hợp.</td></tr>}
            {filtered.map((row, index) => { const name = row.fullName || row.name || "—"; return <tr key={row.userId || row.id || index}><td className="ad-mono">{row.userId || row.id || "—"}</td><td><span className="ad-person"><span className="ad-avatar ad-avatar--sm">{name[0]}</span>{name}</span></td><td>{row.phone || "—"}</td></tr>; })}
        </tbody></table></div></Panel>}
    </section>;
}
