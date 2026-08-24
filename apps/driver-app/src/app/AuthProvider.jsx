import { createContext, useMemo, useState, useEffect } from "react";
import { isStandaloneMode, mockSession } from "@/config/runtime.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => {
    if (isStandaloneMode) return mockSession;
    try {
      const stored = localStorage.getItem("sessionData");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setSession = (newSession) => {
    if (newSession) {
      localStorage.setItem("sessionData", JSON.stringify(newSession));
    } else {
      localStorage.removeItem("sessionData");
      localStorage.removeItem("accessToken");
    }
    setSessionState(newSession);
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      setSession(null);
    };

    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

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
