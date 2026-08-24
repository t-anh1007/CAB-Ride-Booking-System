import { DEFAULT_BASE_DELAY_MS, DEFAULT_MAX_RETRIES, MAX_BACKOFF_DELAY_MS } from '../config/constants.js';
import { nowIso, sleep } from '../utils/time.js';

function resolveDelay(baseDelayMs, attempt, maxDelayMs) {
  return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
}

export async function runWithExponentialBackoff(task, options = {}) {
  const maxRetries = Number.isInteger(options.maxRetries) && options.maxRetries >= 0
    ? options.maxRetries
    : DEFAULT_MAX_RETRIES;
  const baseDelayMs = Number.isInteger(options.baseDelayMs) && options.baseDelayMs > 0
    ? options.baseDelayMs
    : DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = Number.isInteger(options.maxDelayMs) && options.maxDelayMs > 0
    ? options.maxDelayMs
    : MAX_BACKOFF_DELAY_MS;

  const history = [];
  let lastResult;
  let exhausted = false;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    lastResult = await task(attempt);

    if (lastResult.status !== 'TIMEOUT') {
      return { result: lastResult, history, exhausted: false, nextRetryAt: null };
    }

    if (attempt <= maxRetries) {
      const delayMs = resolveDelay(baseDelayMs, attempt, maxDelayMs);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
      history.push({
        attempt,
        result: 'TIMEOUT',
        delayMs,
        nextRetryAt,
        reason: lastResult.reason || 'Gateway timeout',
        timestamp: nowIso()
      });
      await sleep(delayMs);
    } else {
      exhausted = true;
    }
  }

  return {
    result: lastResult,
    history,
    exhausted,
    nextRetryAt: exhausted ? null : history.at(-1)?.nextRetryAt ?? null
  };
}
