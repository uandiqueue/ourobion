# Session 20260719T144911Z — agentjwork — claude — research-fixes-run-setup

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, orchestrator) · **Branch:**
  `docs/research-fixes/run-scaffolding` (off `dev-phase2`) · **Issue/PR:** see footer
- **Type:** run setup (docs-only, `docs/temp/`) — stand up the **remediation run** that applies the
  Phase-2 decisions **evidence review** (`docs/temp/phase2-research/decisions-evidence-review.md`) to
  the code, and record the two verify-first (lane-A) findings that gate the real fixes.

## Attempted
- Housekeeping: activated the biotope toolchain; `git fetch --prune`; deleted the two local branches
  already merged into `dev-phase2` (`docs/skills/run-procedures`, `fix/functions/deno-client-types` —
  their remotes were already pruned by the fetch); fast-forwarded `dev-phase2` to `1d678cc`.
- `graphify update .` — **graphify is not installed on this machine** (`CommandNotFoundException`);
  treated as absent and verified everything against actual files (its query/explain are hints only).
- Fanned out 4 read-only Explore agents to map current code state for every verdict lane.

## Changed (committed)
- **`docs/temp/phase2-research-fixes/`** (NEW run directory) — the four resumable tracking docs
  (`-orchestration-log`, `-blocked-register`, `-signoff-decisions`, `-config-decisions`) + a
  `-findings.md` holding the lane-A results. Run slug = `phase2-research-fixes`.
- Worklist F0–F8 seeded from the review's "Most urgent" list + Tier 3, each classified into a lane
  (A verify-first / B safe-fix / C method-change) per the run brief.

## Decided (see signoff-decisions D1–D2)
- **D1** stacked session-PR chain off `dev-phase2`, human-gated merge; **D2** lane classification
  governs unit scope (B never rewrites accepted science; C never ships a guessed constant, always
  appends to — never overwrites — an accepted ADR).

## Verify-first findings (the crux — see `-findings.md`)
- **A1 (Pyper–Peterman formula-constant, ADR-0002 Open-Q1, blocking S5 correctness): NO CHANGE
  NEEDED.** The coded `1/N* = 1/N + (2/N)·Σ r_XX·r_YY` with N/(N−j) bias correction and N/5 truncation
  (`evaluate-signals/stats.ts:191-226`) is the canonical Bartlett(1946)/Bayley–Hammersley/P&P form —
  coefficient **2/N, not 4/N**. Primary PDF + Afyouni-2019 are paywalled (403); verdict rests on the
  textbook underlying result (single-series ESS `N/(1+2Σρ)` confirmed from an open source). Open-Q1
  resolved-confirmed on coefficient + bias-correction; N/5 truncation is a supported window choice
  (minor calibration knob), not a bug.
- **A2 (prewhiten/deseasonalize before CCF, RU7d, flagged likely-live): PREMISE MISMATCH — no rank-CCF
  exists in the code.** The review conflated two subsystems: S5 is a **contemporaneous (lag-0)**
  Spearman evaluator (autocorrelation handled by N_eff, not prewhitening), and the "lag {0,1,3,7}" path
  is a **boolean baseline conjunction** (the `coincidence` rule), not a correlation. The ~30%-FP result
  is about rank CCFs and does not transfer. Serve-time prewhitening is **by-design excluded by ADR-0002
  (Option C)** → skip (not re-decide). Residuals routed: co-moving-pair N_eff bias → F6 (xDF); lag-7
  deseasonalize → F5 backlog; "4 lags as one hypothesis" is moot (lags never enter the BH family).

## Left (worklist, resume at F1)
- Lane B: F1 (|ρ|≥0.3 label), F2 (C5 5→7 — code already has 5), F3 (edge components + weights→config).
- Lane C: F4 (deadbandK intent), F5 (add lag 2 + document), F6 (xDF behind toggle), F7 (h-index/OR
  doc + backlog), F8 (composite calibration backlog pointer).

## Blockers
- None gating F0. `deno`/graphify absent locally (expected). Docs-only change: `context_sync --check`
  passes; `flutter analyze`/`flutter test` not re-run (no code or Dart/asset touched — `docs/temp/` +
  `docs/sessions/` only, cannot affect them).

memory: none (run state already covered by `docs/temp/phase2-research-fixes/`; will add a memory
pointer once the first code unit lands)
