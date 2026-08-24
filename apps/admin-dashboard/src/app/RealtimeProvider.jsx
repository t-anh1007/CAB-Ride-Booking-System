import { createContext, useCallback, useMemo, useState } from "react";
import { createRealtimeConnection } from "@/services/realtime.service.js";

export const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const [connection, setConnection] = useState(null);
  const [status, setStatus] = useState("idle");

  const disconnect = useCallback(() => {
    setConnection((currentConnection) => {
      currentConnection?.close();
      return null;
    });
    setStatus("closed");
  }, []);

  const connect = useCallback(
    (options) => {
      disconnect();
      setStatus("connecting");

      const nextConnection = createRealtimeConnection({
        ...options,
        onOpen: (event) => {
          setStatus("open");
          options?.onOpen?.(event);
        },
        onClose: (event) => {
          setStatus("closed");
          options?.onClose?.(event);
        },
        onError: (event) => {
          setStatus("error");
          options?.onError?.(event);
        }
      });

      setConnection(nextConnection);
      return nextConnection;
    },
    [disconnect]
  );

  const send = useCallback(
    (data) => {
      connection?.send(data);
    },
    [connection]
  );

  const value = useMemo(
    () => ({
      connection,
      connect,
      disconnect,
      send,
      status
    }),
    [connect, connection, disconnect, send, status]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
