import { useAuth } from "@/hooks/useAuth.js";
import { isStandaloneMode } from "@/config/runtime.js";

export function usePermission(allowedRoles = []) {
  if (isStandaloneMode) {
    return true;
  }

  const auth = useAuth();
  const role = auth?.session?.role;

  if (allowedRoles.length === 0) {
    return true;
  }

  return Boolean(role && allowedRoles.includes(role));
}
