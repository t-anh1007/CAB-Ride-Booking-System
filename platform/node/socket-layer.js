import { WebSocketServer } from "ws";
import { getRealtimeCapabilitiesForClient } from "../architecture/realtime-topology.js";

export function createRealtimeLayer({ server, gatewayKey, realtimeTopology }) {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const endpoint = realtimeTopology.layer.gatewayEndpoint;

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname !== endpoint) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit("connection", client, request, url.searchParams);
    });
  });

  webSocketServer.on("connection", (client, request, searchParams) => {
    const clientKey = searchParams.get("client") || "unknown-client";
    const capabilities = getRealtimeCapabilitiesForClient(clientKey);

    client.send(JSON.stringify({
      type: "realtime.connected",
      gateway: gatewayKey,
      layer: realtimeTopology.layer.displayName,
      mode: "architecture-only",
      transport: realtimeTopology.layer.transport,
      client: clientKey,
      receives: capabilities.receives || [],
      streams: capabilities.streams || [],
      protocol: request.headers["sec-websocket-protocol"] || "default"
    }));
  });

  return {
    endpoint,
    mode: "architecture-only",
    transport: realtimeTopology.layer.transport,
    subscribers: realtimeTopology.clientApps
  };
}
