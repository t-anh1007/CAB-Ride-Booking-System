import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";

const links = [["/", "Tổng quan"], ["/users", "Người dùng"], ["/drivers", "Tài xế"], ["/rides", "Chuyến đi"], ["/map", "Bản đồ"], ["/surge", "Surge"], ["/audit", "Audit"]];

export default function AdminShell() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const signOut = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return <div className="admin"><aside><h2>CAB Ops</h2>
        {links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>)}
        <button type="button" onClick={signOut}>Đăng xuất</button>
    </aside><main><Outlet /></main></div>;
}
