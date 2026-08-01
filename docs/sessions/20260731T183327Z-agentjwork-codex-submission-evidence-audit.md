---
title: Submission evidence, seed coverage, and stale-doc audit
summary: Audited the blocked hackathon submission drafts against implementation evidence, decided issue-297 seed coverage without executing ingestion, corrected the issue-264 envelope record, and recorded the issue-290 base advance.
type: session
scope: docs
status: completed
updated: 2026-08-01
---

# Submission evidence, seed coverage, and stale-doc audit

## Attempted

- Audited the existing hackathon write-up and connection map claim by claim without drafting final
  submission prose.
- Checked active metric/blueprint coverage, the `seed-queries` generator and artifact path, workflow
  execution posture, provider-acceptance results, current synthesis results, paper-lineage scope,
  release-base evidence, and stale documentation across `docs/`.
- Kept substantive work docs-only: no provider calls, ingestion, R2 writes, database writes,
  deployment, app/shared-contract changes, or changes/comments on excluded workstream issues. On
  resumption, issue #309 explicitly required the single mechanical non-doc exception: refresh the
  product snapshot assertions in `tools/run4_release_gate.test.mjs` before landing PR #305.

## Changed

- Added `docs/temp/run4/submission-verification-audit.md` with reproducible evidence, claim
  classifications, architecture traps, and a prioritized submission defect list.
- Added `docs/temp/run4/seed-coverage-audit-297.md`, covering all 24 active metrics and all ten
  generated metric pairs and recording the no-execution decision.
- Added `docs/temp/run4/documentation-freshness-audit-2026-08-01.md` as a report-only stale-doc sweep.
- Added `docs/temp/run4/per-unit-release-base-290.md` and corrected the #290 measurement in the #264
  product-envelope record to 512 paths / 71,841 additions at merge `f8cb752`.
- Marked the existing submission write-up and system map `DO NOT SUBMIT` and changed their generated
  index summaries from submission-ready/current to blocked.
- Added the new records to the Run 4 document table and regenerated `docs/INDEX.md`.
- After PR #292 landed, merged integration head `dea055c`, refreshed the implementation-sensitive
  audit facts, and kept this PR's comparison diff docs-only.
- Resumed under issue #309, rebased repeatedly through the serialized integration queue and most
  recently onto `226bfef`, refreshed the audit for the measured whole-paper/mechanism/blueprint path,
  and expanded #297 into a 22-topic execution handoff.
- Recorded #307's measured batch honestly: 15 papers synthesised plus one resumable skip, 10 claims,
  one blueprint, incomplete Agnes verification, and no projection/card result.

## Decided

- Provider acceptance is evidence of authenticated ordered transport and fail-closed behavior only;
  an uncertain 0.3 verdict with zero supporting sources, a held edge, and no card is not evidence of a
  scientifically successful research edge.
- The two zero-claim live attempts are the pre-#300 baseline. Post-#300 synthesis now emits real
  quote-gated claims, but the final narrative remains blocked until grounded verification,
  projection, and cards are measured.
- Issue #297 requires no `seeds.ts` edit or ingestion in this docs session. The current generator
  enumerates only ten metric pairs, eight of which are product derivations/provenance rather than
  discovery questions; the accepted audit hands Session A a 22-topic instrument-aware pool.
- Model-training/evaluation claims remain outside the submission pending issue #277.
- The #290 per-unit-base advance leaves the 115-path / 8,500-line gate, immutable product base,
  product-cap non-acceptance, and hosted-parity non-acceptance unchanged.

## Left

- Rewrite the final submission narrative and connection map only after #307 comments its remaining
  grounded verification, projection, and card result and #277 resolves or excludes all model claims.
  The cloud workflow remains built but never executed.
- Re-run all counts, machine artifacts, costs, lineage outputs, and tests from the final integration
  head; the 533-path / 75,645-line product measurement is point-in-time only.
- Owning architecture sessions should later separate built/planned state in the stale brain-path docs;
  this session deliberately did not mass rewrite them.

## Blockers

- Final narrative: #307 has measured synthesis, but hosted state remains `verified_edges 0`,
  `relationship_claims 0`, `edge_verifications 0`, and no edge-derived card.
- Any support-model performance/training prose: issue #277.
- A submission-ready live provider/corpus statement: durable machine outputs must land on the target
  branch and be reproduced there.
- None for PR #305: #309 explicitly authorized the two forced product-union literals as a mechanical
  exception to this session's otherwise docs-only territory. The narrative hold is intentional
  sequencing, not a merge blocker for the audit records.

## Verification

- `node tools/context_sync.mjs --fix-index` — regenerated the three generated indexes.
- `node tools/context_sync.mjs --check` — passed before commit.
- `git diff --check` — passed before commit.
- GitHub issue #303 carries the pre-PR evidence summary and territory declaration.
- PR #292 / Session A merged at `dea055c`; the target was merged into this branch and product-cap
  output was remeasured at 536 paths / 76,360 additions for that integration head.
- Rebased through `226bfef`; `seed-queries --candidates-only` reproduced 6 static topics + 16 total
  candidates (8 derived, 2 rule, 6 topic); active registry load reproduced 24 keys.
- Post-rebase measurement before the final record refresh: 573 paths / 84,907 additions;
  binding unit delta from `abcba95` — 73 paths / 6,406 additions,
  within the 115 / 8,500 caps.

memory: none
