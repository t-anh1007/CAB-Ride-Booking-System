import { useContext } from "react";
import { AuthContext } from "@app/AuthProvider.jsx";

export function useAuth() {
  return useContext(AuthContext);
}
