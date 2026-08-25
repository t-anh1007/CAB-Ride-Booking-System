import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const cli = path.resolve('.agents/governance/scripts/governance-cli.mjs');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;

async function fixture() {
  const repo = await mkdtemp(path.join(tmpdir(), 'cab-governance-'));
  await mkdir(path.join(repo, '.agents/governance/runtime'), { recursive: true });
  const target = Buffer.from('before\n');
  await writeFile(path.join(repo, 'target.txt'), target);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const packet = {
    schema_version: 1, id: 'PKT-001', goal: 'Change the fixture', acceptance_criteria: ['target updated'],
    state: 'WORKER_AUTHORIZED', owner_id: 'owner', coordinator_id: 'coordinator',
    participants: { specialist: null, worker: 'worker', auditor: null },
    execution_complexity: 'EASY', assurance_risk: 'LOW',
    requested_runtime: { model: 'luna', reasoning: 'medium', enforced: false },
    exact_path_allowlist: [{ path: 'target.txt', creation_allowed: false, baseline_sha256: sha(target) }],
    baseline: { git_head: null, captured_at: new Date().toISOString(), manifest_sha256: sha(target) },
    stop_gates: [], expires_at: expiresAt, events: []
  };
  const authority = {
    schema_version: 1, id: 'AUTH-001', packet_id: packet.id, issuer_id: 'coordinator',
    subject_id: 'worker', permissions: ['write'], exact_path_allowlist: ['target.txt'],
    issued_at: new Date().toISOString(), expires_at: expiresAt
  };
  const lease = {
    schema_version: 1, id: 'LEASE-001', packet_id: packet.id, worker_id: 'worker',
    issued_by: 'coordinator', exact_path_allowlist: ['target.txt'], baseline_manifest_sha256: sha(target),
    issued_at: new Date().toISOString(), expires_at: expiresAt, status: 'ACTIVE'
  };
  const replacement = Buffer.from('after\n');
  const operation = {
    schema_version: 1, id: 'OP-001', packet_id: packet.id, worker_id: 'worker', lease_id: lease.id,
    changes: [{ path: 'target.txt', before_sha256: sha(target), splices: [{ offset: 0, delete_bytes: target.length, insert_base64: replacement.toString('base64') }] }]
  };
  for (const [name, value] of Object.entries({ packet, authority, lease, operation })) {
    await writeFile(path.join(repo, `${name}.json`), JSON.stringify(value, null, 2));
  }
  return { repo, packet, authority, lease, operation };
}

async function auditFixture(state = 'REWORK') {
  const { repo, packet } = await fixture();
  const target = await readFile(path.join(repo, 'target.txt'));
  const manifest = [{ path: 'target.txt', sha256: sha(target) }];
  const snapshot = sha(canonical(manifest));
  const now = new Date().toISOString();
  packet.state = state;
  packet.participants.auditor = 'auditor';
  packet.execution_complexity = 'HARD';
  packet.assurance_risk = 'HIGH';
  packet.requested_runtime = { model: 'sol', reasoning: 'xhigh', enforced: false };
  packet.candidate = { manifest, snapshot_sha256: snapshot, frozen_at: now, author_id: 'worker' };
  packet.audit = { report_id: 'AUDIT-FAILED', verdict: 'FAIL', findings: [{ id: 'FINDING-OLD' }] };
  const report = {
    schema_version: 1, id: 'AUDIT-REAUDIT-PASS', packet_id: packet.id, auditor_id: 'auditor',
    candidate_snapshot_sha256: snapshot, evidence_integrity: 'VALID', drift_detected: false,
    findings: [], verdict: 'PASS', created_at: now
  };
  await writeFile(path.join(repo, 'packet.json'), JSON.stringify(packet, null, 2));
  await writeFile(path.join(repo, 'report.json'), JSON.stringify(report, null, 2));
  return { repo, packet, report };
}

function run(repo, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });
}

test('Worker applies an authorized exact byte delta', async () => {
  const { repo } = await fixture();
  const result = run(repo, 'write', '--packet', 'packet.json', '--authority', 'authority.json', '--lease', 'lease.json', '--operation', 'operation.json', '--actor', 'worker');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(path.join(repo, 'target.txt'), 'utf8'), 'after\n');
  const packet = JSON.parse(await readFile(path.join(repo, 'packet.json'), 'utf8'));
  assert.equal(packet.state, 'WRITING');
  assert.equal(packet.events.length, 1);
});

test('Coordinator cannot use the write command', async () => {
  const { repo } = await fixture();
  const result = run(repo, 'write', '--packet', 'packet.json', '--authority', 'authority.json', '--lease', 'lease.json', '--operation', 'operation.json', '--actor', 'coordinator');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only Worker/i);
  assert.equal(await readFile(path.join(repo, 'target.txt'), 'utf8'), 'before\n');
});

test('write fails closed on baseline drift', async () => {
  const { repo } = await fixture();
  await writeFile(path.join(repo, 'target.txt'), 'drift\n');
  const result = run(repo, 'write', '--packet', 'packet.json', '--authority', 'authority.json', '--lease', 'lease.json', '--operation', 'operation.json', '--actor', 'worker');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /drift|hash/i);
  assert.equal(await readFile(path.join(repo, 'target.txt'), 'utf8'), 'drift\n');
});

test('write rejects path traversal before touching files', async () => {
  const { repo, operation } = await fixture();
  operation.changes[0].path = '../outside.txt';
  await writeFile(path.join(repo, 'operation.json'), JSON.stringify(operation));
  const result = run(repo, 'write', '--packet', 'packet.json', '--authority', 'authority.json', '--lease', 'lease.json', '--operation', 'operation.json', '--actor', 'worker');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exact relative path|allowlist/i);
});

test('expired lease is rejected', async () => {
  const { repo, lease } = await fixture();
  lease.expires_at = new Date(Date.now() - 1000).toISOString();
  await writeFile(path.join(repo, 'lease.json'), JSON.stringify(lease));
  const result = run(repo, 'write', '--packet', 'packet.json', '--authority', 'authority.json', '--lease', 'lease.json', '--operation', 'operation.json', '--actor', 'worker');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expired/i);
});

test('Owner cannot route Worker directly', async () => {
  const { repo } = await fixture();
  const result = run(repo, 'route', '--packet', 'packet.json', '--actor', 'owner', '--to', 'worker');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Owner.*cannot route/i);
});

test('Coordinator can create a packet, delegate authority, and issue a lease', async () => {
  const { repo } = await fixture();
  const request = {
    id: 'PKT-BOOT', goal: 'Govern target.txt', acceptance_criteria: ['target changes'],
    owner_id: 'owner', coordinator_id: 'coordinator', worker_id: 'worker',
    execution_complexity: 'EASY', assurance_risk: 'LOW',
    requested_runtime: { model: 'luna', reasoning: 'medium', enforced: false },
    exact_paths: [{ path: 'target.txt', creation_allowed: false }],
    expires_at: new Date(Date.now() + 60_000).toISOString()
  };
  await writeFile(path.join(repo, 'request.json'), JSON.stringify(request));
  let result = run(repo, 'packet-create', '--input', 'request.json', '--out', 'created-packet.json', '--actor', 'coordinator');
  assert.equal(result.status, 0, result.stderr);
  result = run(repo, 'authority-delegate', '--packet', 'created-packet.json', '--out', 'created-authority.json', '--actor', 'coordinator', '--subject', 'worker', '--permission', 'write', '--expires-at', request.expires_at);
  assert.equal(result.status, 0, result.stderr);
  result = run(repo, 'lease-issue', '--packet', 'created-packet.json', '--authority', 'created-authority.json', '--out', 'created-lease.json', '--actor', 'coordinator', '--worker', 'worker', '--expires-at', request.expires_at);
  assert.equal(result.status, 0, result.stderr);
  const lease = JSON.parse(await readFile(path.join(repo, 'created-lease.json'), 'utf8'));
  assert.equal(lease.status, 'ACTIVE');
  assert.deepEqual(lease.exact_path_allowlist, ['target.txt']);
});

test('schema validation rejects unknown properties', async () => {
  const { repo, packet } = await fixture();
  packet.unapproved_field = true;
  await writeFile(path.join(repo, 'packet.json'), JSON.stringify(packet));
  const result = run(repo, 'validate', '--type', 'packet', '--file', 'packet.json');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /additional property/i);
});

test('Auditor can re-audit an unchanged REWORK candidate', async () => {
  const { repo, packet, report } = await auditFixture();
  const result = run(repo, 'audit', '--packet', 'packet.json', '--report', 'report.json', '--actor', 'auditor');
  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(await readFile(path.join(repo, 'packet.json'), 'utf8'));
  assert.equal(updated.state, 'COORDINATOR_REVIEW');
  assert.deepEqual(updated.candidate, packet.candidate);
  assert.deepEqual(updated.audit, { report_id: report.id, verdict: 'PASS', findings: [] });
  assert.equal(updated.events.at(-1).action, 'AUDIT_SUBMITTED');
});

test('REWORK re-audit fails closed on frozen candidate drift', async () => {
  const { repo } = await auditFixture();
  await writeFile(path.join(repo, 'target.txt'), 'drift\n');
  const result = run(repo, 'audit', '--packet', 'packet.json', '--report', 'report.json', '--actor', 'auditor');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Frozen candidate drift/i);
  const unchanged = JSON.parse(await readFile(path.join(repo, 'packet.json'), 'utf8'));
  assert.equal(unchanged.state, 'REWORK');
  assert.equal(unchanged.audit.verdict, 'FAIL');
});

test('audit still rejects a non-auditable packet state', async () => {
  const { repo } = await auditFixture('WRITING');
  const result = run(repo, 'audit', '--packet', 'packet.json', '--report', 'report.json', '--actor', 'auditor');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Packet is not auditable/i);
});

test('REWORK re-audit preserves exact report identity and snapshot checks', async () => {
  const cases = [
    ['packet identity', (report) => { report.packet_id = 'PKT-OTHER'; }],
    ['auditor identity', (report) => { report.auditor_id = 'auditor-other'; }],
    ['candidate snapshot', (report) => { report.candidate_snapshot_sha256 = '0'.repeat(64); }]
  ];
  for (const [label, mutate] of cases) {
    const { repo, report } = await auditFixture();
    mutate(report);
    await writeFile(path.join(repo, 'report.json'), JSON.stringify(report, null, 2));
    const result = run(repo, 'audit', '--packet', 'packet.json', '--report', 'report.json', '--actor', 'auditor');
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /Audit report does not match frozen candidate/i, label);
  }
});

test('REWORK re-audit rejects a report that declares drift', async () => {
  const { repo, report } = await auditFixture();
  report.drift_detected = true;
  await writeFile(path.join(repo, 'report.json'), JSON.stringify(report, null, 2));
  const result = run(repo, 'audit', '--packet', 'packet.json', '--report', 'report.json', '--actor', 'auditor');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Audit report does not match frozen candidate/i);
});

test('REWORK re-audit preserves independent Auditor separation', async () => {
  const { repo, packet } = await auditFixture();
  packet.candidate.author_id = 'auditor';
  await writeFile(path.join(repo, 'packet.json'), JSON.stringify(packet, null, 2));
  const result = run(repo, 'audit', '--packet', 'packet.json', '--report', 'report.json', '--actor', 'auditor');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot audit its own candidate/i);
});
