import { createContext, useContext, useMemo, useState } from "react";
import { isStandaloneMode, mockSession } from "@/config/runtime.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    if (isStandaloneMode) return mockSession;
    const saved = localStorage.getItem("cab_session");
    return saved ? JSON.parse(saved) : null;
  });

  const value = useMemo(
    () => ({
      session,
      setSession: (newSession) => {
        setSession(newSession);
        if (newSession) {
          localStorage.setItem("cab_session", JSON.stringify(newSession));
        } else {
          localStorage.removeItem("cab_session");
        }
      },
      clearSession: () => {
        setSession(null);
        localStorage.removeItem("cab_session");
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
