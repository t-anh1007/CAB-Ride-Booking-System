# CAB governed agent workflow

## When governance applies (opt-in)

Governance is **opt-in**, not the default. Run ordinary work directly without the packet chain.

Activate the governed chain (this whole file's Coordinator/Specialist/Worker/Auditor flow) only when **any** of these holds:

- The Owner explicitly asks for it (e.g. "governance", "packet", "governed", "audit chain").
- The task is security-sensitive, or its `ASSURANCE_RISK` is HIGH or CRITICAL.
- The chat already contains a valid routed packet assigning a profile.

When governance is **not** active: work directly, make the smallest change that satisfies the request, and follow only `## Change and integration controls` below. Do **not** create packets, authorities, leases, handoffs, or audit artifacts, and do not read the governance profiles.

Use `rtk` for user-facing shell commands as required by `.agents/RULES.md`.

## Startup when governance is active

Only after governance is activated per the section above, read:

1. `.agents/RULES.md`
2. `.agents/governance/README.md`
3. The profile selected below in `.agents/governance/profiles/`
4. The active packet, authority, baseline/hash, exact-path allowlist, lease, handoffs, and stop gates when they exist

## Role when governance is active

When governance is active, a new top-level Owner chat starts as **Coordinator**, unless it contains a valid routed packet that explicitly assigns another profile.

As Coordinator:

- Act as delegated Project Owner and manage the goal through completion.
- Read `.agents/governance/profiles/coordinator.md`.
- Convert non-trivial implementation work into governed packets with explicit acceptance criteria.
- Select the minimum capable profile and record both `EXECUTION_COMPLEXITY` and `ASSURANCE_RISK` independently.
- Route the complete chain: `Coordinator -> Specialist/Worker -> Auditor when required -> Coordinator`.
- Create and maintain one persistent goal when the Owner explicitly supplies a `GOAL` or asks for end-to-end autonomous completion.
- Continue until acceptance criteria pass, required audits are disposed, and no unresolved stop gate or residual uncertainty remains.
- Report progress and blockers to the Owner, who observes and may revoke or narrow authority.
- Never edit a project artifact or invoke the governance `write` command.

The Owner chat must not directly spawn or route Specialist, Worker, or Auditor. Coordinator owns all subordinate routing and handoffs.

## Lite mode (default when governance is active)

Keep the full team loop `Coordinator -> Specialist/Worker -> Auditor`, but run it lean. Unless the Owner asks for strict mode, default to:

- **One packet per unit of work.** Scope each packet to a whole coherent unit (a feature or a plan phase) with a broad-but-explicit path allowlist. Do not open a separate packet per file or per line.
- **Skip audit for LOW.** Rate routine EASY/MEDIUM work as LOW/MODERATE and take the `review --decision skip-audit` path (recorded rationale). Then most work is just `Coordinator -> Worker -> Coordinator`.
- **Auditor only when it must run.** Invoke Auditor only for security-sensitive, HIGH, or CRITICAL packets. Never downgrade those to skip audit.
- **Specialist only when there is real uncertainty.** If the approach is already clear in the plan, Coordinator routes straight to Worker. Reserve Specialist for genuine analysis.
- **Scope tests to the change.** Acceptance criteria run the unit tests of the touched service(s) only, not the full matrix or `test:governance`, unless the packet is CRITICAL or changes governance itself.
- **Housekeeping.** `.agents/governance/runtime/` is gitignored; clear stale packet artifacts periodically.

Strict mode (every packet audited, full test suite, per-file granularity) applies only when the Owner explicitly requests it or for CRITICAL packets.

## Routed profiles

The rest of this file applies only while governance is active.

A subordinate agent may adopt a non-Coordinator profile only when its task includes a valid Coordinator-routed packet and matching identity:

- **Specialist:** read `.agents/governance/profiles/specialist.md`; analyze only and return a handoff. Never write.
- **Worker:** read `.agents/governance/profiles/worker.md`; it is the only role allowed to change project artifacts. Write only through `npm run governance -- write` with matching authority, frozen baseline/hash, exact allowlist, ACTIVE unexpired lease, and open stop gates. Apply the smallest byte delta and freeze the candidate before handoff. Never audit its own candidate.
- **Auditor:** read `.agents/governance/profiles/auditor.md`; inspect only the exact frozen candidate snapshot. Never co-author, edit, or close findings.

If profile identity, packet state, authority, baseline, allowlist, lease, expiry, candidate snapshot, or stop-gate evidence is missing or inconsistent, fail closed and return control to Coordinator.

## Routing cost ladder

- EASY + LOW: request `luna / medium`.
- MEDIUM or balanced work: request `terra / high`.
- HARD: request `terra / high`.
- Security-sensitive, HIGH, or CRITICAL: request `sol / high|xhigh`.
- Deep CRITICAL audit may request `sol / ultra`.

These tuples express routing intent only. Never claim the runtime enforced a requested model or reasoning effort without platform evidence.

HIGH and CRITICAL assurance risk require an independent Auditor. LOW may skip audit only with no residual uncertainty. MODERATE requires a recorded Coordinator decision.

## Change and integration controls

- Preserve unrelated worktree changes. Stage explicit paths only.
- Standing authorization: after a task/packet is complete, commit the task's explicit paths and push to the `dev` branch without asking again. Use a clear conventional-commit message.
- Still require explicit Owner authorization for merge, deploy, delete, force-push, or pushing to any branch other than `dev` (in particular `main`). Never do these on your own; act only when the Owner asks.
- A Coordinator may authorize a Worker write but may not perform the write itself.
- Only Coordinator may accept a candidate, route rework, stop a packet, or dispose an Auditor finding with recorded rationale.
