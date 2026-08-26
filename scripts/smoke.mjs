import { spawn } from "node:child_process";

const COMPOSE_FILE = "infra/docker-compose/docker-compose.local.yml";
const TARGET_TIMEOUT_MS = 5_000;
const EXEC_GUARD_MS = TARGET_TIMEOUT_MS + 2_000;

const targets = [
  { name: "gateway", service: "api-gateway", runtime: "node", port: 3000 },
  { name: "pricing", service: "pricing-service", runtime: "node", port: 3101 },
  { name: "payment", service: "payment-service", runtime: "node", port: 3102 },
  { name: "booking", service: "booking-service", runtime: "node", port: 3103 },
  { name: "auth", service: "auth-service", runtime: "node", port: 3104 },
  { name: "user", service: "user-service", runtime: "node", port: 3105 },
  { name: "review", service: "review-service", runtime: "node", port: 3106 },
  { name: "driver", service: "driver-service", runtime: "node", port: 3107 },
  { name: "notification", service: "notification-service", runtime: "node", port: 3108 },
  { name: "ride", service: "ride-service", runtime: "node", port: 3109 },
  { name: "matching", service: "matching-service", runtime: "python", port: 8000 }
];

const nodeProbe = `
const url = process.argv[1];
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
  const payload = await response.json();
  const status = payload?.status ?? payload?.data?.status;
  if (status && !["ok", "healthy"].includes(String(status).toLowerCase())) {
    throw new Error(\`reported status \${status}\`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
`;

const pythonProbe = `
import json
import sys
import urllib.request

try:
    with urllib.request.urlopen(sys.argv[1], timeout=5) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"HTTP {response.status}")
        payload = json.load(response)
        status = payload.get("status") or (payload.get("data") or {}).get("status")
        if status and str(status).lower() not in ("ok", "healthy"):
            raise RuntimeError(f"reported status {status}")
except Exception as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(1)
`;

function probeCommand(target) {
  const url = `http://127.0.0.1:${target.port}/health`;
  if (target.runtime === "python") {
    return ["python", "-c", pythonProbe, url];
  }
  return ["node", "--input-type=module", "--eval", nodeProbe, url];
}

function runProbe(target) {
  return new Promise((resolve) => {
    const args = [
      "compose",
      "-f",
      COMPOSE_FILE,
      "--profile",
      "ai",
      "exec",
      "-T",
      target.service,
      ...probeCommand(target)
    ];
    const child = spawn("docker", args, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true
    });
    let stderr = "";
    let settled = false;

    const finish = (passed, detail) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve({ target, passed, detail });
    };

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => finish(false, error.message));
    child.on("close", (code) => {
      const detail = stderr.trim().split(/\r?\n/).filter(Boolean).at(-1);
      finish(code === 0, code === 0 ? "HTTP health check passed" : detail || `docker exec exited ${code}`);
    });

    const guard = setTimeout(() => {
      child.kill();
      finish(false, `probe exceeded ${TARGET_TIMEOUT_MS}ms health timeout`);
    }, EXEC_GUARD_MS);
  });
}

const results = [];
for (const target of targets) {
  const result = await runProbe(target);
  results.push(result);
  const url = `http://${target.service}:${target.port}/health`;
  const label = result.passed ? "PASS" : "FAIL";
  const line = `[${label}] ${target.name} ${url} - ${result.detail}`;
  (result.passed ? console.log : console.error)(line);
}

const failures = results.filter((result) => !result.passed);
console.log(`Smoke summary: ${results.length - failures.length}/${results.length} passed`);
if (failures.length > 0) {
  console.error(`Failed targets: ${failures.map((result) => result.target.name).join(", ")}`);
  process.exitCode = 1;
}
