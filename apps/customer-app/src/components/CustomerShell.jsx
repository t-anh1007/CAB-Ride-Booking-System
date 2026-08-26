import { NavLink, Outlet } from "react-router-dom";

export default function CustomerShell() {
  return <div className="mobile customer-shell">
    <header className="shell-head">
      <div className="shell-brand"><strong>C</strong><span>CAB</span></div>
      <span className="shell-status">Đi cùng bạn</span>
    </header>
    <Outlet />
    <nav className="shell-nav" aria-label="Điều hướng khách hàng">
      <NavLink to="/home">Đặt xe</NavLink>
      <NavLink to="/history">Lịch sử</NavLink>
      <NavLink to="/profile">Tài khoản</NavLink>
    </nav>
  </div>;
}
