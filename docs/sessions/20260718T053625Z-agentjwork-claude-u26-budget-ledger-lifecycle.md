# Session 20260718T053625Z — agentjwork — claude — u26-budget-ledger-lifecycle

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U26) · **Branch:**
  `fix/tools/budget-ledger-lifecycle` (cut from the chain tip `fix/db/constraint-hygiene`) ·
  **Issue:** #86 · **PR:** #87 (stacked)
- **Type:** audit-fix unit U26 — **budget-ledger lifecycle**, findings A11 (nit, unbounded ledger
  growth) + A10 (low, concurrent writers last-write-wins) from
  `docs/temp/phase2-audit/audit-findings-register.md`. Per D19's recorded note, the A10
  fix-vs-document call was this build agent's — see "Decided" for exactly where the line landed.

## Attempted
- A11: prune old `days`/`runs` entries from the llm-router ledger on load/persist behind a config
  retention window; bound the `state()`/`ledger`-CLI run listing; keep old ledger files loadable.
- A10: make concurrent `record()`/`charge()` writers merge instead of clobbering each other in
  BOTH ledgers (llm-router `budget.ts`, brain-ingest `limits/budget.ts` — confirmed the same
  exposure), with the budget hard stops firing on the merged totals.

## Changed (committed)
- `tools/llm-router/src/budget.ts`:
  - **A11:** `DEFAULT_RETENTION_DAYS = 30`; `prune()` drops day keys strictly older than the
    cutoff (boundary day KEPT; YYYY-MM-DD keys compare lexicographically) and runs whose
    `startedAt` UTC day aged out (runs carry no completion marker, so age = completion; an
    unparsable `startedAt` is pruned as unaccountable). Applied on `load()`, before every
    `persist()` in `record()`, and in `state()` so the report listing stays bounded. On-disk
    format unchanged (version 1); a version-1 file missing a map (`runs`) still loads.
  - **A10:** `record()` now starts with `mergeWithDisk()` — a fresh disk read merged
    **element-wise max** per day/node counter field; runs union with max `outputTokens` +
    earliest `startedAt` — then applies this call's delta and persists.
- `tools/llm-router/src/config.ts` + `router.config.json`: optional `budget.retentionDays`
  (positive int when set; shipped config says 30; absent → default, so pre-existing configs stay
  valid).
- `tools/llm-router/README.md`: new "Lifecycle (audit A11)" + "Concurrency (audit A10)" paragraphs
  under Budget/ledger (incl. the residual-race statement), config-reference line, test count 42→48.
- `tools/brain-ingest/src/limits/budget.ts` (same A10 exposure — treated consistently, FIXED):
  - `charge()` calls `mergeFromDisk()` **before** the 95% gate, so the hard stop fires on the
    COMBINED spend of concurrent ingest processes (per source: newer UTC window wins; same window
    → `max(spent)`); counters for sources this instance doesn't meter are carried through
    untouched (another process may meter them via `budgetOverrides`).
  - **A11 (where applicable):** `pruneStaleWindows()` on persist drops dead-(past-)window
    counters; the file is otherwise bounded by the source vocabulary, so nothing more is needed.
- `tools/llm-router/tests/budget.test.ts` (+6): old-format file loads + prunes on disk; retention
  boundary (day exactly 30 ago kept, 31 dropped, garbage `startedAt` dropped, `state()` bounded);
  `retentionDays` override; two interleaved writers → summed day totals (calls/tokens/usd) and
  unioned runs on disk, no lost updates; day-USD hard stop fires on merged totals no writer
  reached alone (incl. the one-record-stale second writer refusing after its next merge); per-run
  token hard stop on merged run tokens with the 189,999/190,000 boundary intact post-merge.
- `tools/brain-ingest/tests/budget.test.ts` (+3): interleaved guards sum on disk (exact
  0.25-charges, no epsilon); 95% gate fires on merged spend no single guard reached alone (denied
  charge leaves the merged file intact); dead-window counters pruned while a same-window foreign
  (unmetered-here) counter survives.
- `docs/temp/phase2-run-orchestration-log.md`: U26 row → done; ledger row appended.

## Decided / judgment calls — the A10 line (recorded per D19)
- **Re-read+merge SHIPPED in full, in both ledgers — no residual single-writer assumption was
  needed, including for the run-token cap.** The merge stayed small because of one structural
  fact: every instance persists after every `record()`/`charge()`, so the on-disk file always
  supersets that instance's own past writes. **Element-wise max therefore equals the union-sum of
  all writers' spend** (a naive literal "sum counters" would double-count the shared base both
  writers loaded — that is the one place the implementation deliberately deviates from the
  worklist's wording, to be correct rather than literal). Run counters only ever grow, so the
  run-token-cap semantics merge cleanly by the same argument (max tokens, earliest `startedAt`)
  — the "if run caps don't merge, document single-writer for them" fallback was NOT needed.
- **Where the line actually sits (documented in the llm-router README):** (a) two writers inside
  the same read→rename window can still drop at most ONE call's usage (no cross-process file lock
  attempted — down from "everything the other process ever spent"); (b) a process's PRE-CALL gate
  (`wouldExceed`/`assertCanSpend`) reads the ledger as of its own last `record()`, so it can run
  up to one call stale — the merge lives in `record()` exactly as the worklist specified, not in
  the read path. Both residuals are the in-flight overlap the 5% hard-stop headroom is documented
  to absorb.
- **Run completion = retention age.** The ledger has no run-completion marker; adding one would
  change the record() API for a nit-severity finding. A run whose `startedAt` day left the
  30-day window is treated as completed and pruned with it.
- **brain-ingest kept its own merge shape** (per-source window+spent, newer window wins) rather
  than importing the router's — the two ledgers stay mirrored in semantics, not in code, matching
  how they were built.
- **No `Date.now()` bans apply** (plain node packages); determinism kept via the already-injectable
  `now()` clocks — every new test runs on frozen instants.

## Gate results (all green)
- `tools/llm-router`: **48/48** (was 42), `tsc --noEmit` clean.
- `tools/brain-ingest`: **323/323** (was 320), `tsc --noEmit` clean.
- `flutter analyze` — no issues; `flutter test` — **62/62** (untouched-green).
- `node tools/context_sync.mjs --check` — consistent.

## Left / follow-ups (not this unit)
- The pre-call gate could also merge-on-read to shave residual (b) to zero at the cost of a disk
  read per gate check — not worth it while the 5% headroom exists; noted in the README.
- A12 (mailbox route model attestation) remains doc-only per the U21 worklist correction — untouched here.

## Blockers
- None.

memory: none
