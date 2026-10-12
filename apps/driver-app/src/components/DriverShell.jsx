import { NavLink, Outlet } from "react-router-dom";
import Icon from "./Icon.jsx";

const tabs = [["/home", "home", "Trang chủ"], ["/earnings", "wallet", "Thu nhập"], ["/history", "list", "Hoạt động"], ["/profile", "user", "Tài khoản"]];

export default function DriverShell() {
  return <div className="driver-shell">
    <Outlet />
    <nav className="drv-tabbar" aria-label="Điều hướng tài xế">
      <span className="drv-tabbar__brand" aria-hidden="true">CAB</span>
      {tabs.map(([to, icon, label]) => <NavLink key={to} to={to}><Icon name={icon} /><span>{label}</span></NavLink>)}
    </nav>
  </div>;
}
