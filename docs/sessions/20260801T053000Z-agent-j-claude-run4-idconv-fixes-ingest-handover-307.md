---
title: Run 4 — fix two ID Converter crosswalk defects, diagnose the per-seed ingestion stall, and hand over
summary: Ingestion had been fetching zero papers because mixed-type NCBI ID Converter batches returned a hard 400; fixing that exposed a second defect (an unquoted numeric pmid) that the first had kept as dead code. Both landed in PR #327. A bounded 10-per-seed probe then appeared to hang — the real cause was that every scoped run re-syncs the whole corpus to R2 before fetching anything, so per-seed ingestion is O(corpus) per run. Records the three hypotheses that were disproved, the corrections to my own reporting, and what the next session should pick up.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Run 4 — idconv crosswalk fixes + ingestion stall diagnosis + handover (#307)

Issue: #307; branch: `fix/brain/idconv-batch-by-idtype-307`; base: `4b4af75` (the PR #325 merge);
device: `agent-j`; agent: `claude` (Opus 5, 1M context). Shipping mode (self-merge on green gates).

## Attempted

Owner asked for a bounded ingestion — ~10 papers per seed — as a cheap probe before committing to
~90 per seed, then to test whether the newly fetched papers could be synthesised.

The probe never reached synthesis. It surfaced two real defects and one pipeline scaling property
instead. That is a successful probe: all three were invisible at the previous scale.

## Changed — PR #327 (MERGED, `a19e9a5`)

`tools/brain-ingest/src/sources/idconv.ts` + `tests/idconv.test.ts`:

1. **Mixed-type batches are a hard HTTP 400.** The converter infers exactly ONE `idtype` per
   request. `collectQueryIds` gathers PMIDs *and* PMCIDs into one list, and chunking that produced
   two-type batches. Measured live, not inferred:

   | batch | result |
   |---|---|
   | `ids=<pmid>,<pmid>` | 200, `idtype=pmid` |
   | `ids=<pmcid>,<pmcid>` | 200, `idtype=pmcid` |
   | `ids=<pmid>,<pmcid>` | **400 Bad Request** |

   400 is not transient, so `IDCONV_MAX_ATTEMPTS` could never help — **138 of 138 batches failed and
   0 papers were fetched.** Fixed with `idConvBatches()` (partition by type, then chunk each
   partition) and `idConvTypeOf()` (drop unsendable ids so one junk value cannot poison a batch).
   Partitioned rather than restricted to a single type because PMIDs and PMCIDs are both legitimate
   query ids; dropping either loses crosswalk coverage.

2. **`pmid` arrives as an unquoted JSON number.** With batching fixed the requests returned 200, and
   the response path — effectively dead code while every batch 400'd — threw
   `raw.trim is not a function`, killing the run at the crosswalk stage *after* discovery had
   succeeded. The live payload:

   ```json
   {"doi":"10.1186/s12864-019-5764-4","pmcid":"PMC6542083","pmid":31142281,"requested-id":"31142281"}
   ```

   `doi`, `pmcid` and `requested-id` are quoted; **`pmid` is not.** `IdConvRecord` declared it
   `string`, and the `identity.ts` normalizers guard only `== null` before calling `.trim()`.
   Fixed at the untrusted-JSON boundary with `asIdString()`.

   **The `identity.ts` normalizers were deliberately left strict.** Widening them to swallow
   non-strings would convert this class of defect into a silent id drop corpus-wide, and a run that
   finishes having linked nothing is worse than one that crashes.

**Not changed on a guess:** `run.ts:396` feeds OpenAlex ids through the same normalizers. Measured
OpenAlex responses use strings, so nothing was touched there.

Verified after the fix (temporary instrumentation, since reverted):

```
TIMING idconv: 200 queryId(s) -> 5 batch(es)
batch 1/5 (50 ids, type=pmcid) done in 1.0s, ok=true
batch 2/5 (18 ids, type=pmcid) done in 0.5s, ok=true
batch 3/5 (50 ids, type=pmid)  done in 0.5s, ok=true
batch 4/5 (50 ids, type=pmid)  done in 0.5s, ok=true
batch 5/5 (32 ids, type=pmid)  done in 0.5s, ok=true
```

Gates: brain-ingest **470/470** (468 + 2 new, one pinned to the verbatim live payload), `tsc --noEmit`
clean, `git diff --check` clean, `context_sync --check` passed, all 22 CI checks green including
`Run 4 Gate`. `main` untouched at `3d13932`.

## The finding the next session most needs — per-seed ingestion is O(corpus) per run

`run.ts:876`:

```ts
if (!opts.dryRun) {
  await syncMetadata(store, manifest.all(), log);
}
```

`manifest.all()` is the **whole corpus**, not the seed's records. So **every** `ingest --seed X`
re-syncs all ~6,161 records to R2 *before fetching a single paper*, and that cost scales with corpus
size, not with `--limit`. Measured:

```
TIMING oa: openalex leg done in 8.9s, resolved=157
TIMING oa: unpaywall leg done in 11.9s
TIMING syncMetadata: starting for 6161 record(s) (whole corpus, not just this seed)
   ... still running at t=400s, unfinished
```

**Consequence:** a plan of 33 sequential scoped runs pays that 7+ minute corpus sync 33 times —
hours of overhead to fetch 330 papers. Nothing is hung; it is doing enormous redundant work with no
log output. This also explains why the same seed as `--dry-run` finishes in **36s**: dry-run skips
that block entirely, so the two are not comparable workloads.

Second gotcha in the same area: **already-`fetched` papers consume `--limit` slots** (`run.ts:901`),
and the 756 existing fetches sit in the earliest-discovered topics. So a small global `--limit` can
be almost entirely consumed by skips. Skips cost no network, and runs are resumable.

### Recommended fix (NOT implemented — proposal only)

Either make `--limit` **per-topic**, or make `syncMetadata` sync **only changed records**. Both are in
`tools/**`. Until one exists, per-seed spread and a single corpus sync are mutually exclusive:

- one global-limit pass → one sync, but slices in discovery order (topic-by-topic), so **no per-family spread**;
- per-seed passes → good spread, but 33× full-corpus sync.

I flagged this to the owner as a proposal rather than silently substituting a different deliverable.

## Three hypotheses that were disproved — do not re-run them

| hypothesis | disproved by |
|---|---|
| OpenAlex disabled → all traffic falls to per-DOI Unpaywall | `OPENALEX_API_KEY` **is** present; `enabled.openalex=true` |
| §5.1 budget guard blocking on exhausted capacity | `usage.json` shows `openalex.spent = 0.0355`, mtime advancing *during* the stall — calls were succeeding |
| Host-memory guard waiting 3×5s per op (real-run-only) | 21.5% / 3.4 GB free, above both thresholds; and `waitForMemory` is called at `run.ts:906`, **after** the stall point |

## Corrections to my own reporting (recorded so they are not repeated)

- I claimed a frozen log was **block-buffered**. Wrong: node writes to files **synchronously**, so a
  frozen log means genuinely zero output. The explanation was reassuring and pointed away from the bug.
- I first blamed **Crossref DOIs** for the 400. Wrong: `collectQueryIds` only adds `pmid`/`pmcid`, and
  the file docstring already said why DOIs are excluded. Corrected in the source comment and test.
- I sampled the Cloudflare IPs `104.20.26.229` / `172.64.66.1` early and dismissed them. Those are
  **R2** — the actual culprit, already in my own evidence.
- A missing `idconv: crosswalk filled ids on N` line is **not** a stall: line 340 only logs
  `if (filled > 0)`, so silence means the crosswalk added nothing new.
- I briefly committed the idconv fix onto Session B's `draft/nao-d1-etl-workflow-307` and reverted it;
  that branch is back at exactly its pushed `d9c7ecf`.

## State at handover

| metric | baseline | at handover |
|---|---|---|
| records | 6,158 | 6,161 |
| `status=fetched` | **756** | **756** |
| `fullText.charCount > 5000` | **739** | 739 |

**`fetched` and the >5k count are the only honest progress metrics.** The record count moves on
discovery alone — an earlier report of "+4,037 papers" was made while every fetch was failing.

A single all-seed pass (`ingest --limit 1100`) was running at handover: 33 topics discovered,
`resolve: 6775 candidate(s) → 5726 canonical`, then into the one-time corpus sync. It had **not**
reached the fetch stage, so **no claim is made that it produced synthesisable papers.** It is
resumable; re-running is safe and never pays twice.

**Spend: US$1.118 OpenAI · Anthropic 0 (owner: DO NOT USE) · Agnes 18/50.** None of this diagnosis
cost budget — ingestion is runner time only.

## Next session should pick up

1. **Confirm the fetch stage actually moves `fetched` above 756.** If it does not, that is a third
   defect, not slowness. Do not report progress from the record count.
2. **Then attempt `synthesize-papers` on newly fetched uids** — the path is pre-verified
   (`dry-run: 2 paper(s) assembled — no LLM call`, exit 0). A snapshot of the 756 pre-existing
   fetched uids is the basis for identifying new ones by diff, not by assumption.
3. **Decide the `--limit`-per-topic vs `syncMetadata`-only-changed question** before any ~90/seed run.
   At current corpus size the per-seed strategy is not viable.
4. Still open and unstarted: **#240 req 4** (attested monotonic verification + `data/corpus/demo-edges/`),
   **A3** (batch to ≥50 cards, not yet authorised), **Layer 2 of D2** (verifier-side `mechanismCheck`
   on `EdgeVerification`; `isPathway: false` strips the label WITHOUT rejecting the claim — specified
   on #307, not implemented).
5. **PR #326** (nao D1 ETL workflow) remains a deliberate DRAFT for Session B. `etl.mjs` does not
   chunk; the draft measures before executing and refuses above a byte guard.
6. `arxiv` HTTP 429s on essentially every query — wants a backoff before anyone relies on it.

Recorded-not-applied, still outstanding: C9 ADR amendment (paper-scoped synthesis), memory 0012
amendment (§E retrieval invariant), and the `caveat` DB migration.

memory: none
