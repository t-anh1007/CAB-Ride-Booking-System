import mtlsClient from "../../../../platform/node/mtls-client.cjs";

const { createMtlsFetch } = mtlsClient;
const SURGE_PRICING_SERVICE_URL =
  process.env.SURGE_PRICING_SERVICE_URL || "http://surge-pricing-service:8001";
const internalFetch = createMtlsFetch({ env: process.env, prefix: "INTERNAL_TLS" });

export async function evaluateSurge({ zoneId, requestId }) {
  const response = await internalFetch(`${SURGE_PRICING_SERVICE_URL}/internal/surge/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId
    },
    body: JSON.stringify({ zoneId, requestId })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Surge pricing service failed (${response.status}): ${text}`);
  }

  return response.json();
}
