# Session 20260719T155721Z — agentjwork — claude — research-fixes-xdf-seam

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable, build) · **Branch:**
  `feat/research-fixes/neff-method-toggle-xdf-seam` (off chain tip
  `origin/feat/research-fixes/lag-grid-add-lag2`, PR #109) · **Issue/PR:** see footer
- **Type:** unit **F6** of the phase2-research-fixes remediation run — **lane C (method/science change)**.
  Swap Pyper–Peterman → xDF effective-N for co-moving pairs, **behind a config toggle (default P&P)** — but
  **ship the swappable MECHANISM, NOT a hand-rolled xDF** (the orchestrator established the exact Afyouni
  equations are not accessibly available and an unverified hand-roll violates the run's honesty invariant).

## Attempted
- Read `phase2-research-fixes-findings.md` **§A1** (P&P constant resolved-confirmed: canonical 2/N Bartlett/
  P&P form, Open-Q1) + `decisions-evidence-review.md` **§RU4d** (the xDF recommendation — P&P depends only on
  each series' OWN autocorrelation, "substantially biased by non-zero cross-correlation", the exact regime a
  co-movement detector operates in) + ADR-0002 §S5 / Open-Q1 / Open-Q8 (for amendment-intent text).
- Traced the call chain: `index.ts` → `evaluatePair(seriesA, seriesB, PAIR_CONFIG)` → `effectiveN(a,b,cfg)`
  (`effectiveN` is not called directly in `index.ts`; `cfg` threads through `evaluatePair`), so the toggle
  rides the existing `PairConfig` with no new plumbing at the call site.

## Changed (committed)
- **`supabase/functions/evaluate-signals/stats.ts`** — added `export type NEffMethod =
  'pyper-peterman' | 'xdf'`; added **optional** `nEffMethod?: NEffMethod` to `PairConfig` (absent ⇒
  `'pyper-peterman'`, so existing callers/fixtures are unaffected). **Extracted the existing P&P body
  verbatim** into `effectiveNPyperPeterman(a,b,cfg)` and made `effectiveN` a **dispatcher**: default →
  `effectiveNPyperPeterman` (byte-identical); `'xdf'` → an **INTERIM seam that THROWS**
  (`"nEffMethod 'xdf' not yet implemented — faithful Afyouni xDF port + reference-vector verification
  pending (phase2-research-fixes B5). Cross-correlation-aware effective-N is the principled fix for
  co-moving pairs (RU4d/Open-Q8) but must not ship unverified."`). INTERIM provenance comment on the branch.
  **No P&P arithmetic / `maxLagFraction` / `nEffMin` / threshold touched.**
- **`supabase/functions/evaluate-signals/config.ts`** — added `nEffMethod: 'pyper-peterman'` to `PAIR_CONFIG`
  with a doc comment (C6: default unchanged; `'xdf'` INTERIM/throws/backlogged B5; honesty-invariant note).
- **`tools/engine-stats/tests/s5_pairwise.test.ts`** — imported `effectiveNPyperPeterman`; **+3 tests**:
  (a) **regression** — `effectiveN` with default method reproduces the existing N_eff vectors exactly (equals
  `effectiveNPyperPeterman` across the alternating / smooth-ramp / independence-clamp cases); (b) explicit
  `nEffMethod: 'pyper-peterman'` equals the default; (c) `nEffMethod: 'xdf'` **throws** the documented INTERIM
  error (regex asserts the B5 + RU4d/Open-Q8 + "must not ship unverified" substrings). engine-stats **41/41**
  (was 38). The three existing N_eff vector tests still pass **unchanged**.
- **Bookkeeping (dev-aid docs, docs/temp):** signoff-decisions **D4** (why xDF is right / why NOT hand-rolled
  in-run / what F6 shipped / backlog port recipe / **ADR-0002 Open-Q1 resolved-confirmed + Open-Q8 xDF-seam
  amendment intent — verbatim, recorded NOT applied**); blocked-register **B5** (faithful xDF port + verify +
  calibrate switch); config-decisions **C6** (`nEffMethod` default P&P unchanged · `'xdf'` INTERIM/throws);
  orchestration-log F6 row → **done** + ledger + ▶ RESUME → **F7** + new chain tip.

## Decided
- **Ship the mechanism, not the science (D4).** xDF is the principled RU4d fix, but F6 does **not** hand-roll
  it: (1) the **exact Afyouni xDF equations are not accessibly available** (primary paper + preprint
  paywalled; only the algorithm shape is public); (2) a faithful xDF needs FFT auto/cross-correlation +
  Tukey-taper/adaptive-truncation regularization + reference-vector verification; (3) the run's **honesty
  invariant forbids shipping unverified science as functional**. So the `'xdf'` branch **throws** — the
  dispatch/mechanism is swappable and exists now, the numeric lands later (B5).
- **P&P default is byte-identical, and proven so.** The P&P path was extracted verbatim into
  `effectiveNPyperPeterman`; `effectiveN` defaults to it when `nEffMethod` is absent. The regression test
  asserts equality against that helper (and the pre-existing N_eff vector tests are untouched and still
  pass) — no behaviour change for any existing caller.
- **A1 stands: no P&P math change.** Verify-first A1 already resolved Open-Q1 (canonical 2/N Bartlett/P&P);
  F6 touches none of it. F6 only adds the seam + records the Open-Q1 resolution as amendment intent alongside
  Open-Q8.
- **ADR-0002 left byte-unchanged (accepted-ADR immutability, as F4/D3 discovered).** The Open-Q1/Open-Q8
  appends are recorded as **amendment intent in D4** and flagged for shared/ retro-review — `context_sync
  --check` forbids editing an accepted decision body. Deviation from the F6 brief (which asked for the
  appends to be applied): same text, same retro-review flag, only the mechanism differs.

## Left (worklist, resume at F7)
- F7 (h-index 100/50 + OR-combination: document as recall-favouring notability heuristic; ADR-0003 open-Q
  append; field-normalization → backlog — RU6d,f), then F8.
- **B5 (faithful xDF port + verify + calibrate switch)** — backlog; port `xDF.m`/`AC_fft.m`/`xC_fft.m` from
  `github.com/asoroosh/xDF`, verify a deterministic TS port against MATLAB/Octave reference vectors, pick the
  regularization (Tukey M≈√T or adaptive truncation), then flip `nEffMethod` + calibrate on real data.

## Blockers
- **None for F6's shippables.** The faithful xDF is deliberately backlogged (B5) — the expected lane-C end
  state (mechanism + backlog, never a guessed/unverified numeric), not a blocker.
- **Gate results:** `npm --prefix tools/engine-stats run typecheck` (tsc --noEmit) **clean**;
  `npm --prefix tools/engine-stats test` **41/41 pass** (was 38; +3 nEffMethod tests) — **live proof:** the
  regression test shows `effectiveN` default == `effectiveNPyperPeterman` on the existing vectors and the
  three pre-existing N_eff vector tests pass unchanged; the xdf test asserts the documented INTERIM throw.
  `node tools/context_sync.mjs --check` **passed** (ADR-0002 left byte-unchanged — no accepted-doc edit).
  `flutter analyze` (apps/biotope) **No issues found**. `flutter test` **not run** (no Dart/asset touched →
  unaffected). Deno handler type-checked by CI `deno-check` (deno absent locally; the change is pure TS in a
  file already imported by both the Deno edge fn and the node suite). No generated-plugin churn (git status =
  only the 3 intended files).

memory: none (F6's run state is covered by `docs/temp/phase2-research-fixes/`; the phase2-run-state memory
pointer remains sufficient). Reusable pattern worth noting if it recurs: lane-C "swap accepted method X→Y"
where Y's exact spec is inaccessible → **ship the swappable dispatch with a throwing INTERIM branch + backlog
the verified port**, never a hand-rolled unverified numeric (the honesty invariant made the throw the honest
seam).

---
Issue: #110 · PR: #111 (base `feat/research-fixes/lag-grid-add-lag2`) · commit `746b650` (fix + bookkeeping) + follow-up `bc94a99`+ (PR/issue-number + commit-hash record).
Part of #98.
