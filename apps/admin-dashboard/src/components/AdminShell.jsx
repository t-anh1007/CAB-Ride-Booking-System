import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Icon } from "./ui.jsx";

const links = [
  ["/", "Tổng quan", "home"],
  ["/rides", "Chuyến xe", "car"],
  ["/drivers", "Tài xế", "driver"],
  ["/users", "Khách hàng", "users"],
  ["/map", "Bản đồ trực tiếp", "map"],
  ["/surge", "Khu vực & Giá", "zone"],
  ["/audit", "Nhật ký kiểm toán", "audit"],
];

export default function AdminShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };
  const name = user?.fullName || user?.name || "Admin";

  return <div className={`admin${open ? " is-open" : ""}`}>
    <header className="ad-mobilebar">
      <button type="button" className="ad-iconbtn" onClick={() => setOpen(true)} aria-label="Mở menu"><Icon name="menu" /></button>
      <span className="ad-logo">CAB</span>
      <span className="ad-avatar" aria-hidden="true">{name[0]}</span>
    </header>
    {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}
    <aside className="ad-sidebar">
      <div className="ad-sidebar__top">
        <span className="ad-logo">CAB</span>
        <button type="button" className="ad-iconbtn ad-sidebar__close" onClick={() => setOpen(false)} aria-label="Đóng menu"><Icon name="close" /></button>
      </div>
      <nav>{links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === "/"}><Icon name={icon} size={18} />{label}</NavLink>)}</nav>
      <div className="ad-sidebar__foot">
        <div className="ad-me"><span className="ad-avatar">{name[0]}</span><div><strong>{name}</strong><small>Quản trị viên</small></div></div>
        <button type="button" className="ad-logout" onClick={signOut}><Icon name="logout" size={18} />Đăng xuất</button>
      </div>
    </aside>
    <main><Outlet /></main>
  </div>;
}
