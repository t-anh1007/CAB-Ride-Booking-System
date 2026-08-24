import { isStandaloneMode } from "@/config/runtime.js";
import { env } from "@/config/env.js";

const realtimeBaseUrl = env.wsBaseUrl;

export function createRealtimeConnection({ client, token, onOpen, onMessage, onError, onClose }) {
  if (isStandaloneMode) {
    const mockSocket = {
      readyState: 1
    };

    queueMicrotask(() => {
      onOpen?.({ mock: true, type: "open" });
    });

    return {
      send(data) {
        onMessage?.(typeof data === "string" ? data : JSON.stringify(data), { mock: true, type: "message" });
      },
      close() {
        onClose?.({ mock: true, type: "close" });
      },
      socket: mockSocket
    };
  }

  const url = new URL("/realtime", realtimeBaseUrl);
  url.searchParams.set("client", client);

  if (token) {
    url.searchParams.set("token", token);
  }

  const socket = new WebSocket(url.toString());

  socket.onopen = onOpen || null;
  socket.onerror = onError || null;
  socket.onclose = onClose || null;
  socket.onmessage = (event) => {
    onMessage?.(event.data, event);
  };

  return {
    send(data) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    },
    close() {
      socket.close();
    },
    socket
  };
}
