import { NavLink, Outlet } from "react-router-dom";

export default function DriverShell() {
  return <div className="mobile driver-shell"><header className="shell-head"><div className="shell-brand"><strong>C</strong><span>CAB Driver</span></div><span className="shell-status">Đối tác</span></header><Outlet /><nav className="shell-nav" aria-label="Điều hướng tài xế"><NavLink to="/home">Trang chủ</NavLink><NavLink to="/earnings">Thu nhập</NavLink><NavLink to="/history">Lịch sử</NavLink><NavLink to="/profile">Hồ sơ</NavLink></nav></div>;
}
