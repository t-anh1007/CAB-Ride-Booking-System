import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const cli = path.resolve('.agents/governance/scripts/governance-cli.mjs');
const sha = (value) => createHash('sha256').update(value).digest('hex');

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
