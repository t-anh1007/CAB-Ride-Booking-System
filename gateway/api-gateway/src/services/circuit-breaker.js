export function createCircuitBreaker({
  failureThreshold = 5,
  resetTimeoutMs = 30_000
} = {}) {
  let state = "closed";
  let failureCount = 0;
  let openedAt = 0;

  return {
    canRequest() {
      if (state === "closed") {
        return true;
      }

      if (Date.now() - openedAt >= resetTimeoutMs) {
        state = "half-open";
        return true;
      }

      return false;
    },
    onSuccess() {
      state = "closed";
      failureCount = 0;
      openedAt = 0;
    },
    onFailure() {
      failureCount += 1;

      if (failureCount >= failureThreshold || state === "half-open") {
        state = "open";
        openedAt = Date.now();
      }
    },
    snapshot() {
      return {
        state,
        failureCount,
        openedAt
      };
    }
  };
}
