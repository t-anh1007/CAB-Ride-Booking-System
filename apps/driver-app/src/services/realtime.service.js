import { isStandaloneMode } from "@/config/runtime.js";
import { env } from "@/config/env.js";

const realtimeBaseUrl = env.wsBaseUrl;

export function createRealtimeConnection({ client, token, onOpen, onMessage, onError, onClose }) {
  if (isStandaloneMode) {
    const mockSocket = {
      readyState: 1,
      addEventListener: (type, listener) => {
        console.log(`[Standalone] Added listener for ${type}`);
      },
      removeEventListener: (type, listener) => {
        console.log(`[Standalone] Removed listener for ${type}`);
      }
    };

    queueMicrotask(() => {
      onOpen?.({ mock: true, type: "open" });
    });

    return {
      send(data) {
        onMessage?.({ 
          data: typeof data === "string" ? data : JSON.stringify(data) 
        }, { mock: true, type: "message" });
      },
      close() {
        onClose?.({ mock: true, type: "close" });
      },
      socket: {
        ...mockSocket,
        addEventListener: (type, listener) => {
          if (type === "message") {
            // Simulate incoming ride request after 5s
            setTimeout(() => {
              listener({
                data: JSON.stringify({
                  type: "ride_requested",
                  payload: {
                    rideId: "ride-mock-999",
                    pickup: { address: "123 Lê Lợi, Quận 1" },
                    destination: { address: "Vincom Đồng Khởi, Quận 1" },
                    estimatedFare: "45.000đ",
                    distance: "2.5 km",
                    duration: "8 phút"
                  }
                })
              });
            }, 5000);
          }
        }
      }
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
