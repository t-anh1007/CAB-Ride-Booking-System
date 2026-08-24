import { createContext, useMemo, useState } from "react";
import { isStandaloneMode, mockSession } from "@/config/runtime.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => (isStandaloneMode ? mockSession : null));

  const value = useMemo(
    () => ({
      session,
      setSession,
      clearSession: () => setSession(null)
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
