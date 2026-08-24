# Agent Governance Design

## Goal

Provide a fail-closed, repository-local governance workflow in which an Owner delegates project decisions to a Coordinator, the Coordinator routes work to the minimum capable profile, only a leased Worker can change project bytes, and an independent Auditor is used only when assurance demands it.

## Profiles

- **Coordinator:** owns routing and project decisions; reads project state, authority, baselines, hashes, allowlists, handoffs, and stop gates. It never changes project artifacts.
- **Specialist:** read-only analyst that produces recommendations and residual uncertainty. It cannot route, delegate, lease, or write.
- **Worker:** the only profile allowed to apply project byte changes. It requires an exact-path allowlist, frozen baseline hashes, valid authority, a unique unexpired write lease, and open stop gates. It cannot create product decisions or audit its own candidate.
- **Auditor:** independent and read-only. It audits an exact frozen candidate snapshot, evidence integrity, hashes, findings, and drift. It cannot co-author, change files, or close findings.

The Owner can create and observe Coordinator work but cannot directly route a Specialist, Worker, or Auditor.

## Architecture

Artifacts are JSON documents validated against JSON Schema plus cross-document semantic rules. A Node.js CLI is the sole governed route for packet transitions and writes. State events form a SHA-256 hash chain. Project writes use exact relative paths and byte splice operations; the CLI validates the entire transaction before writing and rolls back on a partial failure.

The CLI governs only actions performed through it. It does not claim to prevent a human or another runtime from editing files outside the workflow.

## Artifacts

- Packet: goal, acceptance criteria, baseline, allowlist, complexity/risk tuple, requested runtime, stop gates, state, expiry, participants, and event chain.
- Authority: issuer, subject, packet scope, permissions, expiry, and integrity hash.
- Write lease: Coordinator-issued, single Worker, single packet, exact allowlist, baseline hash, expiry, and integrity hash.
- Operation: packet/worker/lease identity plus exact byte splices and pre-write hashes.
- Handoff: author profile, frozen snapshot or recommendation, evidence, and residual uncertainty.
- Audit report: Auditor identity, frozen candidate hash, drift/evidence checks, findings, and verdict. Only the Coordinator disposes findings.

Runtime artifacts live below `.agents/governance/runtime/`; paths listed in a packet are repository-relative, normalized, non-glob exact file paths. Symlinks, path traversal, directory targets, and paths outside the repository are rejected. File creation must be explicitly allowed.

## Lifecycle

`DRAFT -> READY -> SPECIALIST_REVIEW? -> WORKER_AUTHORIZED -> WRITING -> CANDIDATE_FROZEN -> AUDIT_REQUIRED|AUDIT_SKIPPED -> COORDINATOR_REVIEW -> ACCEPTED|REWORK|STOPPED|EXPIRED`

Invalid schema, role separation, authority, state, baseline, hash, allowlist, lease, expiry, or stop-gate checks fail with a non-zero exit code before any write. Drift stops the packet. Findings can only be accepted, rejected with rationale, or routed to rework by the Coordinator.

## Routing

Routing records two independent axes: `EXECUTION_COMPLEXITY` (`EASY`, `MEDIUM`, `HARD`) and `ASSURANCE_RISK` (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`). Defaults are luna/medium for easy low-risk work, terra/high for balanced work, and sol/high or xhigh for hard or high-risk work. Deep audit may request sol/ultra. These are requested tuples; the CLI does not claim the runtime enforced them.

High and critical risk require an Auditor. Low risk may skip audit when residual uncertainty is empty. Moderate risk uses the Coordinator's recorded audit decision. Runtime choices may be upgraded; a downgrade needs rationale and critical risk cannot be downgraded.

## Verification

Automated Node tests cover schema rejection, role permissions, direct Owner routing rejection, path confinement, baseline drift, lease expiry, write/freeze/audit/review flows, optional audit, frozen snapshot integrity, and transaction rollback behavior. A PowerShell-friendly example demonstrates a complete packet.
