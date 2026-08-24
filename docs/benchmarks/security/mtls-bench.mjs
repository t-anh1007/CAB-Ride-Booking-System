// #8 mTLS overhead: measures per-request latency of mutual-TLS vs plain HTTP
// over localhost with fresh connections (captures the TLS/mTLS handshake cost).
// Certs are generated ephemerally in the OS temp dir via openssl.
//
//   node docs/benchmarks/security/mtls-bench.mjs
//
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mtls-"));
const run = (c) => execSync(c, { cwd: dir, stdio: "pipe" });

// CA
run(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 1 -subj "/CN=cab-dev-ca"`);
// server
fs.writeFileSync(path.join(dir, "san.cnf"), "subjectAltName=DNS:localhost,IP:127.0.0.1\n");
run(`openssl req -newkey rsa:2048 -nodes -keyout srv.key -out srv.csr -subj "/CN=localhost"`);
run(`openssl x509 -req -in srv.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out srv.crt -days 1 -extfile san.cnf`);
// client
run(`openssl req -newkey rsa:2048 -nodes -keyout cli.key -out cli.csr -subj "/CN=cab-service-client"`);
run(`openssl x509 -req -in cli.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out cli.crt -days 1`);

const rd = (f) => fs.readFileSync(path.join(dir, f));
const ca = rd("ca.crt"), srvKey = rd("srv.key"), srvCrt = rd("srv.crt"), cliKey = rd("cli.key"), cliCrt = rd("cli.crt");

const body = JSON.stringify({ ok: true });
const handler = (_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(body); };

const httpSrv = http.createServer(handler);
const mtlsSrv = https.createServer({ key: srvKey, cert: srvCrt, ca, requestCert: true, rejectUnauthorized: true }, handler);

const now = () => Number(process.hrtime.bigint()) / 1e6;
const pctl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((p / 100) * s.length)]; };
const st = (a) => ({ p50: +pctl(a, 50).toFixed(3), p95: +pctl(a, 95).toFixed(3), avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) });

function once(opts, agent) {
  return new Promise((resolve, reject) => {
    const mod = opts.protocol === "https:" ? https : http;
    const req = mod.request({ ...opts, agent }, (res) => { res.on("data", () => {}); res.on("end", resolve); });
    req.on("error", reject);
    req.end();
  });
}

async function bench(kind, port, extra) {
  const N = 1500;
  const lat = [];
  const proto = kind === "mtls" ? "https:" : "http:";
  // fresh connection each request -> include handshake cost
  const agent = proto === "https:" ? new https.Agent({ keepAlive: false }) : new http.Agent({ keepAlive: false });
  for (let i = 0; i < 200; i++) await once({ protocol: proto, host: "localhost", port, path: "/", ...extra }, agent); // warmup
  for (let i = 0; i < N; i++) { const a = now(); await once({ protocol: proto, host: "localhost", port, path: "/", ...extra }, agent); lat.push(now() - a); }
  return { samples: N, latencyMs: st(lat) };
}

await new Promise((r) => httpSrv.listen(0, r));
await new Promise((r) => mtlsSrv.listen(0, r));
const httpPort = httpSrv.address().port;
const mtlsPort = mtlsSrv.address().port;

const clientOpts = { key: cliKey, cert: cliCrt, ca, servername: "localhost", secureContext: tls.createSecureContext({ key: cliKey, cert: cliCrt, ca }) };

const plain = await bench("http", httpPort, {});
const mtls = await bench("mtls", mtlsPort, clientOpts);

const overheadMs = +(mtls.latencyMs.p50 - plain.latencyMs.p50).toFixed(3);
const overheadPct = +(100 * overheadMs / plain.latencyMs.p50).toFixed(1);

console.log(JSON.stringify({ mtls: { plainHttp: plain, mutualTls: mtls, overheadMsP50: overheadMs, overheadPct } }, null, 2));

httpSrv.close(); mtlsSrv.close();
fs.rmSync(dir, { recursive: true, force: true });
