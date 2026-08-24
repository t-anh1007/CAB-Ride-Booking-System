const paymentBaseUrl = import.meta.env.VITE_PAYMENT_API_BASE_URL || "http://localhost:3102/api/v1";
const gatewayUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const socketUrl = (import.meta.env.VITE_WS_BASE_URL || "ws://localhost:3000").replace(/^http/, "ws");

export function getGatewayUrl() {
  return gatewayUrl;
}

export function getSocketUrl() {
  return `${socketUrl}/realtime?client=customer-app`;
}

export async function fetchGatewayHealth() {
  const response = await fetch(`${gatewayUrl}/health`);
  if (!response.ok) {
    throw new Error(`Gateway health check failed: ${response.status}`);
  }
  return response.json();
}

export function buildEtaAndPrice(distanceKm, demandIndex = 1) {
  const safeDistance = Number(distanceKm) || 0;
  const safeDemand = Math.max(1, Number(demandIndex) || 1);
  const etaMinutes = Math.max(2, Math.round(safeDistance * 3 + safeDemand * 2));
  const price = Math.round((12000 + safeDistance * 6500) * safeDemand);
  return { etaMinutes, price, surge: safeDemand };
}

export async function createPayment({ rideId, userId, amount, currency = "VND", method = "cash" }) {
  const response = await fetch(`${paymentBaseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `customer-app-${rideId}-${Date.now()}`
    },
    body: JSON.stringify({ rideId, userId, amount, currency, method })
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || "Create payment failed");
  }
  return json;
}

export async function getPayment(paymentId) {
  const response = await fetch(`${paymentBaseUrl}/payments/${paymentId}`);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || "Get payment failed");
  }
  return json;
}

export async function confirmPayment(paymentId, outcome = "success") {
  const response = await fetch(`${paymentBaseUrl}/payments/${paymentId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ outcome })
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || "Confirm payment failed");
  }
  return json;
}

export async function refundPayment(paymentId, reason = "Refund requested from customer app") {
  const response = await fetch(`${paymentBaseUrl}/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reason })
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || "Refund payment failed");
  }
  return json;
}
