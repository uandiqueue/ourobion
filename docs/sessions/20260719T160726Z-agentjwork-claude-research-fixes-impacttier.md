# Session 20260719T160726Z — agentjwork — claude — research-fixes-impacttier

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable, build) · **Branch:**
  `docs/research-fixes/impacttier-heuristic-limits` (off chain tip
  `origin/feat/research-fixes/neff-method-toggle-xdf-seam`, PR #111) · **Issue/PR:** see footer
- **Type:** unit **F7** of the phase2-research-fixes remediation run — **lane C (method/science change)**,
  but **documentation + backlog ONLY, NO behaviour change**. The field-normalized replacement for the
  100/50 h-index cutoffs needs per-field reference data this repo does not have, so it is BACKLOGGED, not
  guessed; F7 documents the current heuristic's limitations at the code site and records the calibration as
  backlog.

## Attempted
- Read `decisions-evidence-review.md` **§RU6** (a–h) — the C8 venue `impactTier` verdicts: **RU6d** (the
  100/50 h-index cutoffs are uncited and unjustifiable as global integers — journal h is field-/size-
  dependent, not cross-field comparable — Schubert & Glänzel 2007, Bihari 2020), **RU6f** (the SJR∨h
  OR-combination mixes non-commensurable metrics on non-commensurable databases; the OpenAlex h leg runs
  hotter; OR ⇒ more-permissive leg wins → asymmetric recall-favouring), **RU6g** (rejecting JIF + keeping
  notability⊥trust + excluding `impactTier` from edgeScore/applicability is the STRONGEST C8 decision —
  leave untouched).
- Read `tools/brain-ingest/src/venue/banding.ts` (`IMPACT_BANDS_C8` ~67-74, `bandImpactTier` OR ladder
  ~116-146; SJR leg tested before h leg at each tier) + `openalexSources.ts` (the fetched-but-unused
  `twoYrMeanCitedness` / `isCore` / `worksCount` signals) + `tests/venue.test.ts` (banding boundary surface:
  h=100→high, 99→moderate, 50→moderate, 49→low).
- **Checked whether any `status: accepted` decision doc records the bands/OR:** searched
  `docs/shared/decisions/`. **ADR-0003 (accepted) §5 records only the *exclusion* of `impactTier` from
  edgeScore/applicability (RU6g) — it does NOT define the 100/50 bands or the OR rule.** The bands live in
  code (`IMPACT_BANDS_C8`) + the dev-aid `docs/temp/phase2-run-config-decisions.md` C8 only.

## Changed (committed)
- **`tools/brain-ingest/src/venue/banding.ts`** — **comments only, no value / OR logic / tier order
  touched.** (a) Strengthened the doc block on `IMPACT_BANDS_C8` + an inline note on the
  `highHIndexMin: 100` / `moderateHIndexMin: 50` lines: marked the cutoffs **PROVISIONAL, UNCITED, and
  UNJUSTIFIABLE AS GLOBAL INTEGERS** (RU6d — field-/size-dependent, not cross-field comparable; `≥100`
  over-promotes biomed, under-promotes math/CS/humanities); principled replacement = field-normalized /
  percentile rule (or SNIP / JCI), backlogged **B6**. (b) Extended the `bandImpactTier` doc block: the
  `SJR-quartile ∨ h-index` combination is a **deliberate recall-favouring heuristic, NOT metrically
  principled** (RU6f — non-commensurable Scopus-quartile vs raw field-unnormalized OpenAlex integer; h leg
  runs hotter; OR ⇒ more-permissive leg wins; SJR tested first but h can still promote); bounded because
  `impactTier` feeds **discovery/ranking only, never trust** (RU6g — excluded from edgeScore/reliability +
  UX applicability, ADR-0003 §5; notability ≠ trust) — kept as a documented tradeoff.
- **Bookkeeping (dev-aid docs, docs/temp):** config-decisions **C8** (bands + OR re-affirmed UNCHANGED as
  provisional recall-favouring notability heuristic; field-normalization/percentile + OR-reconsideration
  backlogged; notability⊥trust kept · RU6d,f,g); blocked-register **B6** (replace global 100/50 with
  field-normalized / percentile rule or SNIP/JCI + reconsider OR; needs per-field reference data;
  fetched-but-unused `twoYrMeanCitedness`/`isCore`/`worksCount` could feed it; gates nothing); orchestration
  F7 row → **done** + ledger + ▶ RESUME → **F8** + new chain tip.

## Decided
- **Documentation + backlog, not implementation (lane C, notability-only bounded risk).** The principled
  fix (field-normalized / percentile bands, or a field-normalized indicator SNIP/JCI) needs per-field
  reference data / percentiles this repo does not have — shipping a guessed replacement would just swap one
  uncited constant for another, violating the run's no-guessed-constant rule. So F7 documents the limitation
  at the code site + backlogs the mechanism (**B6**), changing no value and no logic.
- **No accepted-doc amendment intent needed (unlike F4/F6).** ADR-0003 §5 (accepted) records only the
  *exclusion* of `impactTier` from edgeScore (RU6g), which F7 leaves exactly as is — it does **not** define
  the 100/50 bands or the OR rule. Those live in code + dev-aid C8 only, so there is no accepted-doc body to
  amend; the amendment is C8 (dev-aid) here. (The `context_sync --check` accepted-body immutability guard
  that blocked F4/F6 appends is therefore not engaged by F7.)
- **RU6g left untouched.** JIF rejection, the notability⊥trust separation, and the exclusion of `impactTier`
  from edgeScore/reliability + the UX applicability axis are the strongest C8 decision — not disturbed. The
  fetched-but-unused OpenAlex signals were NOT wired into banding (that is the backlogged mechanism, B6).

## Left (worklist, resume at F8)
- **F8** (composite gates 0.8/0.5 + weights calibration: confirm ADR-0003 Open-Q1-2 backlog + point to the
  F3 guardrail — RU2a,b,f).
- **B6** (field-normalized / percentile bands + OR reconsideration) — backlog; needs per-field reference
  data / percentiles; the fetched-but-unused `twoYrMeanCitedness`/`isCore`/`worksCount` signals are
  candidate inputs.

## Blockers
- **None for F7's shippables.** The field-normalization is deliberately backlogged (B6) — the expected
  lane-C end state (document limitation + backlog the data-gated mechanism, never a guessed constant), not a
  blocker.
- **Gate results:** `npm --prefix tools/brain-ingest run typecheck` (tsc --noEmit) **clean**;
  `npm --prefix tools/brain-ingest test` **323/323 pass** (unchanged — **comments/docs only, no behaviour
  change**, the live proof: all banding boundary tests h=100→high / 99→moderate / 50→moderate / 49→low and
  the OR/preprint/unknown tests pass byte-identically; suite runs fully offline via injected fetch, no API
  keys/network needed). `node tools/context_sync.mjs --check` **passed** (no accepted-doc body edited).
  `flutter analyze` (apps/biotope) **No issues found**. `flutter test` **not run** (no Dart/asset touched →
  unaffected). No generated-plugin churn (git status = only the intended files).

memory: none (F7's run state is covered by `docs/temp/phase2-research-fixes/`; the phase2-run-state memory
pointer remains sufficient). Reusable pattern if it recurs: lane-C "an accepted constant is uncited /
methodologically weak but the principled replacement needs reference data we don't have" → **document the
limitation at the code site + backlog the data-gated mechanism** (never swap in a second guessed constant),
and check whether the value actually lives in an accepted doc before assuming an amendment-intent is owed —
here the 100/50 bands live in code + dev-aid only, so no accepted-doc change was needed.

---
Issue: #TBD · PR: #TBD (base `feat/research-fixes/neff-method-toggle-xdf-seam`) · commit `TBD`.
Part of #98.
