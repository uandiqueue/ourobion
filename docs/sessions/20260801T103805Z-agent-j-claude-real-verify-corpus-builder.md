---
session: 20260801T103805Z-agent-j-claude-real-verify-corpus-builder
agent: agent-j (Claude Opus 5, isolated worktree)
date: 2026-08-01
scope: tools/brain-ingest/src/verify/corpusBuild.ts, tools/brain-ingest/src/cli.ts, tools/brain-ingest/src/verify/retrieval.ts, tools/brain-ingest/tests/corpusBuild.test.ts
---

# The verifier had no corpus, so every verdict was `uncertain` for a mechanical reason

## What was wrong

`verify --corpus <path>` ranks over a JSONL of `CorpusDoc` lines. The ONLY corpus in
the repo was `tools/brain-ingest/fixtures/verify-corpus.jsonl` — five hand-written
lines that exist to exercise the loader. Pointing a real verification at it would
fabricate corroboration, so real runs shipped no `--corpus` at all. Retrieval then
ranked an **empty** corpus, the verifier LLM saw zero candidate sources, and it
correctly answered "cannot tell".

So the run of `uncertain` verdicts was never evidence about the claims. It was a
missing input. This session builds the missing input from the project's own
ingested literature.

## What was built

`brain-ingest build-verify-corpus` — an OFFLINE projection of
`data/corpus/papers.jsonl` into a real `CorpusDoc` JSONL.

```
cd tools/brain-ingest
npx tsx src/cli.ts build-verify-corpus            # → data/corpus/verify-corpus.jsonl
```

Flags: `--manifest <path>`, `--out <path>`, `--text-dir <dir>`, `--limit N`,
`--dry-run`. No provider, no R2, no OpenAlex — the whole verb is network-free.

Output defaults into `data/corpus/`, which is gitignored (`.gitignore:113`), so the
~2.9 MB derived corpus is never committed. It is DERIVED tier: rebuildable at any
time from the manifest.

Most of the projection already existed — `verify/corpus.ts:157 buildCorpusDoc` — but
nothing called it. The new `verify/corpusBuild.ts` is the driver plus the two
offline adapters (`textDirLoader`, `cachedVenueImpactResolver`) and the accounting.

## Where each field actually comes from

**`evidenceTier` — the repo's deterministic classifier, and provably so.**
Not assigned here at all. `buildCorpusDoc` calls `classifyEvidenceTier`
(`src/evidenceTier.ts`) and stores `evidenceInputs` + `evidenceClassification`
alongside the tier. This is not a claim that has to be taken on trust:
`loadCorpusFromText` RE-RUNS the classifier on every line at load time and throws
`evidenceTier does not match the recomputed classifier result` on any disagreement.
All 1082 emitted docs load clean, and a test hand-promotes a tier to prove the
loader rejects it.

Observed distribution: `{1: 37, 2: 883, 3: 105, 4: 55, 5: 2}`.

**`impactTier` — the existing b2 derivation, honoured to its conservative end.**
Per-ISSN `VenueCache` (`data/corpus/venues.json`) → `bandImpactTier` (C8 bands).
Cache-only by design: a manifest pass would otherwise be thousands of OpenAlex
lookups. `banding.ts` deliberately returns a typed `unknown` rather than a silent
`'low'`, so the caller must choose — and rather than invent a second default, this
reuses the one the repo already made, `EXTERNAL_DEFAULT_IMPACT_TIER` in
`verify/retrieval.ts` (now exported instead of duplicated). Every row records an
`impactBasis` string saying which path it took.

**`text` — real canonical text, else the real abstract, else skip.**
`--text-dir` reads a local mirror of R2's `text/<uid>.txt` layout (same
`encodeKeySegment` filename). Absent that, the verbatim `abstract`. Nothing is
synthesised or paraphrased; `textSource` records which was used per row.

Emitted lines carry two extra keys (`textSource`, `impactBasis`) beyond the
`CorpusDoc` contract. `parseCorpusDoc` builds its result from known keys and ignores
unknown ones, so the file stays auditable on disk AND round-trips through the strict
loader — asserted in tests, not assumed.

## Emitted vs skipped

1232 records read → **1082 emitted, 150 skipped**, all 150 for `no-text`:

- 86 have neither an abstract nor extracted full text — nothing honest to rank over.
- 64 have `fullText.extracted: true` but no abstract, and their text lives only in
  R2 (`text/<uid>.txt`), which is not reachable offline. These are skipped with a
  distinguishing `detail` rather than padded with a title-only body.

Nothing was placeholder-filled to inflate the count.

## What I could NOT derive honestly — read this part

Two real degradations. Both are honest-by-construction, and both cap what this
corpus can currently do.

**1. Every `impactTier` is the conservative unscored band (`low`).**
`data/corpus/venues.json` does not exist on this machine — the cache has never been
warmed. So 1082/1082 rows resolved to `unresolved-venue → 'low'`. That is the
repo's own conservative band, not a guess, and the verb prints a loud note saying
so. But the consequence is real and must not be glossed: `impactTier` feeds
`TriageConfig.fullRetrievalImpactTiers`, so a uniformly-`low` corpus will not
escalate any claim to full retrieval on impact grounds. The fix is mechanical —
warm the cache with `venue --issn <issn>` (756 of 1232 records carry an ISSN) and
re-run — but until someone does, treat the impact axis of this corpus as **absent,
not measured**. I did not fabricate bands to make it look populated.

**2. Every `evidenceClassification.reviewRequired` is `true` (1082/1082).**
Zero records in the manifest carry `publicationTypes`, `meshHeadings`, or
`evidenceDesign` — the manifest simply never populated those fields. So the
classifier's authoritative layers (publication-type, MeSH, curator) cannot fire at
all, and every paper falls through to the keyword/floor layer, which sets
`reviewRequired: true` by design. The 883 tier-2 docs are overwhelmingly the
`conservative-tier-2-floor:no-design-signal` floor, i.e. **"no design signal found"**,
NOT "assessed as cross-sectional". The tiers are genuinely the classifier's output,
but they are the classifier operating on its weakest available evidence. Anyone
reading tier-2 here as a measured judgement would be over-reading it.

I considered fetching the 743 R2 texts and doing live venue lookups to close both
gaps, and did neither: the task barred thousands of network lookups, and inventing
data to fill the gap is exactly the failure this tool exists to prevent. Both are
mechanical follow-ups, not blockers.

Also unchanged: `fixtures/verify-corpus.jsonl` stays as-is. It is loader-test
scaffolding and still has that job; it simply must never be passed to a real run.

## Evidence the corpus works

`rankCorpus` over the generated file returns real, on-topic hits with varied tiers
where the empty corpus returned nothing:

```
query ["resting","heart","rate","variability","sleep"] -> 5 hits
  18.80 T2 Sleep state is superior to resting state for heart rate variability as…
  17.45 T3 Longitudinal assessment of resting wakefulness heart rate variability…
query ["exercise","vo2max","training"] -> 5 hits
  12.85 T3 Dynamic effects of different exercise modalities on autonomic recovery…
   9.08 T4 Pre-Exercise Hydration Modulates the Sweat Rate and Executive Control…
```

## Gates

- `tsc --noEmit` — passed.
- `node --import tsx --test --test-concurrency=1 "tests/**/*.test.ts"` — 503 pass,
  0 fail (22 of them new).
- `node tools/context_sync.mjs --check` — passed.
- `git diff --check` — passed.

Worktree note: the worktree had no `node_modules`. Junctioned
`tools/brain-ingest`, `tools/llm-router`, and `shared` to the main checkout's
installs (read-only use; `zod` lives under `shared/node_modules`, which is why the
suite fails in a fresh worktree without it). Junctions are untracked and were not
committed.

memory: the verifier's `uncertain` verdicts were a missing `--corpus` input, not a
finding about the claims — retrieval ranked an empty corpus and the model honestly
said "cannot tell"; before reading any verdict distribution as evidence, check that
the input it ranged over was non-empty.

Refs #300
