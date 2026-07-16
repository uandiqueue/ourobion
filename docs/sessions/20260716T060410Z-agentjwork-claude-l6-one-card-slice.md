# Session 20260716T060410Z — agentjwork — claude — l6-one-card-slice

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U13) · **Branch:**
  `feat/shared/l6-one-card-slice` (cut from `feat/m5b-engine/s7-composer-s8-cards`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** the **L6 one-card end-to-end slice** (`docs/shared/insight-engine-architecture.md` §9) —
  one pair (`gut_comfort_score × mood_score`) driven through A2→A11 + S2→S8 into one user-facing card
  with its §S8 source-panel dataset, on the local stack, no metered API spend. Mostly WIRING + PROOF +
  a demo runbook over the shipped U5–U12 substrate.

## Attempted
- Chained the whole pipeline for real, in order: seeder (real local-agent run) → confirm A8 claim →
  interim key-blocked-honest A10 verification (real deterministic halves) → A11 load → author + load
  the cross rule → shape user data → compute-baselines → evaluate-signals → generate-insights → the
  card + a SQL source-panel proof. Plus the demo runbook, next-steps edit, memory 0016, and the full
  gate sweep.

## Changed (committed)
- `data/rules/cross/gut/gut_comfort_mood_comove.json` (NEW) — the L6 cross-metric coincidence
  blueprint over the pair, both leaves rising, `lagDays: null` (same-window ≡ C10 lag 0; the edge is a
  symmetric `correlates`, no directed horizon), copy-gate clean, `phase2_engine`. Truth-tier authored
  data (the interim verification is NOT — it lives only in the gitignored artifact dir).
- `tools/brain-ingest/tests/seeder.test.ts` — one assertion updated faithfully: the real
  registry+blueprints enumeration now yields **2** `rule_blueprint` candidates (hrv U12 + this L6
  rule), was 1.
- `docs/shared/insight-slice-demo-runbook.md` (NEW) — the reproducible db-reset→card+source-panel
  command sequence, the interim-verifier honesty note, and exactly what flips when B5 lands.
- `docs/shared/next-steps.md` — item 2 rewritten: L0–L6 shipped (U1–U13), pointers to the runbook +
  run log; L7/L8 + A4–A7 + U1 grader + calibration + B5 verifier key remain. `updated:` bumped.
- `docs/memory/0016-insight-engine-l6-one-card-slice.md` (NEW) — the L6 milestone as a durable fact
  with its interim-verifier caveat.

## Chain evidence (every step really run, local stack)
- **db reset** → all 15 migrations applied.
- **(1) Seeder — REAL local-agent run.** `seed-queries --cap 6` wrote a mailbox request; THIS session
  fulfilled it (`model: claude-fable-5`, atomic tmp+rename) → `16/16 candidate(s) got queries via
  local_agent; rejected=0`. Because the L6 cross rule is on disk, the seeder now enumerates
  `rule_blueprint=2` incl. `rb:gut_comfort_score__mood_score` (the gut-brain pair — the source that
  was 0 in U9 and 1 in U12 now lights up the actual slice pair). Ledger: `days["2026-07-16"].seeder`
  now `calls: 2` (U9 + this run).
- **(2) Synthesis.** The real U10 claim `gut_comfort_score|correlates|mood_score` already exists in
  `data/corpus/edges/claims.jsonl` (verbatim 2-quote grounded, A9-gated) — not re-synthesised (spec:
  re-run only if missing).
- **(3) Interim verification — KEY-BLOCKED HONESTY (the load-bearing call).** A throwaway driver ran
  the U11 scaffold's `verifyClaim` in **dry-run** with a real R2 `textLoader` + real corpus (1232
  manifest docs as CorpusDocs, title+concepts+topicTags text): **real A9 quoteCheck 2/2 present**;
  **real corpus BM25-lite retrieval performed=true, 8 echo-controlled hits** (top:
  `doi:10.3390/bs16050627` "Biopsychosocial Influences on the Gut Microbiome…" matching
  gut/mood/anxiety/depression). **Verdict-path the contract forced:** the schema (`shared/brain`) only
  permits `supported`/`partial` with `corroboration.supporting ≥ 1`, and corroboration is re-derived
  ONLY from LLM-assigned stances over retrieved sources — deterministic retrieval yields
  `stance:'mentions'` only, so no supporting stance can be honestly assigned without the (blocked)
  decorrelated verifier. **The contract therefore forces `uncertain`** (band will be `hold`). This is
  the HONESTY-OVER-DEMO-SHINE path: the card branch is `personal`/`idiosyncratic`, not `agree`.
  `verifierModel = INTERIM:pending-real-verifier (decorrelation-blocked, register B5)`, schema-VALIDATED
  via `validateVerification`, written ONLY to `data/corpus/edges/verifications.jsonl` (gitignored).
- **(4) Load (A11).** `edge-loader --from-dir data/corpus/edges` → `hold @ 0.000 (uncertain)` →
  `store now holds 1 claim(s), 1 verification(s), 1 verified edge(s)`. DB `verified_edges`:
  `correlates | uncertain | 0.000 | hold | INTERIM:pending-real-verifier (decorrelation-blocked,
  register B5)`.
- **(5) Rule.** `load_rules.mjs` → 8 blueprints valid (schema + copy gate + registry keys), rules
  table holds 8. The cross rule is brain-neighbour scoped (C10) so it stays dormant while the edge is
  `hold` (reported under `brainScopeSkips`).
- **(6) Engine.** Seeded one user, 60 days of `gut_comfort_score` = `mood_score` (identical daily
  values → ρ=1) as a **balanced, low-autocorrelation** sequence over {2,3,4} with a joint rise to 5
  today. **Shaping (documented, iterated live):** a periodic {2,3,4} pattern collapsed the S5
  Pyper-Peterman `N_eff` to ~5 (< gate 10); a lopsided random draw skewed the median to 2 → S4 MAD
  degenerate (suppressed). The balanced low-autocorrelation series (generated + checked offline) gives
  last-28-day median 3 / MAD 1 (S4 fires "up", modified z=1.349 > deadband 1.0) AND N_eff ≈ 37.
  compute-baselines `{users:1, snapshots:4}`; evaluate-signals: gut_comfort & mood both S4 "up",
  `personal_signals` pair `ρ 1.0 / N_eff 37.2 / q 0 / stable t`; generate-insights →
  `{rules loaded 8, firedPatterns 2, insights {idiosyncratic 1}, cards {personal 1}}`, cross rule
  under `brainScopeSkips`. Idempotent on re-run (1 card / 1 insight / 1 verified edge).
- **The card + insight.** `insight_cards`: `personal:gut_comfort_score|mood_score`, producer
  `personal`, category `relationship`, "Still researching: Gut comfort and Mood … unverified personal
  observation … still researching it", `edge_refs []`, `insight_id` set. `composed_insights`: branch
  `idiosyncratic`, personal `{rho 1, nEff 37.2, qValue 0, stable}`, **completeness score 1.0**
  (28/28 days both metrics), `edges []`.
- **(7) Source-panel proof.** SQL over `verified_edges` + `jsonb_array_elements(claim->'quoteSpans')`
  surfaced the §S8 dataset end-to-end: 2 verbatim quotes with `charStart/charEnd`
  (52301–52578, 53297–53591) + locators, the full `derivation`, claim + per-citation population
  ("IBS patients comorbid with anxiety and depression"), citation `evidenceTier 4 / impactTier high /
  stance supports`, and the U1 `applicability = 'unknown'` cold-start stub. The panel's link ONTO the
  card (`insight_cards.edge_refs`) is populated by the composer only for **servable** edges; while the
  interim edge is `hold` the card is the uncited `personal` variant, so the panel is demonstrated from
  the edge/claim tables directly (lights up from the card on the band flip).

## Decided
- **Verdict path the contract forced = `uncertain` (recorded).** The schema does not literally require
  an LLM `verifierModel` string, but it DOES require `corroboration.supporting ≥ 1` for `supported`,
  and that number is produced only by LLM stance-assignment over retrieved sources. Deterministic
  retrieval alone cannot honestly reach it → `uncertain`. Stated plainly: the contract semantically
  requires the (blocked) LLM verdict, so band = `hold`, branch = `personal`/`idiosyncratic`. No mock
  `supports` stance was fabricated (unlike the clearly-labelled MOCK smoke in U11, which was pruned).
- **Cross rule lag = `null` (same-window ≡ C10 lag 0).** The edge is a symmetric `correlates`
  (context-only, no direction/horizon), so a same-day co-movement is the honest encoding; a positive
  lag would imply a directed horizon the evidence doesn't license.
- **Data shaping recorded (above):** identical values for ρ=1; balanced low-autocorrelation {2,3,4}
  to satisfy BOTH the S4 MAD-non-degeneracy + fire and the S5 N_eff gate simultaneously.
- **Interim verification is not truth-tier:** gitignored artifact dir only, `INTERIM:` provenance
  string; the cross rule blueprint IS truth-tier (committed).

## Left
- **Real A10 verdict** needs the non-Anthropic key (B5) + the `verifier` node flipped to `api_worker`;
  then a one-command re-run flips the band and upgrades the branch to `research-context` (runbook §"What
  changes when the B5 verifier key lands").
- L7 (S9 report + surfaced_cards; A1 ledger + A3 transport + A12 coverage), L8 (full gap loop), A4–A7
  (structure/tiering/mention/gate), U1 real applicability grader, hyperparameter calibration.
- CI still does not run node tool-package tests (standing orchestrator gap) — couplings guards +
  pre-push cover.

## Blockers
- None for the slice. Gate: `flutter analyze` clean · `flutter test` **48/48** · shared
  `npx tsc --noEmit` clean · brain-ingest **320/320** + tsc clean · edge-loader **21/21** · tools/rules
  **50/50** + tsc clean · engine-stats **30/30** · metric-view **5/5** · `npx supabase db reset` (15
  migrations) · full live end-to-end really run (evidence above) · `context_sync --fix-index` +
  `--check` pass · flutter generated-plugin churn reverted.

memory: added 0016
