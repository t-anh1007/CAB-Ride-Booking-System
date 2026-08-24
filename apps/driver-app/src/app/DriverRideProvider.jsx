import { createContext, useContext, useMemo, useState, useCallback } from "react";

export const DriverRideContext = createContext(null);

export function DriverRideProvider({ children }) {
  const [currentRide, setCurrentRide] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState("OFFLINE");

  const value = useMemo(
    () => ({
      currentRide,
      setCurrentRide,
      onlineStatus,
      setOnlineStatus
    }),
    [currentRide, onlineStatus]
  );

  return <DriverRideContext.Provider value={value}>{children}</DriverRideContext.Provider>;
}

export function useDriverRide() {
  const context = useContext(DriverRideContext);
  if (!context) {
    throw new Error("useDriverRide must be used within a DriverRideProvider");
  }
  return context;
}
