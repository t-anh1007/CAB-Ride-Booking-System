import { usePermission } from "@/hooks/usePermission.js";

export function RoleGuard({ allowedRoles, children }) {
  const canAccess = usePermission(allowedRoles);

  if (!canAccess) {
    return null;
  }

  return children;
}
