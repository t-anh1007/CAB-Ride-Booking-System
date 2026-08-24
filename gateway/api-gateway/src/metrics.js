import client from "prom-client";

export function createGatewayMetrics({ registry = new client.Registry() } = {}) {
  client.collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new client.Counter({
    name: "cab_gateway_http_requests_total",
    help: "Total number of HTTP requests handled by the API gateway",
    labelNames: ["method", "route", "status"],
    registers: [registry]
  });

  const httpRequestDurationMs = new client.Histogram({
    name: "cab_gateway_http_request_duration_ms",
    help: "Duration of HTTP requests handled by the API gateway in milliseconds",
    labelNames: ["method", "route", "status"],
    buckets: [25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry]
  });

  const wsConnections = new client.Gauge({
    name: "cab_gateway_ws_connections",
    help: "Current number of active websocket connections",
    registers: [registry]
  });

  const wsMessagesTotal = new client.Counter({
    name: "cab_gateway_ws_messages_total",
    help: "Total websocket messages processed by the API gateway",
    labelNames: ["type", "outcome"],
    registers: [registry]
  });

  return {
    registry,
    recordHttpRequest({ method, route, status, durationMs }) {
      const labels = {
        method,
        route,
        status: String(status)
      };

      httpRequestsTotal.inc(labels);
      httpRequestDurationMs.observe(labels, durationMs);
    },
    wsConnected() {
      wsConnections.inc();
    },
    wsDisconnected() {
      wsConnections.dec();
    },
    recordWsMessage(type, outcome) {
      wsMessagesTotal.inc({
        type,
        outcome
      });
    }
  };
}
