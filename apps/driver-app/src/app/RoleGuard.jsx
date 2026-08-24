import { Navigate, useLocation } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission.js";

export function RoleGuard({ allowedRoles, children }) {
  const canAccess = usePermission(allowedRoles);
  const location = useLocation();

  if (!canAccess) {
    return <Navigate to="/driver/auth/login" state={{ from: location }} replace />;
  }

  return children;
}
