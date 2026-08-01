# Where audit findings cluster in this repo

The Phase-2 audit's 27 findings (5 medium, rest low/nit) were not random — they fell into
four repeatable clusters. Start any future audit pass with these lenses.

## 1. The "shared schema is the only gate on foreign inputs" seam

The in-repo producer (brain-ingest) enforces stronger invariants in code (`enforce()`
re-derives corroboration, forces `uncertain` on no-retrieval, rejects vacuous quote
checks) than the shared zod schema does — but loaders (edge-loader) validate artifacts
with the **shared schema alone**. Anything entering by artifact file rather than the
in-repo pipeline is only as safe as the zod layer.

Checks: for every invariant a producer enforces in code, ask "is this also a schema
refinement?" If not, a hand-edited/older/foreign artifact line bypasses it. (Phase-2
examples: servable `partial` exempt from the retrieval invariant; corroboration counts
never cross-checked against sources; code and schema *disagreeing* on the zero-span
quoteCheck case.)

## 2. Contract-vs-reality drift on app-facing surfaces

Engine-side couplings are guard-tested (couplings.yaml, parity/schema guards) — they don't
drift. The **app-facing shared contracts are not guard-coupled** and do drift: shared
types missing columns added by later migrations, field *types* wrong vs the actual table,
enum vocabularies lagging what the engine actually writes, and app modules keeping private
duplicate models because the shared one is broken. (Phase-2 examples: `InsightCard`
missing later-migration columns; String id vs bigint; the `relationship` category and
`brain`/`signal` source tags missing from enums.)

Checks: diff each shared type against the live table DDL column-by-column AND against
what the engine functions actually write; then check the app's own parse/fallback paths
(silent enum fallbacks hide the drift).

## 3. Projection lifecycle — rows that only ever accumulate, or vanish wholesale

Two opposite failure modes, same root (nobody owns row lifecycle):

- **Only-gains-rows:** upsert-only projections whose stale rows keep serving forever
  (Phase-2 examples: `personal_signals` with no `computed_at` freshness read anywhere;
  router ledger days/runs never pruned). Ask: "what deletes/expires this row, and who
  checks its age?"
- **Prune-to-empty:** full-rebuild loaders (`load_rules.mjs`, `load_edges.mjs`) that
  delete everything absent from the input with **no empty-set guard** — a mis-pointed
  `--from-dir` silently truncates the table.
- Related: nightly upserts that rewrite ALL columns clobber user-set state
  (Phase-2 example: snooze → `active` on the next run; only `dismissed` was checked).

## 4. Time and format seams

- **Naive local time vs timestamptz:** `DateTime.now().toIso8601String()` (Dart) is
  zone-less local time — PostgREST compares it as UTC (≈8h skew for SGT users). Also
  `now` captured once at stream subscription never advances.
- **String comparison of timestamps:** JS-side ordering/dedup on raw ISO strings while
  the DB normalizes to timestamptz — mixed-offset producers misorder supersede logic or
  collide on conflict keys. Root enabler: contracts validating datetimes as `.min(1)`
  strings only.
- UTC-day windowing is done correctly everywhere via `addDays(iso, n)` string math — but
  verify any NEW window code follows that pattern rather than local Date arithmetic.

## Smaller recurring checks worth a pass

- DB CHECK sets vs contract zod enums (guard-tested where couplings.yaml says; verify new
  tables joined the guard).
- RLS policy shape vs the sibling-table precedent (projection tables should be
  select-only for users; Phase-2 example: `derived_metrics` shipped full user CRUD
  against its own comment).
- `numeric(p,s)` rounding vs values precomputed on unrounded floats (stored score can
  contradict its precomputed band at gate boundaries).
- Substring-based copy gates (`includes('illness')` kills "stillness") — false positives
  silently drop cards at render.
- `Equals<A,B>` mutual-assignability drift guards are `any`-poisonable and blind to
  optional-vs-`| undefined` — a zod inference degrading to `any` turns the guard green.
- Edge-function auth `auth !== \`Bearer ${key}\`` degenerates to the literal
  "Bearer undefined" when the env var is unset.
- CI compile coverage is transitive: pure modules get typechecked because tool-package
  tests import them; `Deno.serve` handler shells and SQL migrations are compiled by
  nothing (a deno-check job was added post-audit — verify it still covers new functions).
