# PathForge — Ascend builder submission

## One-line pitch

PathForge is the non-custodial control plane that helps token teams turn an opaque Elysium-to-HyperCore graduation ceremony into a verifiable, repeatable, and auditable workflow.

## The problem

Graduation is not a single transaction. Teams must reconcile token metadata, decimal and supply constraints, genesis allocations, ticker availability, deployer state, bridge progress, and permanent-link evidence across multiple systems. A mistake can block a launch or create a configuration that is difficult to reverse. Today, the operational knowledge is fragmented and the evidence is hard to preserve.

## The product

PathForge gives each team a wallet-owned workspace with live token inspection, deterministic preflight checks, lifecycle simulation, unsigned action compilation, saved reports, validation history, live public-evidence monitoring, and alert rules. It is non-custodial: authentication uses a message signature, while execution stays in the builder's wallet or the official launch flow.

## Judging criteria

### Execution — 25%

- Live full-stack deployment with a public read-only demo.
- Elysium JSON-RPC and Hyperliquid testnet API integrations.
- Wallet authentication and owner-scoped project persistence.
- Deterministic validation, simulation, unsigned action drafts, reports, monitoring, and alerts.
- Automated tests, dependency audit, CI, security headers, origin checks, and distributed rate limits.

### Usefulness — 25%

PathForge reduces ceremony risk before any irreversible action. Builders get one place to identify blockers, inspect the evidence behind each status, retain an audit trail, and hand a validated unsigned payload to their preferred execution route.

### Long-term vision — 25%

1. Add authoritative bridge-message and permanent-link adapters as official interfaces become available.
2. Add scheduled monitoring, webhook/Discord notifications, and team roles.
3. Add wallet-based transaction simulation and an opt-in official execution adapter without taking custody.
4. Publish reusable validation schemas and an SDK for launch platforms, auditors, and ecosystem dashboards.
5. Expand the lifecycle model from testnet graduation to post-launch liquidity, supply, and incident monitoring.

### Originality — 25%

Most launch tools focus on transaction submission or a point-in-time form. PathForge treats graduation as a lifecycle with provenance: every status is tied to observable evidence, unknown states remain explicitly unknown, and every plan can be reproduced as a validation report. This evidence-first, non-custodial approach makes the operational process legible without pretending private criteria are public facts.

## Two-minute demo script

1. Open **Projects** and explain that the public demo is readable while wallet-owned workspaces require a signed message.
2. Open the demo project and refresh the token to show live Elysium RPC metadata and bytecode evidence.
3. Open **Planner and Simulator**, change a plan field, and show deterministic pass/fail feedback.
4. Build the unsigned payload and stress that PathForge cannot sign or broadcast it.
5. Generate the preflight report to show a portable audit artifact.
6. Open **Monitoring and Alerts**, refresh live evidence, and show source-labelled token, ticker, deployer, and order-book states.
7. Point out that bridge and permanent-link states say `unavailable` rather than fabricating certainty.
8. End on the roadmap: official adapters, scheduled alerts, team workflows, and an ecosystem SDK.

## Honest scope

This build is an independent hackathon prototype. It does not claim official Ascend qualification, infer private judging or graduation rules, submit transactions, or hold keys. The monitoring layer reports only what the configured public interfaces can prove.
