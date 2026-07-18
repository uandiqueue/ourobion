# Session 20260718T043726Z — agentjwork — claude — u22-snooze-stale-signals

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, audit-fix session U22) · **Branch:**
  `fix/m5b-engine/snooze-stale-signals` (stacked on `fix/shared-types/insight-card-catchup`) ·
  **Issue:** #78 · **PR:** #79 (base = the U20 branch, per the stacked-chain protocol)
- **Type:** engine lifecycle fixes for audit findings **A18** (snoozed cards silently
  reactivated by the nightly upsert — medium) and **A19** (stale `personal_signals` rows feed
  the composer indefinitely — medium), per sign-off **D17** (snooze skipped at regeneration
  exactly like dismissed, held until the user changes it) and the **D13** upsert+prune
  projection model. Subsumes the worklist's U23 row (delete-on-loss removes the need for a
  composer `computed_at` freshness filter). No `shared/` changes.

## Attempted
- A18: make generate-insights skip `snoozed` card keys everywhere it skips `dismissed`, so
  the (user_id, rule_id) upsert can never rewrite a user-set status back to `active`.
- A19: make evaluate-signals DELETE a user's `personal_signals` rows for pairs that lost
  eligibility this run (metric under the `PAIR_MIN_METRIC_DAYS` = 14 floor, joint days <
  `minJointDays` = 10, or no longer evaluated), keeping the table a pure function of the
  current data; node-test the pure diff; prove both fixes live on the local stack.

## Changed
- `supabase/functions/generate-insights/index.ts` (A18) — the dismissed-only skip set became
  `heldStatusByKey` built from the new named `USER_HELD_STATUSES` config set
  (`{'dismissed','snoozed'}`, D17 comment includes the deferred snooze-until call). `pushCard`
  now early-returns on EITHER held status (counted separately). Both A18 paths verified:
  `pushCard` is the only writer into `cardsByKey`, and `cardsByKey` is the only source of the
  upsert batch — so a held card can never be re-upserted `status:'active'`. Response gains
  additive `cards.snoozedSkipped`.
- `supabase/functions/evaluate-signals/lifecycle.ts` (NEW, A19) — Deno-free/dependency-free
  pure module (the stats.ts/config.ts pattern): `pairEligibilityKey(userId, a, b)` +
  `computeStalePairs(eligible, existing)` → stale pairs grouped per user. Header documents the
  BH-coherence argument: q-values are per user per run over THAT run's evaluated family, so a
  pruned pair (by definition not in the current family) never invalidates surviving rows' q.
- `supabase/functions/evaluate-signals/index.ts` (A19) — collects `eligiblePairKeys` for every
  row upserted this run; after a successful upsert, fetches existing `(user_id, metric_a,
  metric_b)` (paginated, stable order), diffs via `computeStalePairs`, and deletes stale rows
  **scoped per user + exact pair list** (PostgREST `or=and(metric_a.eq.…,metric_b.eq.…)`,
  chunked at `PRUNE_DELETE_CHUNK` = 50; registry keys are `^[a-z0-9_]+$` so the filter string
  is safe). Guard (the A14 lesson): if the S2 view returned ZERO users the prune is skipped —
  suspect input, not proof every signal died. Response gains additive
  `personalSignals.rowsPruned`.
- `tools/engine-stats/tests/s5_lifecycle.test.ts` (NEW) — 6 tests over the pure helper: key
  injectivity, kept-vs-stale diff, all-rows-stale for a user absent from the run, per-user
  scoping, empty-existing, and empty-eligible (documents that the zero-users guard lives in
  the handler). Suite now **36/36**.

## Decided
- **A19 = delete-on-loss, not a freshness filter** (per the unit brief): pruning keeps
  `personal_signals` a pure function of current data (D13 loaders' model); a `computed_at`
  filter in the composer would leave dead rows accumulating and add a second source of truth
  for eligibility. The old U23 worklist row is folded into U22.
- **Prune scope = every user with existing rows**, not just users seen this run: a user whose
  data left the 60-day window entirely has no eligible pairs, so all their rows are stale —
  computeStalePairs handles this naturally. The zero-users handler guard bounds the blast
  radius of a broken/empty S2 view read (A14-style accident) — recorded as a deliberate
  asymmetry: per-user emptiness prunes, whole-view emptiness refuses.
- **Snooze persists indefinitely** (D17 verbatim): no snooze-until column now; N-day
  auto-reactivation stays deferred to Jayden.
- **Stale-leftover cleanup: nothing to clean.** The brief flagged two possible untracked
  leftovers from an old interrupted session (`evaluate-signals/` duplicates + migration
  `20260715160500_create_m5a_personal_signals.sql`). Verified with `git status --short` +
  `git ls-files`: all three `evaluate-signals/` files are TRACKED on this branch, the
  `20260715160500` migration is absent from disk (only the canonical tracked
  `20260716024400` exists), and `db reset` applied all 15 migrations cleanly. No deletions
  performed.

## Left
- U21 (app serve seam A25/A27), U24–U28 per the worklist — untouched here.
- `insight_cards` still accumulates expired/orphaned rows (cards whose rule stopped firing are
  never deleted, only expired client-side) — pre-existing behaviour, out of A18/A19 scope.
- `evaluate-signals` handler still validated by live edge-runtime execution, not `deno check`
  (deno absent on this machine — the standing U6/U7 caveat; U27 adds the CI deno job).

## Blockers
- None. Gate: engine-stats **36/36** (30 + 6 new) + `tsc --noEmit` clean · shared
  `npx tsc --noEmit` clean (untouched) · `flutter analyze` clean · `flutter test` **52/52** ·
  `npx supabase db reset` — all 15 migrations apply · `context_sync --check` pass.

  **Live proof (really run, local stack):** db reset → SQL auth user
  (`40bb6127-7635-4304-87b4-c48be152ab9e`) → 45-day seed via container psql → shaped
  `mood_score := energy_score` with a joint crash to 1 today → `functions serve` +
  service-role POSTs:
  - Setup: compute-baselines `{ok, users:1, snapshots:16}` → evaluate-signals run 1
    `personalSignals: {pairsEvaluated:120, rowsUpserted:120, rowsPruned:0}`; the shaped pair
    landed `energy_score|mood_score  n_days 45  n_eff 35.02  rho 1.0000  q 0.00000  stable t`
    → generate-insights run 1: `cards {upserted:1, byProducer {personal:1}}, insights
    {upserted:1, idiosyncratic:1}` — the card `personal:energy_score|mood_score`,
    `generated_at 2026-07-18 04:33:31.514+00`, status active.
  - **A18:** SQL `update insight_cards set status='snoozed'` on that card → generate-insights
    run 2: `cards.upserted: 0`, `snoozedSkipped: 2` (both fired endpoints' push attempts
    skipped) → SQL after: **1 row (no duplicate), status still `snoozed`, `generated_at`
    unchanged** at `2026-07-18 04:33:31.514+00`. Pre-fix the upsert rewrote it `active`.
  - **A19:** SQL shrink `update daily_gut_rows set mood_score = null where log_date >
    current_date - 40` (5 mood days left < the 14-day floor; before-state: 120 total rows,
    15 involving mood) → evaluate-signals run 2:
    `{pairsEvaluated:105, rowsUpserted:105, rowsPruned:15}` → SQL after: **total 105,
    mood rows 0**, still-eligible pairs survive with fresh `computed_at` (e.g.
    `hrv_sdnn_ms|sleep_duration_min  rho -0.2267  computed_at 2026-07-18 04:34:25.836+00`).
    Consumption proof: deleted the personal card, re-ran generate-insights (run 3) —
    `firedPatterns: 3` (energy_score still fired `down`) yet `cards.upserted: 0`,
    `insights.upserted: 0`, and SQL confirms `personal:energy_score|mood_score` count = 0:
    the pruned pair is no longer consumed. Pre-fix, the stale ρ=1/q=0/stable row would have
    gate-passed off the energy fire and recreated the "still researching" card.

memory: none
