# Session 20260719T152353Z — agentjwork — claude — research-fixes-edge-components

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Opus, build) · **Branch:**
  `fix/research-fixes/edge-score-components` (off chain tip `origin/fix/research-fixes/c5-medium-cutoff-revert`,
  PR #103) · **Issue/PR:** see footer
- **Type:** unit **F3** of the phase2-research-fixes remediation run — **lane B (hygiene + additive
  reporting)**. The RU2 cheap guardrail: lift the inline `edgeScore` weights into a config object and
  report the score components alongside the composite. **The composite value must not change** —
  refactor + reporting only.

## Attempted
- Read the implementing verdict `decisions-evidence-review.md` §RU2 (C2 weights: keep as baseline,
  explicitly uncited; guardrail RU2a,b,f = report the components alongside the composite) + the whole
  `shared/brain/index.ts`, `relationships.ts` / `relationships.schema.ts` (the `Exact<>` tsc
  assertions), `tools/edge-loader/lib/artifacts.mjs` + its test surface, and the loader CLI.
- Implemented the config lift + `edgeScoreComponents`, surfaced components in the loader review log,
  added tests, ran the full gate, did bookkeeping.

## Changed (committed)
- **`shared/brain/index.ts`** — (1) lifted the inline `0.6 + 0.25·tierWeight + 0.15·corroborationBoost`
  and the `Math.min(net, 3)` saturation cap into **`export const EDGE_WEIGHTS = { base 0.6, tier 0.25,
  corroboration 0.15, corroborationSaturation 3 } as const`** (ADR-0002 config-object mandate; doc-comment
  marks them provisional/uncited per RU2b). (2) Added the **`EdgeScoreComponents` interface** and pure
  **`edgeScoreComponents(v)`** returning `{ confidence, tierWeight, corroborationBoost, baseContribution,
  tierContribution, corroborationContribution, multiplier, composite, band }`. (3) Rewrote `edgeScore`
  → `edgeScoreComponents(v).composite` and `servingBand` → `edgeScoreComponents(v).band` so all three
  share **one source of truth** and can never drift. Non-servable verdicts short-circuit to composite 0
  / band 'hold' exactly as before. Same arithmetic, same operand order → **byte-identical composite**.
- **`tools/edge-loader/load_edges.mjs`** — imported `brain` from `./lib/artifacts.mjs` and added a
  per-edge **component-breakdown review line** under the existing gate line (active verifications only).
  Non-persisted (loader stdout, review-only); the DB projection columns are untouched — persistence is
  backlogged (B2).
- **`tools/edge-loader/tests/edge_score_components.test.ts`** (NEW, +9 tests) — (a) `edgeScoreComponents.
  composite === edgeScore(v)` and `.band === servingBand(v)`, and `multiplier === base+tier+corro
  contributions` reconstructs the composite, over a table (servable high/mid/hold, non-servable
  uncertain/unsupported/contradicted, corroboration-saturating net>3, net-zero, net-negative, clamp
  boundary); (b) the contributions read the **live `EDGE_WEIGHTS`** (a locally-mutated copy changes the
  multiplier; the real object reproduces it) + a value-pin test; (c) **REGRESSION**: `edgeScore` /
  `servingBand` are byte-identical to the transcribed pre-refactor formula/logic for the whole table,
  plus the three documented fixture composites (0.9 / 0.765 / 0.56) reproduced.
- **Bookkeeping:** config-decisions **C2 · F3** C-entry; blocked-register **B2** (persist breakdown =
  shared-contract change, deferred); orchestration-log F3 row → **done** + ledger row + ▶ RESUME → **F4**
  + new chain tip.

## Decided
- **One source of truth** shape: `edgeScoreComponents` computes composite + band directly (not via
  `edgeScore`/`servingBand`), and the two accessors are thin readers of it — avoids the mutual recursion
  a naïve `band = servingBand(v)` inside the components would cause, and makes drift impossible.
- Held scope: did **not** touch `EDGE_GATES` (already config; asserted 0.8/0.5 unchanged), any weight
  VALUE, or `impactTier` (correctly excluded from `edgeScore`). Surface is **non-persisted** — no DB
  column / migration (that is the shared-contract change backlogged as B2). The `Exact<>` type-equality
  assertions are untouched (my additions are new symbols, not contract fields) — typecheck stays clean.

## Left (worklist, resume at F4)
- F4 (deadbandK=1.0 intent mismatch: D-entry + fire-rate instrumentation, calibration → backlog,
  ADR-0002 Open-Q2 append — lane C), then F5…F8.

## Blockers
- **None.** Live proof recorded: loader `--check --from-dir tools/edge-loader/tests/fixtures/edges`
  prints the component breakdown per edge AND the composites **0.560 / 0.900 / 0.000** — identical to the
  documented pre-refactor values, i.e. the composite is unchanged.
- **Gate results:** `npm --prefix tools/edge-loader run typecheck` (tsc --noEmit — compiles shared/brain
  incl. the `Exact<>` asserts) **clean**; `npm --prefix tools/edge-loader test` **45/45 pass** (was 36;
  +9 new); `node tools/context_sync.mjs --check` **passed**; `flutter analyze` (apps/biotope) **No issues
  found**. `flutter test` **not run** (no Dart/asset touched → unaffected). Generated-plugin churn was
  CR/EOL-only (`git diff --ignore-cr-at-eol` empty) → discarded via `git checkout -- apps/biotope/`.

memory: none (F3's run state is covered by `docs/temp/phase2-research-fixes/`; the existing
phase2-run-state memory pointer remains sufficient).

---
Issue: #<pending> · PR: #<pending> (base `fix/research-fixes/c5-medium-cutoff-revert`). Part of #98.
