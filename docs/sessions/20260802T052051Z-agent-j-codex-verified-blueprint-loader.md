---
title: Verified extracted-blueprint loader gate
summary: Added the missing derived-artifact bridge from paper-synthesized blueprints to the rules loader; only metric pairs backed by active high/mid edge verifications are admitted, while all hand-authored rules remain in every rebuild.
type: session
scope: shared
status: canonical
updated: 2026-08-02
---

# Verified extracted-blueprint loader gate (#371)

Issue: #371; branch: `feat/rules/verified-blueprint-loader-371`; base:
`5a5af7c` (`origin/main`); device: `agent-j`; agent: `codex`. Work was isolated in
`C:\tmp\ourobion-issue371`.

## Attempted

Connect the brain pipeline's derived `edges/blueprints.jsonl` output to the deterministic rules
loader without copying model output into git-tracked `data/rules/`, admitting only blueprints whose
unordered metric pair has a servable independently verified edge and preserving every hand-authored
rule during the full-rebuild prune.

## Changed

- Added an explicit `--from-edges-dir <dir>` loader path. It validates claims/verifications through
  the existing edge-loader projection, then combines accepted extracted rows with the complete
  hand-authored base before the transactional upsert/prune.
- Added fail-closed extracted-rule checks for paper citation provenance, active registry metrics,
  cross-pair scope, renderer-supported placeholders, raw metric-key copy, phase, duplicate ids, and
  hand-authored ownership. Expected non-serving outcomes are withheld with exact audit reasons;
  corrupt artifacts hard-fail the load.
- Normalized only the producer's legacy `phase_2` literal to `phase2_engine`; corrected the
  synthesis prompt to emit the engine phase and only `metric_a_label`, `metric_b_label`, and
  `lag_days` placeholders, with a prompt-version bump.
- Made the shared `tsx` ESM registration idempotent so the combined rules/edge-loader process can
  load both TypeScript contract surfaces once.
- Added unit and real-CLI integration coverage. The subprocess fixture proves 8 hand-authored + 1
  verified extracted row, with a hold-band pair withheld.
- Updated the CI rules matrix to install the sibling edge-loader package used by that integration
  seam, and updated the rule design/contract docs plus memory 0007.

## Decided

- Extracted blueprints stay rebuildable artifacts. They are never promoted into
  `data/rules/{single,cross}`, so the original hand-authored truth boundary remains intact.
- Pair matching is orientation-independent and uses the canonical shared definition of servable:
  newest active verification in `high` or `mid`, never `hold`.
- Bad generated copy is withheld rather than silently rewritten while retaining an
  `extracted` provenance stamp.
- A hand-authored rule id always wins. Extracted content cannot overwrite or remove it.

## Left

- The hosted acceptance result is deliberately not claimed in this branch. After merge, #369 must
  produce/fetch the current verified artifact bundle, run the combined loader against the hosted
  database, and regenerate the demo deck. Only then can #371's final acceptance be measured:
  extracted rows with citations, more than one research-linked demo card, no unservable pair, and
  no hand-authored loss.
- The ignored local 12-blueprint bundle was exercised fail-closed against its stale local
  verification file. It admitted zero extracted rows, preserved all 8 hand-authored rows, and
  reported the concrete causes (unsupported placeholders, five raw-key templates, or no local
  servable pair). The positive CLI fixture covers the current hosted high/mid shape.

## Blockers

None for the code change or draft PR. Hosted database/deck acceptance requires the separately scoped
#369 workflow work, merge, and an explicitly authorized live run.

## Verification

- `tools/rules`: 186/186 tests; TypeScript typecheck; ordinary 8-rule dry-run.
- `tools/brain-ingest`: 550/550 tests in the affected run; TypeScript typecheck.
- `tools/edge-loader`: 75/75 tests; TypeScript typecheck.
- `git diff --check`: clean.
- `context_sync --fix-index`: generated memory/document indexes refreshed.
- `graphify update .`: machine-local AST graph refreshed. Its source cache was broadly stale and
  produced a degraded tracked view with dangling references, so that unrelated generated-view diff
  was not retained.

memory: updated 0007

## Release-gate compatibility continuation

- Kept `tools/edge-loader/lib/artifacts.mjs` pure with respect to package resolution: callers now
  provide the already-required tsx registration, while the edge-loader CLI registers it itself.
- Removed the conditional dependency-install step that changed the release-frozen `node-tools` CI
  step set. The rules package can now reuse canonical edge validation with only its own install.
- This is an import-boundary correction only; verified-pair gates, promotion decisions, and database
  rows are unchanged.
