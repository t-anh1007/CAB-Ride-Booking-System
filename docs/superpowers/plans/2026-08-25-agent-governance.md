# Agent Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed local agent governance CLI with four profiles, strict JSON artifacts, leased byte writes, frozen audits, and Coordinator-controlled closure.

**Architecture:** A dependency-free Node.js CLI validates JSON artifacts against repository schemas and semantic invariants, persists hash-chained packet state, and applies exact byte splice transactions. Markdown profiles define behavioral constraints while executable role checks enforce them.

**Tech Stack:** Node.js ESM, `node:test`, JSON Schema 2020-12, SHA-256, PowerShell-compatible npm scripts.

**Spec:** `docs/superpowers/specs/2026-08-25-agent-governance-design.md`

## Global Constraints

- Only Worker may change project artifacts through the CLI.
- All governed project paths are exact normalized repository-relative paths.
- No new runtime dependency.
- Runtime model/reasoning tuples are requests, not claims of platform enforcement.
- Preserve unrelated worktree changes and do not commit.

---

### Task 1: Profiles and schemas

**Files:** Create `.agents/governance/profiles/*.md`, `.agents/governance/schemas/*.schema.json`, `.agents/governance/README.md`.

**Interfaces:** Produces the canonical role contracts and JSON shapes consumed by the CLI.

- [ ] Add four profile contracts with explicit allowed and denied actions.
- [ ] Add strict schemas for packet, authority, lease, operation, handoff, and audit report.
- [ ] Document lifecycle, routing matrix, bootstrap boundary, and CLI usage.

### Task 2: Failing governance tests

**Files:** Create `.agents/governance/test/governance-cli.test.mjs`.

**Interfaces:** Invokes the CLI as a subprocess and asserts filesystem-visible behavior.

- [ ] Test a complete low-risk write and audit-skipped acceptance path.
- [ ] Test direct Owner routing, Coordinator writes, expired leases, drift, and traversal rejection.
- [ ] Run `node --test .agents/governance/test/governance-cli.test.mjs` and confirm failure because the CLI is absent.

### Task 3: Fail-closed CLI

**Files:** Create `.agents/governance/scripts/governance-cli.mjs`, modify `package.json`.

**Interfaces:** Produces `packet create`, `validate`, `route`, `authority delegate`, `lease issue`, `write`, `freeze`, `handoff`, `audit`, `review`, and `status` commands.

- [ ] Implement strict parsing, semantic validation, identity/role checks, expiration, exact-path resolution, SHA-256 canonical JSON, and event chaining.
- [ ] Implement preflighted byte splice writes with rollback and post-write verification.
- [ ] Implement frozen candidate audit and Coordinator-only review transitions.
- [ ] Add `governance` and `test:governance` npm scripts.
- [ ] Run focused tests until green.

### Task 4: Examples and final checks

**Files:** Create `.agents/governance/examples/*.json`.

**Interfaces:** Provides copy-ready inputs and smoke-test documentation.

- [ ] Add example packet, authority, operation, handoff, and audit report.
- [ ] Run schema/example validation and the complete governance test suite.
- [ ] Inspect git diff and report modified versus verified scope separately.
