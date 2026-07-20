# Session 20260719T154600Z — agentjwork — claude — research-fixes-lag2

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable, build) · **Branch:**
  `feat/research-fixes/lag-grid-add-lag2` (off chain tip
  `origin/feat/research-fixes/deadbandk-intent-instrumentation`, PR #107) · **Issue/PR:** see footer
- **Type:** unit **F5** of the phase2-research-fixes remediation run — **lane C (method/science change)**,
  but **collapsed by verify-first finding A2** to a small warranted change + documentation. Add lag 2 to
  the coincidence lag grid (RU7) and document the coincidence-path limitations. **This unit is NOT the
  review's "prewhiten-before-CCF" rewrite** — A2 established there is no rank-CCF in the code.

## Attempted
- Read `phase2-research-fixes-findings.md` **§A2** in full (the reframing) + `decisions-evidence-review.md`
  **§RU7** (applied, not re-derived), then the four code sites the brief names: `ALLOWED_LAG_DAYS` +
  doc comment (`generate-insights/evaluators.ts`), the load-time lag gate (`generate-insights/index.ts`
  ~340-345), the gate assertions in `tools/rules/tests/engine_condition_coverage.test.ts`, and
  `shared/rules/rule.schema.ts` (`lagDays` `min(1).nullable()` — already permits 2).
- **Verified lag 2 is inert-until-used** before shipping: grepped `data/rules` for `lagDays` — only two
  coincidence blueprints exist, each naming a **single** explicit value
  (`hrv_rise_after_sleep_rise` → `lagDays: 1`; `gut_comfort_mood_comove` → `lagDays: null` ≡ lag 0). No
  blueprint iterates over / auto-expands across `ALLOWED_LAG_DAYS`; in code the set is used only as a
  membership gate (`ALLOWED_LAG_DAYS.has(lag)`). So adding 2 only **widens** what an author may specify
  and changes **no** existing evaluation.
- Checked whether `insight-engine-architecture.md` §11 records the lag grid — it does **not** (grep for
  the grid / "lag" found no lag-set mention; the doc is `status: canonical`, not an accepted decision
  doc, and records no grid to amend). → **no accepted-doc change needed.**

## Changed (committed)
- **`supabase/functions/generate-insights/evaluators.ts`** — `ALLOWED_LAG_DAYS` widened
  `new Set([1, 3, 7])` → `new Set([1, 2, 3, 7])` (effective grid **{0,1,2,3,7}**, lag 0 = `lagDays: null`).
  Rewrote the doc comment to (a) record the widen-only / inert-until-used property and (b) capture the
  **A2 facts**: this is a **boolean baseline-coincidence conjunction, NOT a rank CCF**; the lag set is
  **physiologically-plausible coverage, not calibrated** (gut 1–3d, DOMS 1–2d, short env-exposures 0–7d);
  **lag-7 is confounded with weekly periodicity** (backlog B4); the lags **never enter any FDR/BH family**.
- **`supabase/functions/generate-insights/index.ts`** — load-gate reason string `{0,1,3,7}` → `{0,1,2,3,7}`
  (~line 342); header comment lag-window note updated to `{0,1,2,3,7}` with the RU7/F5 rationale.
- **`tools/rules/tests/engine_condition_coverage.test.ts`** — updated the C10-set test name to
  `{0(null), 1, 2, 3, 7}`; **added 2 tests**: (1) `ALLOWED_LAG_DAYS` is exactly `{1,2,3,7}` — **lag 2
  accepted, lag 4 rejected**; (2) a coincidence rule **evaluates at `lagDays: 2`** (both[1] routed to the
  `b_metric@2` lagged window). rules **67/67** (was 65).
- **Bookkeeping (dev-aid docs, docs/temp):** config-decisions **C4** (grid {0,1,3,7}→{0,1,2,3,7};
  RU7 rationale; physiologically-plausible-not-calibrated; widen-only/inert; the A2 limitations —
  prewhitening by-design-offline, RU7e multiplicity moot, lag-7 confound → B4). blocked-register **B4**
  (lag-7 day-of-week deseasonalize; gates nothing). orchestration-log F5 row → **done** + ledger + ▶ RESUME
  → **F6** + new chain tip.

## Decided
- **A2 reframing recorded explicitly: F5 is NOT the review's CCF rewrite.** The review's single most
  serious defect ("prewhiten/deseasonalize before the rank CCF; treat 4 lags as one hypothesis") **does
  not match the implementation** — there is no rank-CCF anywhere. The lag path is a boolean conjunction of
  baseline leaves at lagged windows (`evaluateCoincidence` → `getBaseline(metricB, lag)`); it computes no
  ρ. Therefore: **(a)** prewhitening is moot AND by-design-excluded from serve per accepted **ADR-0002**
  (Option C) → **no prewhitening added**; **(b)** "treat 4 lags as one hypothesis" (RU7e) is **moot as
  coded** — the coincidence path never calls `benjaminiHochberg`, the BH family is the S5 lag-0 Spearman
  pair set only, so there is no lag multiplicity to correct; **(c)** the only genuinely-actionable item is
  **add lag 2** (RU7a,e,f — gut transit & DOMS peak near the 1–3 day boundary the grid skipped), plus
  **backlog** the lag-7 deseasonalize concern.
- **Grid amendment lives in code + this run's C4 (dev-aid) only.** §11 records no grid and is not an
  accepted decision doc, so **no amendment-intent / retro-review flag was needed** (unlike F4's ADR case).

## Left (worklist, resume at F6)
- F6 (Pyper–Peterman → xDF effective-N for co-moving pairs, behind a config toggle, default P&P — the real
  autocorrelation residual A2 routes here), then F7, F8.
- **B4 (lag-7 day-of-week deseasonalize)** — backlog; unblock when a lag-7 rule is authored AND real n=1
  data shows the weekly confound bites. Any deseasonalize step is offline-pipeline per ADR-0002.

## Blockers
- **None for F5's shippables.** The lag-7 deseasonalize is data-/design-gated (B4) — expected lane-C end
  state, not a blocker.
- **Gate results:** `npm --prefix tools/rules run typecheck` (tsc --noEmit) **clean**;
  `npm --prefix tools/rules test` **67/67 pass** (was 65; +2 lag-2 tests) — **live proof:** the added gate
  test asserts `ALLOWED_LAG_DAYS` is exactly `{1,2,3,7}` (lag 2 accepted, lag 4 rejected) and the
  evaluation test drives a `lagDays: 2` coincidence to `b_metric@2`. (One flaky A14 subprocess-spawn test
  crashed once with Windows exit `0xC0000409` then passed on re-run — a known windows-toolchain gotcha,
  unrelated to this change.) `node tools/context_sync.mjs --check` **passed** (no accepted-doc edit).
  `flutter analyze` (apps/biotope) **No issues found**. `flutter test` **not run** (no Dart/asset touched →
  unaffected). Deno handler type-checked by CI `deno-check` (deno absent locally; the change is trivial TS
  — a Set literal + a string). Generated-plugin churn checked and discarded before commit.

memory: none (F5's run state is covered by `docs/temp/phase2-research-fixes/`; the phase2-run-state memory
pointer remains sufficient). Run-level note worth remembering if it recurs: the review's "prewhiten-before-
CCF" defect was a **premise mismatch** — always verify the implementation exists (A2) before building the
fix the review implies.

---
Issue: #108 · PR: #109 (base `feat/research-fixes/deadbandk-intent-instrumentation`) · commit `8d258dd` (fix + bookkeeping) + follow-up (PR/issue-number record).
Part of #98.
