# Session 20260718T050856Z — agentjwork — claude — u24-loader-hardening

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U24) · **Branch:**
  `fix/loaders/empty-guard-timestamp-normalize` (cut from the chain tip
  `fix/m5b-app/relationship-cards-utc-expiry`) · **Issue:** #82 · **PR:** #83 (stacked)
- **Type:** audit-fix unit U24 — **loader hardening**, findings A14 (low) + A13 (low) from
  `docs/temp/phase2-audit/audit-findings-register.md`; closes the empty-set gap sign-off decision
  D13's upsert+prune model left open. `tools/` only; no `shared/`, no migrations, no app code.

## Attempted
- A14: make both projection loaders refuse an accidentally-empty input set instead of silently
  pruning their whole table; A13: make the edge-loader's JS dedup/ordering of `verifiedAt` agree
  with Postgres timestamptz semantics across mixed ISO offset spellings.

## Changed (committed)
- `tools/edge-loader/load_edges.mjs` (**A14**): new `--allow-empty` flag; after validation, a
  zero-claim artifact set now aborts — exit 1, nothing written, NO prune — with an error naming
  `--allow-empty`. The guard sits before the DB URL check (no connection, no transaction is ever
  opened) and fires in `--dry-run`/`--check` too, so the check verdict mirrors what a real run
  would do; `--allow-empty` restores the old pure-projection behaviour (legitimately empties the
  tables). Usage header documents the flag.
- `tools/rules/load_rules.mjs` (**A14**): same guard + `--allow-empty` flag for the `rules` table.
  Arg parsing upgraded from a Set to edge-loader-style `parseArgs` (unknown args are now a usage
  error, exit 2, matching the edge-loader convention) with a new `--rules-dir <dir>` override
  (default `data/rules`; tests/ops only) so the empty-tree path is testable end-to-end.
- `tools/edge-loader/lib/artifacts.mjs` (**A13**): new exported `canonicalVerifiedAt()` —
  `new Date(s).toISOString()` → the one UTC ISO form `YYYY-MM-DDTHH:mm:ss.sssZ` (safe post-U19:
  the contract validates `verifiedAt` with zod `.datetime({ offset: true })`). Canonical
  **everywhere**: (a) the dedup key — same instant in different offset spellings is ONE key,
  first-wins, matching the DB's timestamptz `(edge_id, verified_at)` uniqueness instead of
  silently colliding last-wins at upsert; (b) the newest-active supersede ordering — fixed-length
  UTC strings order exactly like their instants, so mixed-offset artifacts can no longer flip the
  wrong verification 'active'; (c) the `verified_at` column value written to the DB. The
  `verification` jsonb keeps the producer's verbatim spelling (truth-artifact copy, never
  rewritten).
- `tools/edge-loader/tests/edge_artifacts.test.ts`: +3 A13 tests (canonical-form unit test;
  offset-variant same-instant dedup with first-wins content; lexicographic-vs-chronological
  supersede inversion incl. verbatim-jsonb assertion); existing expectations moved to the
  canonical `…T00:00:00.000Z` keys.
- `tools/edge-loader/tests/edge_loader_cli.test.ts` (NEW, 5): empty set aborts exit 1 naming
  `--allow-empty` before any DB work; `--check` fails the same way; `--check --allow-empty`
  reports 0 rows and exits 0; `--allow-empty` real run proceeds past the guard (stops only at the
  missing DB URL in the DB-less test env); fixture `--check` stays green.
- `tools/rules/tests/load_rules.test.ts`: +6 mirror CLI tests (same five via `--rules-dir` over an
  empty scratch tree + the unknown-argument exit-2 pin).
- `docs/temp/phase2-run-orchestration-log.md`: U24 row → done, ledger row appended.

## Decided / judgment calls
- **Canonical form everywhere (recorded per unit brief):** the DB write also uses the canonical
  string, not just the JS comparisons — one form in the dedup key, the ordering AND the column, so
  no later reader can reintroduce a string/timestamptz seam. Postgres normalizes to timestamptz
  either way (same instant lands in the same row; live idempotency re-run proved 0 pruned), so
  this changes no stored semantics. The jsonb payload stays verbatim — two-tier truth: the
  artifact copy is never rewritten, only derived/serving columns are computed.
- **The empty guard fires in `--dry-run`/`--check` too** (exit 1): a check that stays green while
  a real run would wipe the table is the A14 trap with extra steps — the check verdict must
  mirror the real run's. `--check --allow-empty` exits 0 per each CLI's existing convention
  (valid input, no DB writes). CI unaffected: `rules:check` runs over the 8-blueprint
  `data/rules`; edge-loader `--check` is not wired in CI (needs an artifact source).
- **Guard condition is claims-empty** for the edge-loader: verifications cannot exist without
  claims (unclaimed edgeIds hard-fail earlier), and claims-without-verifications is a documented
  legitimate early state — so zero claims ⇔ the whole artifact set is empty.
- **`--rules-dir` added** to load_rules.mjs: smallest seam that makes the A14 guard provable
  end-to-end (subprocess spawn) instead of trusting an unexercised branch; doubles as the
  edge-loader `--from-dir` analogue.

## Live proof (local Supabase, `postgresql://…:54322/postgres`; both tables started 0)
- **A14 edge-loader:** fixtures loaded → claims=4 / verifications=4. Loader pointed at an empty
  mirror (`claims.jsonl` present, zero lines) → `✗ validated artifact set is EMPTY … re-run with
  --allow-empty`, **exit 1**, SQL counts after: 4 / 4 (untouched). Re-run `--allow-empty` →
  exit 0, `pruned 4 claim(s) + 4 verification(s)`, counts 0 / 0. Fixtures reloaded after.
- **A14 rules:** `load_rules.mjs` → 8 rules. Empty tree via `--rules-dir` → exit 1, count stays 8.
  `--allow-empty` → exit 0, count 0. Reloaded → 8; second run `pruned 0` (idempotent).
- **A13 live:** scratch mirror with the HRV edge's two actives respelled
  `2026-07-13T07:00:00+08:00` (= 07-12T23:00Z, lexicographically the LARGEST string but the older
  instant) and `2026-07-12T23:30:00Z`, plus the RHR verification duplicated at the same instant
  as `…+00:00` with different content. DB after load: 4 rows from 5 lines — the +00:00 duplicate
  deduped first-wins (row keeps conf 0.7, not the duplicate's 0.1); `23:30Z` **active**,
  `+08:00` row **superseded** (raw string ordering would have done the opposite); jsonb
  `verifiedAt` values verbatim (`2026-07-13T07:00:00+08:00` preserved). Immediate re-run of the
  same load: `pruned 0` — canonical `verified_at` round-trips timestamptz, determinism/idempotency
  holds.

## Gate results (all green)
- `tools/edge-loader`: **35/35** (was 27; +3 A13, +5 CLI guard), `tsc --noEmit` clean.
- `tools/rules`: **58/58** (was 52; +6 CLI guard), `tsc --noEmit` clean.
- `flutter analyze` — no issues; `flutter test` — **62/62** (untouched-green, no app changes).
- `node tools/context_sync.mjs --check` — consistent.

## Left / follow-ups (not this unit)
- A4's root-enabler note in the register (contract-level datetime format) was already tightened in
  U19; A13 is now closed at the consumer seam too. Other loaders (none today) that ever join on
  `verifiedAt` should reuse `canonicalVerifiedAt`.
- The rules loader's `--rules-dir` is deliberately undocumented in README-level docs — tests/ops
  seam only.

## Blockers
- None.

memory: none
