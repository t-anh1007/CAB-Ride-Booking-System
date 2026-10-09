import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon } from "./Icons.jsx";

const bookingPaths = ["/home", "/destination", "/options", "/searching", "/tracking", "/payment", "/rating"];

export default function CustomerShell() {
  const { pathname } = useLocation();
  const inBooking = bookingPaths.some((path) => pathname.startsWith(path));
  return <div className="cx-shell">
    <Outlet />
    <nav className="cx-tabbar" aria-label="Điều hướng khách hàng">
      <NavLink to="/home" className={inBooking ? "active" : undefined}><Icon name="home" /><span>Trang chủ</span></NavLink>
      <NavLink to="/history"><Icon name="activity" /><span>Hoạt động</span></NavLink>
      <NavLink to="/promotions"><Icon name="gift" /><span>Ưu đãi</span></NavLink>
      <NavLink to="/profile"><Icon name="user" /><span>Tài khoản</span></NavLink>
    </nav>
  </div>;
}
