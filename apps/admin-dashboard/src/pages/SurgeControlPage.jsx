import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { DemoNote, Loading, PageHead, Panel } from "../components/ui.jsx";
import { MapLegend } from "../components/OpsMap.jsx";
import { levelColors } from "../data/demo.js";

const levelOf = (m) => (m > 2 ? 3 : m >= 1.6 ? 2 : m >= 1.2 ? 1 : 0);

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

    const level = data ? levelOf(Number(data.surgeMultiplier) || 1) : 0;
    return <section className="ad-page"><PageHead eyebrow="ĐỊNH GIÁ THEO KHU VỰC" title="Khu vực & Giá" />
        <div className="ad-split">
            <Panel title="Hệ số surge">
                <label className="ad-field">Vùng<input value={zone} onChange={event => setZone(event.target.value)} aria-label="Vùng forecast" /></label>
                {error && <DemoNote>Không tải được surge ({error}).</DemoNote>}
                {!error && !data && <Loading text="Đang tải trạng thái surge…" />}
                {data && <div className="ad-surge">
                    <strong style={{ color: level ? levelColors[level] : undefined }}>{data.surgeMultiplier}x</strong>
                    <div className="ad-surge__stats"><div><small>Cung</small><b>{data.supplyCount ?? 0}</b></div><div><small>Cầu</small><b>{data.demandCount ?? 0}</b></div></div>
                    <p className="ad-foot">Nguồn: {data.surgeSource}. Chỉ đọc; quy tắc giá được quản lý bởi pricing service.</p>
                </div>}
            </Panel>
            <Panel title="Thang màu" className="ad-panel--legend"><MapLegend /></Panel>
        </div>
    </section>;
}
