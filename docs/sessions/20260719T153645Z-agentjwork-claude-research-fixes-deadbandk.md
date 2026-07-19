# Session 20260719T153645Z — agentjwork — claude — research-fixes-deadbandk

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Opus, build) · **Branch:**
  `feat/research-fixes/deadbandk-intent-instrumentation` (off chain tip
  `origin/fix/research-fixes/edge-score-components`, PR #105) · **Issue/PR:** see footer
- **Type:** unit **F4** of the phase2-research-fixes remediation run — **lane C (method/science change:
  design + human sign-off)**. Resolve the `deadbandK = 1.0` intent mismatch (RU3c): DO NOT rewrite the
  accepted ADR or guess a new `k`. Ship a design note, fire-rate instrumentation (so `k` can be
  calibrated later), an ADR-0002 Open-Q2 amendment, and a backlog item — keeping `deadbandK = 1.0`.

## Attempted
- Read the implementing verdict `decisions-evidence-review.md` §RU3(c) (the intent mismatch: `k=1.0`
  fires ~31.7% of days under a Gaussian, more under heavy tails; defensible only as a ~1-in-3 nudge, not
  "anomaly"), ADR-0002 (§S4 deadbandK line ~88 + Open-Q2 ~136), `evaluate-signals/stats.ts` +
  `config.ts` + `index.ts`, the S4 test surface, `registry.ts` (the per-metric `deadbandK` field), and
  the run's tracking docs.
- Added the `fireRate` helper + tests, wired per-metric fire-rate logging into the handler, wrote D3 /
  B3 / C3 bookkeeping, ran the full gate.
- **Empirically tested the ADR-0002 append** the brief asked for (trial commit of the Open-Q2 append +
  `updated:` bump) → `context_sync --check` **FAILED** with "an accepted decision's body is immutable —
  supersede it instead of editing" (`tools/context_sync.mjs` `checkEditHonesty`, enforced by the pre-push
  hook AND non-bypassable CI). Reverted the ADR; pivoted to recording the amendment as intent + retro-review.

## Changed (committed)
- **`supabase/functions/evaluate-signals/stats.ts`** — added the pure, deterministic
  **`fireRate(states: readonly SignalState[]): number`** = non-neutral / total (0 for empty).
  Instrumentation for `deadbandK` calibration (RU3c / ADR-0002 Open-Q2). **No classification/threshold
  change** — it reads classifier output only.
- **`supabase/functions/evaluate-signals/index.ts`** — imported `fireRate`; after all S4/S5 computation,
  group today's `metricSignals` by metric, compute the per-metric fire rate, `console.log` it
  (`[evaluate-signals] deadbandK fire-rate (RU3c/Open-Q2) …`), and add a `fireRates` array to the handler
  response. Measurement-only; no threshold, classification, or existing response field touched. (Deno
  handler is type-checked only by CI `deno-check` — deno absent locally; the change is trivial TS.)
- **`tools/engine-stats/tests/s4_signal.test.ts`** (+2 tests) — (1) `fireRate` unit cases:
  `[up,neutral,down,neutral]`→0.5, all-neutral→0, empty→0, all-fired→1, singleton. (2) A synthetic
  Gaussian case: 20 evenly-spaced standard-normal quantiles fed as evaluated values through
  `classifyDaily` at `k=1.0` over baseline `[1..15]`; because the deadband is `|z| ≤ k`, exactly the 6
  quantiles with `|z|>1` fire → **fireRate = 0.30**, asserted `=== 0.3` and `> 0.25` (materially above an
  "anomaly" rate — the RU3c point).
- **Bookkeeping (dev-aid docs, docs/temp):** signoff-decisions **D3** (intent question framed as
  product-gated; RU3c quantities + citation; the **exact ADR-0002 amendment text** recorded as amendment
  intent; the immutability-guard deviation explained). blocked-register **B3** (intent sign-off +
  calibration data → backlog; `deadbandK` stays 1.0; gates nothing). config-decisions **C3** (deadbandK
  re-affirmed 1.0, mechanism = per-metric registry field, instrumentation added). orchestration-log F4 row
  → **done** + ledger row + ▶ RESUME → **F5** + new chain tip + a resuming-orchestrator note that
  accepted-ADR appends can't land in-run (affects F6/F7/F8).

## Decided
- **F4 does NOT choose `k`.** The intent (occasional **anomaly alert** vs **~1-in-3 daily 3-state nudge**)
  is a **product decision requiring Jayden's sign-off**. `deadbandK = 1.0` stays unchanged everywhere
  (`registry.ts` `signal.deadbandK` for all 16 baselineApplicable metrics; `config.ts` deliberately does
  not hold it). No guessed constant.
- **Wired the handler logging** (the brief's SHOULD) — it is cheap, pure, and can't throw (guarded,
  measurement-only), so real fire-rate data now accrues for calibration; also surfaced as `fireRates` in
  the response for observability. Did not force any classification path.
- **ADR-0002 Open-Q2 append recorded as amendment intent, not applied in-run.** The accepted-decision
  immutability guard (verified empirically) blocks even an additive append to an accepted ADR body. Per
  the signoff-decisions doc's own charter ("Lane-C … record the amendment intent here"), the exact append
  text lives in **D3** and is **flagged for shared/ retro-review**. **Deviation from the F4 brief** (which
  asked the append be applied directly to ADR-0002 and that `context_sync` stay green — mutually
  incompatible under the guard). Substance is unchanged: same append text, same retro-review flag; only
  the mechanism differs (human application via the ADR's 2-reviewer/supersede channel).

## Left (worklist, resume at F5)
- F5 (lag path: add lag 2 + document coincidence-path limitations — lane C, reframed by A2), then F6…F8.
- **Retro-review pending:** apply the ADR-0002 Open-Q2 append (exact text in D3) via the ADR's
  2-reviewer / supersede channel. Consider relaxing the immutability guard to allow appends to an ADR's
  "Open questions / changelog" section (F6/F7/F8 hit the same wall).

## Blockers
- **None for F4's shippables.** The intent resolution + `k` calibration are human-/data-gated (B3), which
  is the expected lane-C end state, not a blocker on this unit.
- **Gate results:** `npm --prefix tools/engine-stats run typecheck` (tsc --noEmit) **clean**;
  `npm --prefix tools/engine-stats test` **38/38 pass** (was 36; +2 fireRate) — **live proof: computed
  k=1.0 fire rate = 0.30** on the 20-quantile Gaussian case (vs an "anomaly" rate that would be far
  lower); `node tools/context_sync.mjs --check` **passed** (no accepted-ADR edit — that append is
  intent-only in D3); `flutter analyze` (apps/biotope) **No issues found**. `flutter test` **not run** (no
  Dart/asset touched → unaffected). Generated-plugin churn checked (`git diff --ignore-cr-at-eol`) and
  discarded via `git checkout -- apps/biotope/` if any.

memory: none (F4's run state is covered by `docs/temp/phase2-research-fixes/`; the existing
phase2-run-state memory pointer remains sufficient). A run-level finding worth a future memory note if it
recurs: accepted-ADR appends are blocked in-run by the context_sync immutability guard.

---
Issue: #<F4-issue> · PR: #<F4-pr> (base `fix/research-fixes/edge-score-components`) · commit `<sha>`
(fix + bookkeeping) + follow-up (PR/issue-number record). Part of #98.
