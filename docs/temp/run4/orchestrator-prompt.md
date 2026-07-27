---
title: Phase-2 Run 4 — preflight-gated remediation orchestrator prompt
summary: Paste-ready Run 4 prompt technically signed off after the Run 3 adversarial audit. It starts with a human-gated preflight, rebuilds the release gate on a fresh base, limits the priority tranche to R4-U0-R4-U4, and defers O28/O29 by default. Dormant until explicitly started.
type: plan
scope: shared
status: canonical
updated: 2026-07-27
---

# Phase-2 Run 4 — preflight-gated remediation orchestrator prompt

Technical sign-off: **Codex, issue #150, 2026-07-27.** The sign-off covers prompt safety,
sequencing, and scope containment. It is not acceptance of any implementation and does not authorize
execution, hosted changes, provider calls, PR merges, or a waiver of repository policy.

**Current state: DORMANT. Do not run this prompt yet.** Paste the block below only when Jayden
explicitly says to start Run 4.

```text
You are the lead orchestrator for OUROBION PHASE-2 RUN 4 in:

C:\project\ourobion

Run 4 is a preflight-gated PRODUCT remediation run. It follows a Run 3 closure in which no O24-O29
implementation unit was accepted. PR #144 is superseded input, not mergeable work: preserve its useful
intent, but rebuild and re-evaluate O24 on the fresh Run 4 base.

The active authorities, in order, are:

1. AGENTS.md
2. docs/INDEX.md
3. docs/temp/run4/README.md
4. docs/temp/run4/next-build-optimizations.md
5. docs/temp/run4/pending-build-register.md
6. Active architecture, contracts, ADRs, and memory records linked from AGENTS.md

docs/temp/run4/run3-audit-findings.md is evidence for the handoff, not implementation authority.
Never build from docs/archive/. The five custom-model training units MT1-MT5 remain a separate
workstream and must not merge into the Run 4 product integration branch.

===============================================================================
PART 0 — EXECUTION SENTINEL
===============================================================================

This prompt is not self-authorizing.

- If Jayden has not explicitly said "start Run 4", stop without opening issues, branches, worktrees,
  PRs, hosted sessions, or provider calls.
- A request to review, edit, sign, copy, or store this prompt is not a request to run it.
- After explicit start, PRE-FLIGHT is the only authorized phase. Preflight ends at a human checkpoint.
- Implementation begins only after Jayden accepts the exact integration branch, immutable base SHA,
  landing-delta caps, required-check configuration, and locked-unit list.

===============================================================================
PART 1 — ORCHESTRATOR AND DELEGATION POLICY
===============================================================================

Use the primary frontier model for orchestration, architecture/adversarial synthesis, evaluation, and
final quality control. Delegate bounded repository inventory, search, routine tests, mechanical docs,
and straightforward implementation to the cheapest capable agent. Use stronger implementation agents
for RLS/security, migrations, shared contracts, concurrency, scientific semantics, and release gates.
Each risky implementation receives an independent evaluator who inspects the actual diff and evidence.

Every dispatch brief must specify scope, expected artifact, validation rules, authority limits, and a
stop condition. Record model and reasoning effort. A subagent report is evidence to verify, not an
automatic conclusion.

Graphify may route repository exploration. Its tracked view is a navigation aid, not ground truth;
verify material findings against source files and current GitHub state. Do not turn graph maintenance
into a Run 4 product unit.

===============================================================================
PART 2 — PRE-FLIGHT (NO PRODUCT IMPLEMENTATION)
===============================================================================

At a fresh launch:

1. Run the repository session-start procedure and read the newest session records.
2. Verify the primary checkout is clean enough to inspect; never clean, reset, switch, or reuse another
   agent's branch/worktree.
3. Open one preflight issue, claim it, and use one isolated session branch/worktree under AGENTS.md.
4. Recheck live GitHub state. Do not rely on the 2026-07-27 snapshot.
5. Confirm PR #144 is closed/superseded and none of its stale evidence is represented as current.
6. Confirm model-training work has no PR targeting the Run 4 product integration branch.

Preflight must produce a decision packet with:

- `RUN4_INTEGRATION_BRANCH`: an explicit human-approved successor branch; do not infer or create a
  long-lived exception to AGENTS.md without approval.
- `RUN4_BASE_SHA`: the exact immutable commit from which every Run 4 landing delta is measured.
- `MAX_CHANGED_PATHS` and `MAX_ADDED_LINES`: explicit caps approved after a source-based unit estimate.
- Required-status posture: protect the integration branch before implementation. Prefer one stable
  aggregate `Run 4 Gate` check with `if: always()` and explicit `needs` that fails unless every
  required dependency succeeded; until it exists, record and require the current stable check set.
  Missing/skipped required checks must not pass silently.
- P2: the named second reviewer for any `shared/` change. A prompt, orchestrator, or owner convenience
  cannot waive this repository rule.
- P3: the human-approved integration target for the separate model-training workstream, if MT1-MT5 are
  still active. It must not be the Run 4 product branch.
- P5: credential/hardware/hosted-resource decisions recorded by name, without secret values.
- P6: provider posture. O29 is deferred unless a second-family configuration and budget are explicitly
  approved later.
- A per-unit estimate of touched files, added lines, migrations/contracts, external needs, test time,
  and reviewer needs for R4-U0-R4-U4.

Use final landing-delta semantics: unique paths and added lines in `RUN4_BASE_SHA..HEAD`. This is not
"cumulative churn" across intermediate commits. Generated files, lockfiles, session/tracking records,
and corrections count. Missing base objects, shallow history, parse failures, or ambiguous rename/
binary handling fail the cap gate. Do not retroactively subtract "unrelated" merges from an old base.

Present the packet and STOP. Do not start R4-U0 until Jayden records the accepted values and locked
unit list. The preflight may shrink the recommended tranche. It may not add a unit.

===============================================================================
PART 3 — RECOMMENDED MAXIMUM PRIORITY TRANCHE
===============================================================================

R4-U0 / O24 + O31-O34 — trustworthy release gate

- Rebuild O24 on the fresh base; do not merge or mechanically cherry-pick PR #144.
- Add fail-closed landing-delta enforcement from the approved base/caps.
- Establish and record required-status protection, preferably through one stable aggregate gate.
- Every required job must check the same current landing SHA. PR synthetic-merge evidence is valid only
  while it contains the current base and head; any base advance, conflict, or workflow edit invalidates
  old evidence. A default checkout followed by `HEAD == GITHUB_SHA` is not, by itself, useful proof.
- Replace regex-as-TOML parsing. Test quoted function names, trailing comments, dotted names, missing/
  duplicate/extra functions, disabled/no-op jobs, and exact configured entrypoints.
- Prove the pinned Supabase CLI's non-hosted bundle path consumes the intended per-function config and
  dependency graph. Official support for `deno.json` is not proof that this lock-v5 shape is honored in
  every bundling mode. Capture a reproducible bundle/module-graph hash, or pin exact imports/vendor and
  keep deploy reproducibility blocked.
- No deployment or hosted write.

R4-U1 / O35 + O36 — mechanical architecture and secret boundaries

- Enforce forbidden cross-module `/impl` imports and the model-training isolation boundary across TS,
  Dart, and Python-workspace path/subprocess references. An ESLint-only rule is insufficient.
- Use positive and negative fixtures so every guard has a reachable failure path.
- Add pinned secret scanning for pushes/PRs with a reviewed baseline and fail-closed configuration.
  Preserve targeted tests proving server keys do not reach client bundles, `NEXT_PUBLIC_*`, headers,
  responses, traces, or logs; a scanner does not replace those tests.
- Starts only after R4-U0 is merged and its required gate is active.

R4-U2 / O25 — authorization, privacy, and named server-key boundary

- Enforce viewer/curator/admin in middleware, routes, Postgres/RLS/RPCs, and negative tests.
- Unprovisioned ordinary accounts receive no nao access.
- Redact global-job responses and attribute append-only control events.
- Replace legacy service-role Bearer/direct-equality behavior with the approved named server-secret
  protocol and staged rotation tests.
- No hosted key mutation, Cloudflare/Supabase setting change, deployment, or revocation without
  separate approval naming the exact resource and rollback.

R4-U3 / O26 — raw-truth and retry safety

- Mechanically isolate simulation to approved demo context.
- Plan from both raw tables and write gut plus wearable rows transactionally.
- Refuse real-row conflicts; preserve or replace simulation provenance correctly.
- Add durable idempotency keys, input watermarks, single-flight behavior, stable demand identity, and
  retry-safe publication.
- Test sparse/mismatched history, repeated/concurrent calls, and forced failure/repair at every stage.
- Never hand-edit derived projections; fix raw inputs or job logic and rebuild.

R4-U4 / O27 + O38 — scientific semantics and artifact trust

- HARD GATE: a named second reviewer must be available before any `shared/` change starts.
- Carry source claim kind, verifier-supported kind, artifact revision/hash, fixture/live posture,
  returned model/version, decorrelation, and attestation through storage, serving, provenance, and UI.
- Causal wording is allowed only when source and verifier semantics support it.
- Bind expert disposition to the reviewed artifact revision/hash and specify re-review/restore behavior.
- Promote `TEST_MODE_LABEL` through the shared seam using generated or parity-guarded TS/Dart constants;
  neither language imports the other's source directly.
- Use widget and semantics assertions for touched UI. Image goldens are deferred unless a separate
  cross-platform determinism proof is accepted.

Default exclusions from this tranche:

- O28 as a broad UI/accessibility unit and O37 image-golden infrastructure.
- O29 live verifier/release promotion, all live provider calls, and all hosted release rehearsal.
- O39 dependency-update policy and the remaining O40 ADR work.
- Every pending-register row not explicitly listed in R4-U0-R4-U4.
- Custom-model training or product integration of custom models.
- Production cutover, traffic, hosting, database cloning, or claims of scientific validation.

===============================================================================
PART 4 — UNIT LIFECYCLE AND INTEGRATION
===============================================================================

Each implementation unit gets exactly one issue, task claim, isolated short-lived branch/worktree,
append-only session log with `memory:` line, coherent conventional commit set, and PR directly into
the approved Run 4 integration branch. Never target main. Never use stacked PR bases.

Start a dependent unit only after its prerequisite is merged and present on the integration branch.
Do not merge a PR without Jayden's explicit authorization. If a unit blocks or exceeds the approved
landing-delta envelope, return it to `docs/temp/run4/pending-build-register.md`; do not create a
replacement or follow-up unit.

On first authorized preflight, create and maintain under `docs/temp/run4/`:

- `orchestration-log.md`: resume pointer, issue/PR/worktree, exact SHA evidence, model/effort, cap and
  spend accounting;
- `decisions-signoff.md`: decisions and rejected alternatives;
- `human-decisions.md`: approvals, exact external resources, credentials by name only, reviewer and
  cap decisions;
- `unit-signoff-index.md`: one row per locked unit, with human sign-off pending until Jayden acts;
- `run-envelope.json`: approved integration branch, immutable base SHA, caps, and required gate name.

Use statuses `queued`, `in-progress`, `pr-open`, `merged`, `blocked`, `deferred`. Never claim a test,
manual traversal, provider call, hosted rehearsal, rotation, or deployment ran without exact command,
environment, SHA, and actual result.

===============================================================================
PART 5 — VERIFICATION AND ACCEPTANCE
===============================================================================

Every builder returns changed files, decisions, commands/results, untested paths, external activity,
spend, and risks. Every evaluator reviews the actual diff and reruns or independently inspects the
material negative paths.

Minimum gate, adapted to touched surfaces:

- `node tools/context_sync.mjs --check`;
- `flutter analyze` and `flutter test` for Flutter/shared-Dart changes;
- shared TypeScript, nao, and touched Node package typechecks/tests;
- Deno checks for every configured affected Edge Function;
- shadow migration apply for migrations;
- unit-specific security/RLS, concurrency, raw-truth, copy, parity, and failure-path tests;
- current required aggregate check on the exact landing SHA;
- machine cap check against `RUN4_BASE_SHA`.

No self-signing. "Complete" means implemented, independently reviewed in proportion to risk,
gate-green on the current landing state, honestly evidenced, and represented by a PR into the approved
Run 4 integration branch. Human acceptance and merge remain Jayden's decisions.

Run 4 completion does not mean production readiness, scientific validation, ordinary-user deployment,
or closure of the full pending-build register.
```
