# Session 20260719T151130Z — agentjwork — claude — research-fixes-c5-cutoff

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Opus, build) · **Branch:**
  `fix/research-fixes/c5-medium-cutoff-revert` (off chain tip `origin/fix/research-fixes/rho-effect-size-label`,
  PR #101) · **Issue/PR:** see footer
- **Type:** unit **F2** of the phase2-research-fixes remediation run — **lane B safe fix, but a
  behaviour change** (needs test + live proof). Revert the S3 baseline **medium** confidence cutoff
  from `5` back to `7` in-window days per evidence-review **RU5b**: the confirmed literature mildly
  favours 6–7 nights for a "medium/acceptable" reliability label and nothing supports 5, so the
  previously-deployed `7` is the better-grounded choice (U6's 7→5 was a regression).

## Attempted
- Read the implementing verdict `decisions-evidence-review.md` §RU5b + the run context
  (`-orchestration-log.md` F2 row, `-findings.md`).
- Cut the branch from the chain tip `origin/fix/research-fixes/rho-effect-size-label`; applied the
  documented edits at the two synced config objects + comments + dev-aid docs; added a boundary test;
  ran the full gate; bookkeeping.

## Changed (committed)
- **`supabase/functions/compute-baselines/index.ts`** (the canonical S3 producer; NUL-trap file) —
  `BASELINE_CONFIG.confidence.mediumMinDays` **5 → 7** (line 34), and the config comment (line 21)
  `C5: 3 / 5 / 14 (supersedes v1's 3/7/14).` → `C5: 3 / 7 / 14 - medium reverted 5->7 per
  evidence-review RU5b (lit favours 6-7 nights; nothing supports 5). Supersedes U6's 3/5/14.`
  **Edited via `perl -i` to preserve the single intentional `\x00` map-key separator** (line 129);
  never a NUL-stripping writer. NUL verified surviving after the edit (locate → still line 129;
  `tr -cd '\000' | wc -c` → **1**).
- **`supabase/functions/generate-insights/evaluators.ts`** (the plain-UTF-8 mirror) —
  `WINDOWED_BASELINE_CONFIG.confidence.mediumMinDays` **5 → 7** (line 169); header comment updated
  `C5 3-5-14` → `C5 3-7-14` + a `(medium cutoff reverted 5→7 per evidence-review RU5b …)` note.
- **`docs/temp/phase2-run-config-decisions.md`** (C5 bullet) — recorded the reversion: deployed ladder
  is now 3 / 7 / 14; medium reverted 5→7 per RU5b (history preserved, not deleted); per-metric noted as
  the backlogged alternative.
- **`tools/rules/tests/engine_condition_coverage.test.ts`** — ADDED boundary test
  `C5 confidence: medium floor is 7 in-window days (reverted 5→7 per RU5b)` proving the new behaviour:
  **days_of_data = 6 → `low`** (was `medium`), **= 5 → `low`** (the crux), **= 7 & total_history ≥ 14 →
  `high`**, **= 7 & total_history < 14 → `medium`**. Deterministic (clean integer ramp). No existing
  assertion depended on the 5-day boundary (the pre-existing 7-day/19-history case still asserts `high`).
- **Bookkeeping:** config-decisions C-entry (C5 · F2), blocked-register **B1** (per-metric cutoff
  backlog), orchestration-log F2 row → **done** + ledger row + ▶ RESUME moved to **F3** + new chain tip.

## Decided
- Held scope: `lowMinDays: 3` and `highMinHistoryDays: 14` **untouched**; did NOT make the cutoff
  per-metric (that is lane-C mechanism work → backlogged as B1); did NOT touch the confidence-tier enum
  values. Confirmed via `grep -rn mediumMinDays supabase/ shared/ tools/` there are only the **two**
  logic sites above (compute-baselines shows as a binary match due to the NUL; evaluators.ts twice —
  config + the `computeConfidence` read). No third copy / no migration DDL hardcodes a 5-day medium.

## Left (worklist, resume at F3)
- F3 (report edgeScore components + lift inline weights 0.6/0.25/0.15 → config object), then F4…F8.

## Blockers
- **Live proof (honest):** `deno` is absent locally, so the compute-baselines Deno function can't be
  executed here; its confidence logic is an **exact mirror** of the node-runnable `windowedBaseline`
  in `generate-insights/evaluators.ts` (both share the reverted `mediumMinDays: 7`). The passing
  **node boundary test is the executable behaviour proof** of the shared logic; the Deno producer is the
  type-checked mirror covered by CI `deno-check`. The local Supabase stack was **not** running and was
  not stood up just for this (the node boundary test is sufficient proof) — so no `baseline_snapshots`
  seed/query was performed.
- **Gate results:** `node tools/context_sync.mjs --check` **passed**; `npm --prefix tools/rules run
  typecheck` (tsc --noEmit) **clean**; `npm --prefix tools/rules test` **65/65 pass** (was 64; +1 the
  new boundary test); `npm --prefix tools/engine-stats test` **36/36 pass** (untouched-green);
  `flutter analyze` (apps/biotope) **No issues found**. `flutter test` not re-run (no Dart/asset
  touched → unaffected). Generated-plugin churn was CR/EOL-only (`git diff --ignore-cr-at-eol` empty)
  → discarded via `git checkout -- apps/biotope/`.
- **NUL-survival:** `tr -cd '\000' < supabase/functions/compute-baselines/index.ts | wc -c` → **1**
  (byte preserved on line 129).

memory: none (F2's run state is covered by `docs/temp/phase2-research-fixes/`; the existing
phase2-run-state memory pointer remains sufficient).

---
Issue: #<F2-issue> · PR: #<F2-pr> (base `fix/research-fixes/rho-effect-size-label`) · commits
`<fix-sha>` (fix + bookkeeping) + follow-up (orchestration-log/session-log number update). Part of #98.
