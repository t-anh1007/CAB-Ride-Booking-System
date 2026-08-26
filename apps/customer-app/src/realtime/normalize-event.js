export function normalizeRealtimeEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return event;
  }

  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return event;
  }

  return { ...event, ...payload };
}
