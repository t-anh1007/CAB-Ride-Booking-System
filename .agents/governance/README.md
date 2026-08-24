# CAB agent governance

This directory provides four agent profiles and a fail-closed CLI for the governed chain:

`Owner -> Coordinator -> Specialist/Worker -> Auditor when required -> Coordinator`

Only Worker can change project bytes, and only through `write`. The CLI verifies the packet, authority, exact path allowlist, frozen hashes, active write lease, expiry, stop gates, actor separation, and current state before touching a file. It governs actions routed through the CLI; it cannot prevent an external editor from changing the repository.

## Routing defaults

| Complexity / risk | Requested runtime |
|---|---|
| EASY + LOW | luna / medium |
| MEDIUM or balanced | terra / high |
| HARD, HIGH, or CRITICAL | sol / high or xhigh |
| Deep Auditor | sol / ultra |

`requested_runtime.enforced` must be `false`: the tuple records routing intent and is not proof that a platform honored it. HIGH and CRITICAL require audit. LOW may skip audit when residual uncertainty is empty; MODERATE requires a recorded Coordinator decision.

## Start a packet

All paths below are relative to the repository root. Runtime artifacts should be placed in `.agents/governance/runtime/`, which is ignored by Git.

```powershell
npm run governance -- packet-create --input .agents/governance/examples/packet-request.json --out .agents/governance/runtime/packet.json --actor coordinator

npm run governance -- authority-delegate --packet .agents/governance/runtime/packet.json --out .agents/governance/runtime/authority.json --actor coordinator --subject worker --permission write --expires-at 2099-12-31T23:59:59.000Z
```

Read `id` from the generated authority and packet files, then issue the Worker lease:

```powershell
npm run governance -- lease-issue --packet .agents/governance/runtime/packet.json --authority .agents/governance/runtime/authority.json --out .agents/governance/runtime/lease.json --actor coordinator --worker worker --expires-at 2099-12-31T23:59:59.000Z
```

Copy the generated lease `id` into a runtime copy of `examples/operation.json`. Worker can then execute:

```powershell
npm run governance -- write --packet .agents/governance/runtime/packet.json --authority .agents/governance/runtime/authority.json --lease .agents/governance/runtime/lease.json --operation .agents/governance/runtime/operation.json --actor worker
npm run governance -- freeze --packet .agents/governance/runtime/packet.json --actor worker
```

For LOW risk with no residual uncertainty, Coordinator records the audit skip and accepts in two explicit steps:

```powershell
npm run governance -- review --packet .agents/governance/runtime/packet.json --actor coordinator --decision skip-audit --rationale "LOW risk and no residual uncertainty"
npm run governance -- review --packet .agents/governance/runtime/packet.json --actor coordinator --decision accept --rationale "Acceptance criteria met"
```

Use `audit --packet ... --report ... --actor auditor` for required audit, `handoff --packet ... --handoff ... --actor specialist|worker|auditor` for evidence transport, and `status --packet ...` for a compact state view.

## Validation

```powershell
npm run governance -- validate --type packet --file .agents/governance/runtime/packet.json
npm run governance -- validate --type authority --file .agents/governance/runtime/authority.json
npm run governance -- validate --type lease --file .agents/governance/runtime/lease.json
npm run governance -- validate --type operation --file .agents/governance/runtime/operation.json
npm run test:governance
```

The JSON Schemas are normative shapes. The CLI also enforces cross-document invariants and filesystem facts that schemas cannot express.
