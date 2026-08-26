import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import DataState from "../components/DataState.jsx";

export default function SurgeControlPage() {
    const { client } = useAuth();
    const [zone, setZone] = useState("central");
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        setData(null);
        setError("");
        client.get(`/pricing/surge?zone=${encodeURIComponent(zone)}`)
            .then(result => active && setData(result.data || result))
            .catch(cause => active && setError(cause.message));
        return () => { active = false; };
    }, [client, zone]);

    return <section><h1>Surge khu vực</h1><div className="card">
        <label>Vùng <input value={zone} onChange={event => setZone(event.target.value)} aria-label="Vùng forecast" /></label>
        {error && <DataState error={error} />}
        {!error && !data && <p className="muted">Đang tải trạng thái surge…</p>}
        {data && <><p>Hệ số surge: <strong>{data.surgeMultiplier}x</strong></p>
            <p>Cung: {data.supplyCount ?? 0} · Cầu: {data.demandCount ?? 0}</p>
            <p className="muted">Nguồn: {data.surgeSource}. Chỉ đọc; quy tắc giá được quản lý bởi pricing service.</p>
        </>}
    </div></section>;
}
