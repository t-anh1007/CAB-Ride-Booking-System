#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STATES = new Set(['DRAFT','READY','SPECIALIST_REVIEW','WORKER_AUTHORIZED','WRITING','CANDIDATE_FROZEN','AUDIT_REQUIRED','AUDIT_SKIPPED','COORDINATOR_REVIEW','ACCEPTED','REWORK','STOPPED','EXPIRED']);
const COMPLEXITIES = new Set(['EASY','MEDIUM','HARD']);
const RISKS = new Set(['LOW','MODERATE','HIGH','CRITICAL']);
const ROLES = new Set(['owner','coordinator','specialist','worker','auditor']);
const terminal = new Set(['ACCEPTED','STOPPED','EXPIRED']);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
const die = (message) => { throw new Error(message); };

function argsOf(argv) {
  const command = argv[0]; const options = {};
  for (let i = 1; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) die(`Invalid argument ${argv[i] ?? ''}`);
    options[argv[i].slice(2)] = argv[i + 1];
  }
  return { command, options };
}
async function json(file) { return JSON.parse(await readFile(path.resolve(file), 'utf8')); }
async function save(file, value) { await writeFile(path.resolve(file), `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' }); }
function schemaCheck(schema,value,at='$') {
  if(schema.const!==undefined&&value!==schema.const) die(`${at} must equal ${JSON.stringify(schema.const)}`);
  if(schema.enum&&!schema.enum.includes(value)) die(`${at} is not an allowed value`);
  if(schema.type){ const types=Array.isArray(schema.type)?schema.type:[schema.type]; const actual=value===null?'null':Array.isArray(value)?'array':Number.isInteger(value)?'integer':typeof value; if(!types.includes(actual)) die(`${at} must be ${types.join(' or ')}`); }
  if(typeof value==='string'){ if(schema.minLength!==undefined&&value.length<schema.minLength) die(`${at} is too short`); if(schema.pattern&&!new RegExp(schema.pattern).test(value)) die(`${at} does not match pattern`); if(schema.format==='date-time'&&!Number.isFinite(Date.parse(value))) die(`${at} is not a date-time`); }
  if(Array.isArray(value)){ if(schema.minItems!==undefined&&value.length<schema.minItems) die(`${at} has too few items`); if(schema.items)value.forEach((item,i)=>schemaCheck(schema.items,item,`${at}[${i}]`)); }
  if(value&&typeof value==='object'&&!Array.isArray(value)){ const properties=schema.properties??{}; for(const key of schema.required??[])if(!(key in value))die(`${at}.${key} is required`); if(schema.additionalProperties===false)for(const key of Object.keys(value))if(!(key in properties))die(`${at}.${key} is an additional property`); for(const [key,child] of Object.entries(properties))if(key in value)schemaCheck(child,value[key],`${at}.${key}`); }
}
async function strictSchema(type,value){ const names={'audit-report':'audit-report',packet:'packet',authority:'authority',lease:'lease',operation:'operation',handoff:'handoff'}; if(!names[type])die('Unknown validation type'); const file=new URL(`../schemas/${names[type]}.schema.json`,import.meta.url); schemaCheck(JSON.parse(await readFile(file,'utf8')),value); }
function required(value, fields, type) { if (!value || typeof value !== 'object' || Array.isArray(value)) die(`${type} must be an object`); for (const field of fields) if (!(field in value)) die(`${type}.${field} is required`); }
function future(value, label) { const time = Date.parse(value); if (!Number.isFinite(time)) die(`${label} is not a date-time`); if (time <= Date.now()) die(`${label} expired`); }
function exactRelative(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\') || value.split('/').some(p => !p || p === '.' || p === '..') || /[*?\[\]{}]/.test(value)) die(`Path must be an exact relative path: ${value}`);
  return value;
}
function validatePacket(p) {
  required(p, ['schema_version','id','goal','acceptance_criteria','state','owner_id','coordinator_id','participants','execution_complexity','assurance_risk','requested_runtime','exact_path_allowlist','baseline','stop_gates','expires_at','events'], 'packet');
  if (p.schema_version !== 1 || !STATES.has(p.state) || !COMPLEXITIES.has(p.execution_complexity) || !RISKS.has(p.assurance_risk)) die('Invalid packet enum or schema version');
  if (p.requested_runtime?.enforced !== false) die('requested_runtime.enforced must be false');
  if (!Array.isArray(p.exact_path_allowlist) || !p.exact_path_allowlist.length) die('packet exact allowlist required');
  p.exact_path_allowlist.forEach(x => { required(x, ['path','creation_allowed','baseline_sha256'], 'allowlist item'); exactRelative(x.path); });
  if (!Array.isArray(p.stop_gates) || p.stop_gates.some(g => g.open !== true)) die('A stop gate is closed');
  future(p.expires_at, 'packet');
}
function validateAuthority(a) { required(a, ['schema_version','id','packet_id','issuer_id','subject_id','permissions','exact_path_allowlist','issued_at','expires_at'], 'authority'); future(a.expires_at, 'authority'); }
function validateLease(l) { required(l, ['schema_version','id','packet_id','worker_id','issued_by','exact_path_allowlist','baseline_manifest_sha256','issued_at','expires_at','status'], 'lease'); if (l.status !== 'ACTIVE') die('Lease is not ACTIVE'); future(l.expires_at, 'lease'); }
function validateOperation(o) { required(o, ['schema_version','id','packet_id','worker_id','lease_id','changes'], 'operation'); if (!Array.isArray(o.changes) || !o.changes.length) die('Operation changes required'); o.changes.forEach(c => { required(c, ['path','before_sha256','splices'], 'change'); exactRelative(c.path); if (!Array.isArray(c.splices) || !c.splices.length) die('Splices required'); }); }
function validateHandoff(h){ required(h,['schema_version','id','packet_id','author_id','author_profile','kind','evidence','residual_uncertainty','created_at'],'handoff'); if(!['specialist','worker','auditor'].includes(h.author_profile)||!['RECOMMENDATION','CANDIDATE','AUDIT'].includes(h.kind)) die('Invalid handoff profile or kind'); }
function validateAuditReport(r){ required(r,['schema_version','id','packet_id','auditor_id','candidate_snapshot_sha256','evidence_integrity','drift_detected','findings','verdict','created_at'],'audit report'); if(!['VALID','INVALID','INCOMPLETE'].includes(r.evidence_integrity)||!['PASS','PASS_WITH_FINDINGS','FAIL'].includes(r.verdict)) die('Invalid audit report enum'); }
function event(packet, actor, action, data = {}) { const previous_hash = packet.events.at(-1)?.event_sha256 ?? null; const base = { sequence: packet.events.length + 1, at: new Date().toISOString(), actor, action, previous_hash, data }; base.event_sha256 = sha(canonical(base)); packet.events.push(base); }
function actorRole(packet, actor) {
  if (actor === packet.owner_id || actor === 'owner') return 'owner';
  if (actor === packet.coordinator_id || actor === 'coordinator') return 'coordinator';
  for (const role of ['specialist','worker','auditor']) if (actor === packet.participants?.[role] || actor === role) return role;
  die(`Unknown actor: ${actor}`);
}
async function confined(repo, rel, allowMissing = false) {
  exactRelative(rel); const root = await realpath(repo); const full = path.resolve(repo, ...rel.split('/'));
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) die(`Path escapes repository: ${rel}`);
  try { const info = await lstat(full); if (info.isSymbolicLink() || !info.isFile()) die(`Path is not a regular file: ${rel}`); const resolved = await realpath(full); if (!resolved.startsWith(`${root}${path.sep}`)) die(`Path escapes repository: ${rel}`); }
  catch (error) { if (!allowMissing || error.code !== 'ENOENT') throw error; }
  return full;
}
function applySplices(original, splices) {
  const ordered = [...splices].sort((a,b) => b.offset - a.offset); let output = Buffer.from(original); let prior = output.length + 1;
  for (const s of ordered) { if (!Number.isInteger(s.offset) || !Number.isInteger(s.delete_bytes) || s.offset < 0 || s.delete_bytes < 0 || s.offset + s.delete_bytes > output.length || s.offset + s.delete_bytes > prior) die('Invalid or overlapping byte splice'); const insert = Buffer.from(s.insert_base64, 'base64'); output = Buffer.concat([output.subarray(0,s.offset), insert, output.subarray(s.offset+s.delete_bytes)]); prior = s.offset; }
  return output;
}
async function commandWrite(o) {
  const [packet, authority, lease, operation] = await Promise.all([json(o.packet),json(o.authority),json(o.lease),json(o.operation)]);
  await Promise.all([strictSchema('packet',packet),strictSchema('authority',authority),strictSchema('lease',lease),strictSchema('operation',operation)]);
  validatePacket(packet); validateAuthority(authority); validateLease(lease); validateOperation(operation);
  if (actorRole(packet,o.actor) !== 'worker') die('Only Worker may use write');
  if (!['WORKER_AUTHORIZED','WRITING'].includes(packet.state)) die(`Packet state ${packet.state} cannot write`);
  if (authority.packet_id !== packet.id || lease.packet_id !== packet.id || operation.packet_id !== packet.id) die('Packet identity mismatch');
  if (authority.subject_id !== o.actor && authority.subject_id !== 'worker') die('Authority subject mismatch');
  if (!authority.permissions.includes('write')) die('Authority does not grant write');
  if (lease.worker_id !== o.actor && lease.worker_id !== 'worker') die('Lease Worker mismatch');
  if (operation.worker_id !== o.actor && operation.worker_id !== 'worker') die('Operation Worker mismatch');
  if (operation.lease_id !== lease.id || lease.issued_by !== packet.coordinator_id && lease.issued_by !== 'coordinator') die('Invalid lease chain');
  if (lease.baseline_manifest_sha256 !== packet.baseline.manifest_sha256) die('Lease baseline hash mismatch');
  const packetPaths = new Map(packet.exact_path_allowlist.map(x => [x.path,x])); const authorityPaths = new Set(authority.exact_path_allowlist); const leasePaths = new Set(lease.exact_path_allowlist);
  const prepared = [];
  for (const change of operation.changes) {
    const grant = packetPaths.get(change.path); if (!grant || !authorityPaths.has(change.path) || !leasePaths.has(change.path)) die(`Path not in every allowlist: ${change.path}`);
    const full = await confined(process.cwd(), change.path, grant.creation_allowed); let original;
    try { original = await readFile(full); } catch (e) { if (e.code !== 'ENOENT' || !grant.creation_allowed) throw e; original = Buffer.alloc(0); }
    const current = sha(original); if (current !== change.before_sha256 || current !== grant.baseline_sha256) die(`Baseline drift or hash mismatch: ${change.path}`);
    prepared.push({ full, original, output: applySplices(original, change.splices), rel: change.path });
  }
  const written = [];
  try { for (const item of prepared) { await writeFile(item.full, item.output); written.push(item); if (sha(await readFile(item.full)) !== sha(item.output)) die(`Post-write hash mismatch: ${item.rel}`); } }
  catch (error) { for (const item of written.reverse()) await writeFile(item.full,item.original); throw error; }
  packet.state = 'WRITING'; event(packet,o.actor,'WRITE_APPLIED',{ operation_id: operation.id, changes: prepared.map(x => ({ path:x.rel, before_sha256:sha(x.original), after_sha256:sha(x.output) })) }); await save(o.packet,packet);
  console.log(JSON.stringify({ ok:true, packet_id:packet.id, state:packet.state }));
}
async function commandPacketCreate(o) {
  const request=await json(o.input); if(o.actor!=='coordinator') die('Only Coordinator may create a governed packet');
  required(request,['id','goal','acceptance_criteria','owner_id','coordinator_id','execution_complexity','assurance_risk','requested_runtime','exact_paths','expires_at'],'packet request'); future(request.expires_at,'packet');
  if(request.coordinator_id!==o.actor && request.coordinator_id!=='coordinator') die('Coordinator identity mismatch');
  const allow=[]; const manifest=[];
  for(const item of request.exact_paths){ required(item,['path','creation_allowed'],'exact path'); exactRelative(item.path); const full=await confined(process.cwd(),item.path,item.creation_allowed); let bytes; try{bytes=await readFile(full);}catch(e){if(e.code!=='ENOENT'||!item.creation_allowed)throw e;bytes=Buffer.alloc(0);} const digest=sha(bytes); allow.push({path:item.path,creation_allowed:item.creation_allowed,baseline_sha256:digest}); manifest.push({path:item.path,sha256:digest}); }
  const packet={schema_version:1,id:request.id,goal:request.goal,acceptance_criteria:request.acceptance_criteria,state:'READY',owner_id:request.owner_id,coordinator_id:request.coordinator_id,participants:{specialist:request.specialist_id??null,worker:request.worker_id??null,auditor:request.auditor_id??null},execution_complexity:request.execution_complexity,assurance_risk:request.assurance_risk,requested_runtime:request.requested_runtime,exact_path_allowlist:allow,baseline:{git_head:request.git_head??null,captured_at:new Date().toISOString(),manifest_sha256:sha(canonical(manifest))},stop_gates:[],expires_at:request.expires_at,events:[]};
  validatePacket(packet); event(packet,o.actor,'PACKET_CREATED',{baseline_manifest_sha256:packet.baseline.manifest_sha256}); await save(o.out,packet); console.log(JSON.stringify({ok:true,packet_id:packet.id,state:packet.state}));
}
async function commandAuthorityDelegate(o){ const p=await json(o.packet); validatePacket(p); if(actorRole(p,o.actor)!=='coordinator') die('Only Coordinator may delegate authority'); if(!['analyze','write','audit'].includes(o.permission)) die('Invalid permission'); future(o['expires-at'],'authority'); if(Date.parse(o['expires-at'])>Date.parse(p.expires_at)) die('Authority cannot outlive packet'); const role=o.permission==='write'?'worker':o.permission==='audit'?'auditor':'specialist'; if(o.subject!==p.participants[role]&&o.subject!==role) die(`Authority subject is not packet ${role}`); const value={schema_version:1,id:`AUTH-${sha(`${p.id}:${o.subject}:${o.permission}:${Date.now()}`).slice(0,16)}`,packet_id:p.id,issuer_id:o.actor,subject_id:o.subject,permissions:[o.permission],exact_path_allowlist:p.exact_path_allowlist.map(x=>x.path),issued_at:new Date().toISOString(),expires_at:o['expires-at']}; value.integrity_sha256=sha(canonical(value)); await save(o.out,value); event(p,o.actor,'AUTHORITY_DELEGATED',{authority_id:value.id,subject:o.subject,permission:o.permission}); await save(o.packet,p); console.log(JSON.stringify({ok:true,authority_id:value.id})); }
async function commandLeaseIssue(o){ const [p,a]=await Promise.all([json(o.packet),json(o.authority)]); validatePacket(p); validateAuthority(a); if(actorRole(p,o.actor)!=='coordinator') die('Only Coordinator may issue a lease'); future(o['expires-at'],'lease'); if(Date.parse(o['expires-at'])>Math.min(Date.parse(p.expires_at),Date.parse(a.expires_at))) die('Lease cannot outlive packet or authority'); if(a.packet_id!==p.id||!a.permissions.includes('write')||(a.subject_id!==o.worker&&a.subject_id!=='worker')) die('Authority does not permit this Worker lease'); if(o.worker!==p.participants.worker&&o.worker!=='worker') die('Worker is not assigned to packet'); const value={schema_version:1,id:`LEASE-${sha(`${p.id}:${o.worker}:${Date.now()}`).slice(0,16)}`,packet_id:p.id,worker_id:o.worker,issued_by:o.actor,exact_path_allowlist:p.exact_path_allowlist.map(x=>x.path),baseline_manifest_sha256:p.baseline.manifest_sha256,issued_at:new Date().toISOString(),expires_at:o['expires-at'],status:'ACTIVE'}; value.integrity_sha256=sha(canonical(value)); await save(o.out,value); p.state='WORKER_AUTHORIZED'; event(p,o.actor,'LEASE_ISSUED',{lease_id:value.id,worker:o.worker}); await save(o.packet,p); console.log(JSON.stringify({ok:true,lease_id:value.id,state:p.state})); }
async function commandHandoff(o){ const p=await json(o.packet), h=await json(o.handoff); validatePacket(p); validateHandoff(h); const role=actorRole(p,o.actor); if(!['specialist','worker','auditor'].includes(role)||h.author_profile!==role||h.author_id!==o.actor||h.packet_id!==p.id) die('Handoff author or packet mismatch'); if(role==='worker'&&h.kind!=='CANDIDATE'||role==='specialist'&&h.kind!=='RECOMMENDATION'||role==='auditor'&&h.kind!=='AUDIT') die('Handoff kind does not match profile'); event(p,o.actor,'HANDOFF_SUBMITTED',{handoff_id:h.id,kind:h.kind,residual_uncertainty:h.residual_uncertainty}); await save(o.packet,p); console.log(JSON.stringify({ok:true,handoff_id:h.id})); }
async function commandRoute(o) { const p=await json(o.packet); await strictSchema('packet',p); validatePacket(p); const role=actorRole(p,o.actor); if (role==='owner') die('Owner cannot route Specialist, Worker, or Auditor directly'); if (role!=='coordinator') die('Only Coordinator may route'); if (!['specialist','worker','auditor'].includes(o.to)) die('Invalid route target'); if ((p.assurance_risk==='HIGH'||p.assurance_risk==='CRITICAL') && o.to==='coordinator') die('Audit required'); event(p,o.actor,'ROUTE',{to:o.to}); await save(o.packet,p); console.log(JSON.stringify({ok:true,to:o.to})); }
async function commandFreeze(o) { const p=await json(o.packet); validatePacket(p); if(actorRole(p,o.actor)!=='worker') die('Only Worker may freeze its candidate'); if(p.state!=='WRITING') die('Packet is not WRITING'); const manifest=[]; for(const x of p.exact_path_allowlist){ const bytes=await readFile(await confined(process.cwd(),x.path)); manifest.push({path:x.path,sha256:sha(bytes)}); } p.candidate={manifest, snapshot_sha256:sha(canonical(manifest)), frozen_at:new Date().toISOString(), author_id:o.actor}; p.state=(p.assurance_risk==='HIGH'||p.assurance_risk==='CRITICAL')?'AUDIT_REQUIRED':'CANDIDATE_FROZEN'; event(p,o.actor,'CANDIDATE_FROZEN',{snapshot_sha256:p.candidate.snapshot_sha256}); await save(o.packet,p); console.log(JSON.stringify({ok:true,state:p.state,snapshot_sha256:p.candidate.snapshot_sha256})); }
async function verifyCandidate(p){ if(!p.candidate) die('No frozen candidate'); const manifest=[]; for(const x of p.candidate.manifest){ const bytes=await readFile(await confined(process.cwd(),x.path)); if(sha(bytes)!==x.sha256) die(`Frozen candidate drift: ${x.path}`); manifest.push(x); } if(sha(canonical(manifest))!==p.candidate.snapshot_sha256) die('Candidate snapshot hash mismatch'); }
async function commandAudit(o){ const p=await json(o.packet), report=await json(o.report); validatePacket(p); validateAuditReport(report); if(actorRole(p,o.actor)!=='auditor') die('Only Auditor may audit'); if(p.candidate?.author_id===o.actor) die('Auditor cannot audit its own candidate'); if(!['AUDIT_REQUIRED','CANDIDATE_FROZEN'].includes(p.state)) die('Packet is not auditable'); await verifyCandidate(p); if(report.packet_id!==p.id||report.auditor_id!==o.actor||report.candidate_snapshot_sha256!==p.candidate.snapshot_sha256||report.drift_detected) die('Audit report does not match frozen candidate'); p.state='COORDINATOR_REVIEW'; p.audit={report_id:report.id,verdict:report.verdict,findings:report.findings}; event(p,o.actor,'AUDIT_SUBMITTED',{report_id:report.id,verdict:report.verdict}); await save(o.packet,p); console.log(JSON.stringify({ok:true,state:p.state})); }
async function commandReview(o){ const p=await json(o.packet); validatePacket(p); if(actorRole(p,o.actor)!=='coordinator') die('Only Coordinator may review'); if(o.decision==='skip-audit'){ if(p.assurance_risk==='HIGH'||p.assurance_risk==='CRITICAL') die('Audit is mandatory'); if(p.state!=='CANDIDATE_FROZEN') die('Candidate is not ready'); await verifyCandidate(p); p.state='COORDINATOR_REVIEW'; } else { if(p.state!=='COORDINATOR_REVIEW') die('Packet is not in Coordinator review'); if(o.decision==='accept'){ if(p.audit?.verdict==='FAIL') die('Cannot accept failed audit'); p.state='ACCEPTED'; } else if(o.decision==='rework') p.state='REWORK'; else if(o.decision==='stop') p.state='STOPPED'; else die('Invalid review decision'); } event(p,o.actor,'COORDINATOR_DECISION',{decision:o.decision,rationale:o.rationale??null}); await save(o.packet,p); console.log(JSON.stringify({ok:true,state:p.state})); }
async function commandValidate(o){ const value=await json(o.file); const validators={packet:validatePacket,authority:validateAuthority,lease:validateLease,operation:validateOperation,handoff:validateHandoff,'audit-report':validateAuditReport}; if(!validators[o.type]) die('Unknown validation type'); await strictSchema(o.type,value); validators[o.type](value); console.log(JSON.stringify({ok:true,type:o.type})); }
async function commandStatus(o){ const p=await json(o.packet); validatePacket(p); console.log(JSON.stringify({id:p.id,state:p.state,risk:p.assurance_risk,terminal:terminal.has(p.state),last_event_hash:p.events.at(-1)?.event_sha256??null},null,2)); }

const {command,options}=argsOf(process.argv.slice(2));
try { if(!ROLES.has(options.actor) && ['packet-create','authority-delegate','lease-issue','write','route','freeze','handoff','audit','review'].includes(command)) die('A canonical actor is required'); const commands={'packet-create':commandPacketCreate,'authority-delegate':commandAuthorityDelegate,'lease-issue':commandLeaseIssue,write:commandWrite,route:commandRoute,freeze:commandFreeze,handoff:commandHandoff,audit:commandAudit,review:commandReview,validate:commandValidate,status:commandStatus}; if(!commands[command]) die(`Unknown command: ${command??''}`); await commands[command](options); }
catch(error){ console.error(`GOVERNANCE_DENIED: ${error.message}`); process.exitCode=1; }
