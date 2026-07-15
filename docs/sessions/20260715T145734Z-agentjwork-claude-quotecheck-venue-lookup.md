# Session 20260715T145734Z — agentjwork — claude — quotecheck-venue-lookup

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U4) · **Branch:**
  `feat/brain/quotecheck-venue-lookup` (cut from `feat/brain/llm-router`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** Track B deterministic pipeline pieces — **A9 quoteCheck** (literal-presence gate before
  any verifier token, architecture §A9) + **b2 venue lookup** (OpenAlex Sources-by-ISSN →
  `impactTier` band per phase2-run-config C8; support-models design §2 (b2)).

## Attempted
- Ship both dependency-free brain-pipeline pieces as sibling modules inside `tools/brain-ingest/`
  (package boundaries unchanged): a pure A9 quote-check core with an injectable text-loader wrapper
  and the exact `EdgeVerification.quoteCheck` block shape, and a b2 venue module (keyless OpenAlex
  Sources client, C8 banding config object, per-ISSN JSON file cache, CLI verb), with tests at
  house density and the full gate.

## Changed
- `tools/brain-ingest/src/verify/quoteCheck.ts` — A9. Pure core: per-span
  `checkQuoteSpan` (exact substring rung, then a documented normalized rung) + claim-level
  `checkClaimQuotes` whose `quoteCheck` block is field-for-field
  `EdgeVerification.quoteCheck` (`{spansFound, spansTotal, allPresent}`, relationships.ts:159-163)
  so A10 embeds it verbatim. Per-span verdicts: `{paperId, found, method: 'exact'|'normalized'|null,
  charStart, charEnd, offsetsComputed, mismatchReason}` with typed reasons
  (`text-missing` / `empty-quote` / `not-found` / `offset-mismatch`). Given offsets are verified
  (exact slice, else normalized-slice tolerance); null or wrong offsets → the quote is located and
  computed offsets into the ORIGINAL canonical text are returned for caller backfill
  (`offsetsComputed: true`). I/O stays in a thin wrapper: injectable `PaperTextLoader` +
  `r2TextLoader` over the existing `text/<uid>.txt` layout (storage/r2.ts `textKey`,
  NotFound → null).
- `tools/brain-ingest/src/venue/openalexSources.ts` — b2 client:
  `GET api.openalex.org/sources/issn:<issn>` (keyless, polite `mailto=`), native injectable fetch,
  AbortController timeout, non-OK throws `HTTP <status>` (house style), 404 → typed
  `resolved: false` VenueInfo; maps `summary_stats.h_index`, `summary_stats["2yr_mean_citedness"]`,
  `is_core`, `type`, `works_count`; `normalizeIssn` (NNNN-NNNC, junk → null, never throws).
- `tools/brain-ingest/src/venue/banding.ts` — C8 thresholds in a config object
  (`IMPACT_BANDS_C8`, provisional: high = SJR Q1 or h≥100; moderate = Q2 or h≥50; low = resolvable
  else; preprint = `type: repository` or name patterns). `bandImpactTier` returns a typed
  `ImpactTierOutcome` (`resolved` with tier+reason, or `unknown`); `sjrQuartile` is an optional
  caller input (see Decided/Blockers).
- `tools/brain-ingest/src/venue/cache.ts` — per-ISSN `VenueCache` at `data/corpus/venues.json`
  (already gitignored via `data/corpus/`), budget.ts persistence discipline (tolerant load, atomic
  tmp+rename write); `lookupVenueCached` cache-through helper (unresolved 404s cached too,
  `fetchedAt` keeps staleness visible).
- `tools/brain-ingest/src/cli.ts` — new verb `venue --issn <issn> [--sjr-quartile 1-4]`: cached
  lookup + band, JSON to stdout; works without a valid `.env` (lookup is keyless; mailto only when
  config loads).
- `tools/brain-ingest/tests/quoteCheck.test.ts` (19 tests) — normalization rules + offset-map,
  exact/normalized/miss (incl. case drift is a miss), offset verify / backfill / wrong-offset
  relocation, text-missing/empty-quote, multi-span block shape asserted key-for-key, zero-span
  no-vacuous-pass, loader wrapper (one load per unique paper, throwing loader degrades).
- `tools/brain-ingest/tests/venue.test.ts` (21 tests) + fixtures
  `tests/fixtures/openalex-source-{journal,repository}.json` (real-shaped Nature / bioRxiv Sources
  responses) — ISSN normalization, client URL/mailto/mapping/404/5xx-no-retry, banding table with
  boundary values (h=100→high, h=99→moderate, h=50→moderate, h=49→low), SJR OR-semantics,
  preprint precedence over h-index (bioRxiv h=214), name-pattern detection, unknown venue,
  threshold-override, cache hit/miss/reopen/corrupt/unresolved-cached.

## Decided
- **Quote normalization (the ONLY fallback beyond exact, documented in the module header):** soft
  hyphens removed; unicode dash family (U+2010–U+2015, U+2212) → `-`; curly/angle single/double
  quotes → `'` / `"`; whitespace runs (incl. NBSP) collapsed to one space, trimmed. **Case is
  preserved** — a case difference is a real mismatch. No fuzzy matching. The normalizer carries an
  offset map so normalized matches still return exact offsets into the original canonical text
  (which extract.ts already whitespace-collapses).
- **Wrong-but-set offsets:** presence is the A9 invariant, offsets are the locator upgrade — so a
  quote found elsewhere still passes (`found: true`) with corrected, backfillable offsets, but keeps
  `mismatchReason: 'offset-mismatch'` so bad synthesis offsets stay visible for prompt triage.
- **Zero-span claims fail the gate** (`allPresent: false`): the contract requires ≥1 span
  (relationships.ts:134); a vacuous pass would let an ungrounded claim through.
- **Unknown venue = typed `unknown` outcome, never a silent 'low':** C8's `low` band explicitly
  requires a *resolvable* venue and no doc licenses a default; callers decide what an unknown does
  to a `Citation` (impactTier is notability-only and excluded from edgeScore per ADR-0003, so the
  safe deferral is cheap).
- **SJR path: OpenAlex-only shipped; `sjrQuartile` is an optional typed input.** The support-models
  design names SJR (scimagojr.com CSV) as a banding input but no snapshot exists in the repo — per
  session spec, no data source fabricated; the OR-semantics slot is wired and tested so a quartile
  column can be fed the day a snapshot lands.
- **Preprint detection:** OpenAlex SOURCE `type === 'repository'` (trusted over noisy work-level
  types per the design gotcha) OR display-name patterns `['rxiv', 'ssrn', 'research square',
  'preprint', 'osf preprints']` — `'rxiv'` not `'arxiv'`, because medRxiv/bioRxiv/chemRxiv do NOT
  contain "arxiv" (a test caught this). Preprint precedes h-index banding (an unreviewed server's
  h-index is not peer-reviewed notability; bioRxiv's is 214).
- **No budget metering / no retry for the venue client:** single-entity Sources lookups are keyless
  and $0 (verified in the design doc), and no brain-ingest adapter retries — errors propagate,
  matched deliberately. The client is a standalone sibling of the OA-location adapter, not a
  SourceCtx extension.
- **brain-ingest does not import `shared/`** (house pattern): `QuoteSpanInput` and `ImpactTier` are
  structural/comment-level mirrors of relationships.ts, same as types.ts's
  "paperUid IS Citation.paperId" coupling.

## Left
- SJR quartile data acquisition (snapshot download + ISSN join) — input slot ready (see Blockers).
- A10 wiring: `checkClaimQuotesWithLoader` + `bandImpactTier` have no pipeline caller yet; the
  synthesis/verification sessions (U5+) are the first consumers.
- Preprint name-pattern list and C8 thresholds are explicitly uncalibrated (C8: "flag any
  surprises") — revisit when real venue lookups run.
- Venue cache has no TTL/re-probe policy; `fetchedAt` is stored so one can be added cheaply.

## Blockers
- **SJR quartile dataset not in the repo:** the design doc names SJR (scimagojr.com) as a b2 input
  but ships no snapshot; implemented the full OpenAlex-only path with a typed optional
  `sjrQuartile` parameter instead of fabricating a source. Needs a decision on vendoring an SJR
  CSV snapshot (license: CC-BY-NC-SA-ish terms need checking) vs. staying OpenAlex-only.
- Gate: `npm test` 268/268 (228 pre-existing + 40 new) + `npm run typecheck` clean in
  `tools/brain-ingest/` · `npx tsc --noEmit` (shared/) clean · `flutter analyze` clean ·
  `flutter test` 40/40 (generated-file churn reverted) · `context_sync --fix-index` + `--check`
  pass.

memory: none
