import { isStandaloneMode } from "@/config/runtime.js";
import { env } from "@/config/env.js";

const apiBaseUrl = env.apiBaseUrl;

function createMockResponse(path, options) {
  return new Response(
    JSON.stringify({
      data: null,
      mock: true,
      method: options.method || "GET",
      path,
      status: "standalone"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    }
  );
}

export async function request(path, options = {}) {
  if (isStandaloneMode) {
    return createMockResponse(path, options);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${apiBaseUrl}${normalizedPath}`, options);
}
