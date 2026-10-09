import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Icon } from "../components/Icons.jsx";

const savedKey = "cab.customer.saved-locations";
const unwrap = (result) => result?.data ?? result;
const localSaved = () => { try { return JSON.parse(localStorage.getItem(savedKey)) || []; } catch { return []; } };
const tabs = [["profile", "Hồ sơ", "user"], ["wallet", "Ví", "wallet"], ["settings", "Cài đặt", "settings"]];

export default function ProfilePage() {
  const { client, user, logout } = useAuth();
  const [profile, setProfile] = useState(user), [wallet, setWallet] = useState(null), [preferences, setPreferences] = useState(null), [saved, setSaved] = useState(localSaved), [tab, setTab] = useState("profile"), [error, setError] = useState("");
  useEffect(() => { let active = true; if (!user?.id) return; const requests = [["/users/" + user.id, setProfile], ["/users/" + user.id + "/wallet", setWallet], ["/users/" + user.id + "/preferences", setPreferences], ["/users/" + user.id + "/saved-locations", setSaved]]; Promise.allSettled(requests.map(([path]) => client.get(path))).then((results) => { if (!active) return; const failed = []; results.forEach((result, index) => { if (result.status === "fulfilled") { const value = unwrap(result.value); requests[index][1](Array.isArray(value?.locations) ? value.locations : value); } else failed.push(result.reason?.message || "dữ liệu"); }); setError(failed.length ? "Một số dữ liệu chưa khả dụng: " + failed.join(", ") : ""); }); return () => { active = false; }; }, [client, user?.id]);
  const name = profile?.name || profile?.phone || "Khách hàng CAB";
  const places = (Array.isArray(saved) ? saved : []).map((x) => x.label || x.name || String(x));
  return <main className="cx-page">
    <header className="cx-profile-hero">
      <span className="cx-avatar cx-avatar--lg" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <span><h1>{name}</h1><small>{profile?.email || profile?.phone || "Thành viên CAB"}</small></span>
    </header>
    <div className="cx-segment" role="tablist">{tabs.map(([value, label, icon]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}><Icon name={icon} size={16} />{label}</button>)}</div>
    <div className="cx-card cx-list">
      {tab === "profile" && <>
        <div className="cx-list-item"><span className="cx-list-icon"><Icon name="user" size={18} /></span><span className="cx-list-text"><small>Họ tên</small>{name}</span></div>
        <div className="cx-list-item"><span className="cx-list-icon"><Icon name="pin" size={18} /></span><span className="cx-list-text"><small>Địa điểm đã lưu</small>{places.join(", ") || "Chưa có"}</span></div>
      </>}
      {tab === "wallet" && <div className="cx-list-item"><span className="cx-list-icon"><Icon name="wallet" size={18} /></span><span className="cx-list-text"><small>Số dư</small>{wallet?.balance != null ? `${Number(wallet.balance).toLocaleString("vi-VN")}đ` : "Chưa khả dụng"}</span></div>}
      {tab === "settings" && <div className="cx-list-item"><span className="cx-list-icon"><Icon name="settings" size={18} /></span><span className="cx-list-text"><small>Tùy chọn</small>{preferences ? JSON.stringify(preferences) : "Chưa khả dụng"}</span></div>}
    </div>
    {error && <p className="cx-alert cx-alert--warning">{error}</p>}
    <button type="button" className="cx-btn cx-btn--danger-outline" onClick={logout}><Icon name="logout" size={18} />Đăng xuất</button>
  </main>;
}
