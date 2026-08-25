import mtlsClient from "../../../../platform/node/mtls-client.cjs";

const { createMtlsFetch } = mtlsClient;
const SURGE_PRICING_SERVICE_URL = process.env.SURGE_PRICING_SERVICE_URL || "http://surge-pricing-service:8001";
const internalFetch = createMtlsFetch({ env: process.env, prefix: "INTERNAL_TLS" });

function clampMultiplier(value) {
  const numeric = Number(value);
  return Math.min(3, Math.max(1, Number.isFinite(numeric) ? numeric : 1));
}

function formulaFallback() {
  return {
    available: true,
    supplyCount: 0,
    demandCount: 0,
    surgeMultiplier: 1,
    surgeSource: "formula-fallback"
  };
}

export async function evaluateSurge({ zoneId, requestId }) {
  const timeoutMs = Number(process.env.SURGE_PRICING_TIMEOUT_MS || 2000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await internalFetch(SURGE_PRICING_SERVICE_URL + "/internal/surge/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({ zoneId, requestId }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Surge pricing service failed");
    const result = await response.json();
    return {
      ...result,
      surgeMultiplier: clampMultiplier(result.surgeMultiplier),
      surgeSource: result.surgeSource || "ai-xgboost"
    };
  } catch {
    return formulaFallback();
  } finally {
    clearTimeout(timer);
  }
}
