import { useAuth } from "../providers/AuthProvider.jsx";
import Icon from "../components/Icon.jsx";

export default function DriverProfilePage() {
  const { user, logout } = useAuth();
  const name = user?.name || user?.phone || user?.destination || "Đối tác CAB";
  return <main className="drv-page">
    <header className="drv-page__head"><h1>Tài khoản</h1></header>
    <section className="drv-sheet drv-profile">
      <span className="drv-avatar drv-avatar--lg" aria-hidden="true">{String(name).trim().charAt(0).toUpperCase()}</span>
      <div><strong>{name}</strong><span className="drv-muted drv-small">Tài xế đối tác</span></div>
    </section>
    <button type="button" className="drv-btn drv-btn--outline-danger" onClick={logout}><Icon name="logout" /> Đăng xuất</button>
  </main>;
}
