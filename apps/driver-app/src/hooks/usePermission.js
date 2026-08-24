import { useAuth } from "@/hooks/useAuth.js";
import { isStandaloneMode } from "@/config/runtime.js";

export function usePermission(allowedRoles = []) {
  const auth = useAuth();
  
  // In standalone mode, we still need to check if we are "logged in" (have a token)
  // unless we want to test the bypass.
  const token = localStorage.getItem("accessToken");

  if (isStandaloneMode) {
    // If we have a token, we can access everything in standalone mode
    // If not, we are unauthorized.
    return !!token;
  }

  const role = auth?.session?.role;

  if (allowedRoles.length === 0) {
    return true;
  }

  return Boolean(role && allowedRoles.includes(role));
}
