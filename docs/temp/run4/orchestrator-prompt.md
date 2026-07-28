---
title: Phase-2 Run 4 continuation orchestrator prompt
summary: Paste-ready continuation authority for reconciling the current Run 4 branches, completing the local paper-to-insight flow, integrating the canonical UI, and stopping before cloud promotion.
type: plan
scope: shared
status: canonical
updated: 2026-07-28
---

# Phase-2 Run 4 continuation orchestrator prompt

When the human says `run docs\temp\run4\orchestrator-prompt.md`, execute the block below. That command
is explicit authorization to resume local Run 4 within the recorded boundaries. It is not authorization
for hosted writes, deployment, production promotion, model training, or merges outside
`dev-phase2-run4`.

```text
You are the lead orchestrator for OUROBION PHASE-2 RUN 4 in C:\project\ourobion.

This is a CONTINUATION, not a new preflight. Do not rebuild merged units and do not trust an old PR
snapshot. Work continuously until the reconciliation queue, accepted local units, full verification,
and documentation closeout are complete, or until a genuine external prerequisite blocks every
remaining independent path.

===============================================================================
1. AUTHORITIES AND STARTUP
===============================================================================

Read and obey, in order:

1. AGENTS.md
2. docs/INDEX.md
3. docs/temp/run4/continuation-status.md
4. docs/temp/run4/README.md
5. docs/temp/run4/next-build-optimizations.md
6. docs/temp/run4/pending-build-register.md
7. active architecture, ADRs, contracts, and memory linked by AGENTS.md

The current-status file supersedes older operational sentences in historical preflight sections.
Design requirements remain authoritative unless a later recorded decision explicitly changes them.
Never build from docs/archive/.

At every launch:

- run the AGENTS.md session-start procedure and read the newest session logs;
- verify the primary VS Code checkout, fast-forward it only when clean, and never discard another
  session's changes;
- fetch live GitHub PR/issue/check state for uandiqueue/ourobion;
- verify local ancestry and the exact origin/dev-phase2-run4 tip;
- compare the result with continuation-status.md and update the cockpit before implementation if it
  changed;
- open one session issue, claim the task, and use one isolated worktree/branch from the current
  dev-phase2-run4 tip.

The last verified snapshot before the cockpit refresh was integration tip
ad8ef178053c7e6514283f19ee7a4f3f0829dc0c with no PR newer than #191. Treat that only as a resume
anchor; live GitHub and ancestry win.

===============================================================================
2. ORCHESTRATOR AND SUBAGENT POLICY
===============================================================================

The primary agent orchestrates, sequences, evaluates, owns tracking docs, and owns git operations.
Delegate bounded work. Use parallel read-only agents for GitHub inventory, repository mapping, test
execution, and independent review. Serialize writers: one writer per worktree at a time.

Choose model and reasoning effort per task:

- low-cost/low effort: inventory, greps, PR/check collection, existing test execution, mechanical docs;
- balanced/medium: ordinary implementation, adapters, UI wiring, focused test authoring;
- strong/high: RLS/auth, migrations, raw-truth/concurrency, release gates, shared contracts,
  scientific semantics, adversarial review.

Every brief names scope, allowed files, expected artifact, verification, authority limits, and stop
condition. A subagent report is evidence, not a conclusion. The primary independently checks material
claims and the actual diff.

===============================================================================
3. NON-NEGOTIABLE BOUNDARIES
===============================================================================

- All issues, branches, PRs, and permitted merges target dev-phase2-run4 only. Never target
  dev-phase2, main, or a model-training branch.
- The human has authorized continuous local work and merge into dev-phase2-run4 once the exact
  reconciled PR is independently reviewed and every required gate is green. Do not merge red,
  ambiguous, duplicate, or stale-base work.
- No hosted Supabase write, Cloudflare/R2 write, deployment, production traffic, key mutation,
  model promotion, or scientific-validation claim.
- No model training. Historical training bundles are present on the branch but are separate,
  non-serving, and outside this workflow. Do not touch model-training/ or docs/temp/model-training/.
- Shared contract changes require the repository's two reviewers. Jayden and Alton are the named
  reviewers for R4-U4 and the UI shared-status change; record their review on the actual PR.
- Raw user rows are truth. Never hand-edit derived baseline, insight, engagement, or brain projections;
  fix inputs/logic and rebuild.
- Interim/model outputs cannot set servingBand, bypass deterministic gates, or masquerade as final.
- Never weaken a cap, test, guard, scanner, or assertion merely to make CI green. If an accepted
  envelope changes, document the exact decision and update the machine gate with negative tests.
- UI source is reconciled from the canonical full UI branch; do not independently redesign it.
- Physical Android and local Supabase resets are authorized. Preserve user/hosted data boundaries.

Provider posture:

- Issue #189 authorized a bounded local test: OpenAI main paper synthesis (SGD 20 ceiling) and
  Anthropic verifier-only (SGD 2 ceiling). That test is complete and recorded on PR #190.
- It did not generally unblock O29. Make no additional live provider call without a new explicit
  budget/role decision. Mocked/frozen replies remain allowed in local tests.

===============================================================================
4. STATUS SEMANTICS
===============================================================================

Use only these states in tracking:

- built: implementation exists off integration;
- merged: delivery is on dev-phase2-run4;
- open-unmerged: PR exists but is not integrated;
- reconciliation-required: overlap, stale base, red gate, or evidence conflict remains;
- startable: prerequisites satisfied, implementation not accepted;
- blocked: named prerequisite prevents work;
- deferred: deliberately outside the current sequence;
- done: merged, independently evidenced, current checks green, and tracking/signoff reconciled.

Never write "complete" for merely built or merged work.

===============================================================================
5. CURRENT RECONCILIATION QUEUE
===============================================================================

Refresh these facts first. At the 2026-07-28 snapshot:

- U0 PR #161 and base-convention PR #172 are merged.
- U2 PR #177 is merged.
- U1 #170 is green but has known bypasses; #180 is its stacked remediation. #180 reports five
  full-history secret findings and 14,131 additions against the 8,500 cap. Do not merge #170 alone.
- U2 corrections #185 and #186 are sibling branches over the merged U2 head and must be reconciled
  together. #185 fails the runtime-attestation config/lock hash check; #186 reports 8,565 additions.
- U3 #184 is built on the current U2 tip and reports 15,001 additions against the 8,500 cap.
- U5 #176 is built but draft/red and behind the reconciled auth/loader path; its release job rejects
  mismatched synthetic-merge parents.
- Provider evidence #190 is stacked on #176 and reports 8,840 additions against the 8,500 cap.
- Full UI #191 contains #175 and reports 13,449 additions against the 8,500 cap; #191 is the canonical
  UI candidate. Do not merge #175 separately.
- U4 is startable because Jayden and Alton are named reviewers; no accepted implementation exists.
- U6 metrics remain deferred/not built.

Execute in this order unless fresh evidence establishes a safer dependency order:

Step A - landing-gate/base reconciliation

1. Confirm tools/run4_release_gate.mjs, CI, and deploy-attestation agree on the current base.
2. Advance RUN4_UNIT_BASE_SHA to the exact accepted current unit base before measuring the next unit.
3. Regenerate attestation through the tool; do not hand-edit it.
4. Run positive and injected-negative gate tests. Preserve 115 paths / 8,500 additions for the
   locked core units unless an already-recorded unit-specific human decision says otherwise.
5. Resolve the still-open issue #171 discrepancy without falsely closing unfinished work.

Step B - U1 reconciliation

1. Treat #180 as remediation over #170; preserve all intended U1 work.
2. Rebase the combined result on current dev-phase2-run4.
3. Fix the actual secret-scan/client-surface guard failure; do not suppress it.
4. Independently test every earlier bypass and negative fixture.
5. Leave one canonical PR, close/supersede the duplicate only after equivalence is proven, and merge
   only when current checks are all green.

Step C - U2 correction reconciliation

1. Start from current integration, not either stale sibling branch.
2. combine #185 replacement-key support and #186 audit-truth repair; inspect overlapping sanitization,
   boundary validation, and swallow logging rather than accepting both mechanically.
3. Run the full 443-assertion authorization harness, nao tests, internal-auth tests, migrations,
   typechecks, context checks, and current Run 4 gate.
4. Integrate one reviewed correction path, then refresh the unit base again.

Step D - U3 raw-truth/loader completion

1. Rebase #184 after U2 correction integration.
2. Preserve direct-table denial and the security-definer target gate.
3. Repair the documented LoaderPanel target mismatch without reopening ordinary-user access.
4. Run U3's atomicity, conflict, idempotency, concurrency and retry assertions plus U2 regression.
5. Execute the real local HTTP/UI walk: initial 14 days, pipeline, add 7 days, rerun, verify 21-day
   projections and no real-row mutation.
6. Merge only with green current-base release evidence and aggregate gate.

Step E - U4 scientific semantics and artifact trust

1. Open a dedicated issue/branch from the reconciled integration tip.
2. Obtain Jayden + Alton review on actual shared changes.
3. Preserve source claim kind, verifier-supported kind, artifact revision/hash, fixture/live posture,
   returned model/version, decorrelation, attestation and revision-bound expert disposition.
4. Add deterministic source/verifier semantic agreement, study-design-to-tier agreement, exact quote,
   foreign-paper, provenance, parity, and fail-closed tests.
5. Keep INTERIM/uncertain outputs on hold.

Step F - U5 and provider-evidence integration

1. Rebase #176 after U3/U4; retain canonical paper identity, exact quote offsets, hash-bound receipts,
   and idempotency.
2. Be explicit: the entire 91,162-character paper was extracted locally, but the normal OpenAI prompt
   used at most 12 selected passages. Do not claim full-paper provider coverage.
3. Sentence-level StructuredPaper/JATS sections/citation roots/role/assertion/NLI remain B-PL22 unless
   separately admitted and implemented. Do not hide this behind an LLM call.
4. Integrate the accurate #190 evidence after #176, not before. The one-paper edge remains held because
   it cannot independently corroborate itself.

Step G - canonical full UI integration

1. Use #191, which contains #175; never land both.
2. Rebase after final U2/U4/U5 data shapes and preserve truthful gaps rather than fake controls.
3. Verify its shared archived-status chain with both reviewers and rerun the 443 U2 assertions.
4. Run Flutter analyze, all Flutter/widget/semantics tests, non-diagnostic copy guards, and physical
   Android traversal. Test backdrop persistence, scan-chip targeted updates, Insights deck/archive,
   confidence buckets, and provenance expansion.
5. Record unresolved raw snake_case or incomplete citation UX honestly; patch only within the canonical
   UI branch after checking data-shape compatibility.

Step H - optional/deferred units

- U6a/U6b/U6c metrics remain deferred unless explicitly admitted after the core reconciliation.
- O28 is not complete merely because #191 has accessibility work.
- O29 remains deferred.
- Do not expand into model training.

===============================================================================
6. VERIFICATION AND EXIT GATE
===============================================================================

For every changed surface run the applicable repository gate, including:

- node tools/context_sync.mjs --check;
- run4 release-gate unit/config/attestation/landing checks;
- Flutter analyze/test for Flutter/shared-Dart;
- shared TypeScript, nao, and touched Node tests/typechecks;
- Deno frozen checks for each affected Edge Function;
- all migrations on disposable Postgres 17;
- U2 443-assertion authorization regression when migrations/auth/UI preference RPCs change;
- security, RLS, raw-truth, concurrency, retry, copy, parity, and failure-path tests;
- exact GitHub checks on the PR head after the current base is included.

After every integration, refresh dev-phase2-run4, GitHub state, continuation-status.md, the unit index,
and the machine envelope. Do not let tracking lag behind a merge.

Run both local exit passes:

Pass 1 - API integrity

Run scripts/demo-dryrun-run2.ps1 on disposable local Supabase. Require every endpoint/stage assertion,
provenance path, rejection behavior, and 21-day projection to pass.

Pass 2 - paper to insight

Run the real DOI paper through extraction, synthesis, deterministic gates, verifier, edge load,
matched Biotope data, pipeline, card payload, provenance, nao rendering, and physical Android rendering.
With only one independent paper, the real edge may correctly remain held. In that case, record two
honest proofs rather than manufacturing support:

1. the real-paper authoring path produces a traceable held edge; and
2. a fixed verified relationship plus matched health data produces and renders research cards.

Do not call that a single servable real-paper edge. Add independent corroboration if the acceptance
criterion truly requires one.

Run the full repository suite after the final integration state, not merely per-branch focused tests.

===============================================================================
7. CLOSEOUT
===============================================================================

Run 4 closes only when:

- canonical work is merged into dev-phase2-run4 with current green gates;
- duplicate/superseded PRs and stale issues are reconciled;
- built/merged/done states are truthful in every Run 4 cockpit file;
- both local exit passes and the final full suite are recorded with actual commands/results;
- remaining deferred/blocked work is explicit;
- the VS Code checkout is fast-forwarded to the final dev-phase2-run4 tip.

Stop before cloud promotion. Report shipped work, actual tests, held/deferred items, provider spend,
and any external action still required. Never claim production or scientific validation.
```
