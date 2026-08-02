---
title: The Brain — Ingestion (paper corpus) Design
summary: How ourobion acquires the scientific-literature corpus edges are synthesised from (discover → fetch → identify → store to R2); agents read this for the source-API catalog, paper_uid scheme, budget guardrails, and the tools/brain-ingest build sequence — the downstream engine stages live in insight-engine-architecture.
type: design
scope: nao
status: unverified
updated: 2026-08-02
---
# The Brain — Ingestion (paper corpus) Design

> **Authoritative integrated architecture:** [`../shared/insight-engine-architecture.md`](../shared/insight-engine-architecture.md) is the single source of truth for the end-to-end insight-engine (serve + authoring). This doc is the ingestion-scoped (paper-corpus acquisition) view; where it differs, the architecture doc wins.

> **Evidence class + workflow execution status (measured 2026-08-02).**
> [`AGENTS.md`](../../../AGENTS.md) §7 classes `docs/implemented/` as stale older design material, so
> read the operational prose below as design intent and confirm each path against
> [`tools/brain-ingest/`](../../../tools/brain-ingest/) before citing it.
>
> The Run-4 audit
> ([`documentation-freshness-audit-2026-08-01`](../../development/run4/documentation-freshness-audit-2026-08-01.md))
> recorded this document's central defect as describing the cloud pipeline operationally "although the
> workflow has never executed", and directed that it be marked *defined, never run*. **That
> disposition is itself now out of date — do not apply it.** Measured from the GitHub Actions record:
>
> | Workflow | Runs | Outcome |
> |---|---|---|
> | [`brain-ingest.yml`](../../../.github/workflows/brain-ingest.yml) | 2 | 1 success (2026-07-15, 12m18s, `dev-phase2`), 1 failure (2026-08-01, `dev-phase2-run4`) |
> | [`brain-pipeline.yml`](../../../.github/workflows/brain-pipeline.yml) | 6 | **3 success**, 3 failure — all 2026-08-02, all `workflow_dispatch` on `main`; latest success 17:08Z |
>
> So both workflows are **defined and executed**, not merely defined. What a green run proves is
> bounded: that the dispatched stages completed on that revision with those inputs. It is not evidence
> that any particular corpus size, claim yield, or card is current. The audit's other two findings
> stand: planned browser-capture/build-sequence material is still interleaved with implemented paths,
> and the "Open items" section still describes synthesis and the verifier as deferred when both now
> exist. Re-cut the implementation matrix against code before reuse.

**Scope.** This doc covers the front of the pipeline only — paper-corpus acquisition, up to "text + a `paper_uid` ready to cite." The end-to-end 23-stage insight engine and its inter-stage contracts (the A-stages that extend this CLI) live in [`insight-engine-architecture`](../shared/insight-engine-architecture.md); this doc does not restate them.

How ourobion **acquires the scientific literature** that the brain's edges are synthesised from. This
doc covers the *front of the pipeline only* — discovering papers, fetching them, giving each a stable
identity, and storing them — up to the point where a paper's text is ready for synthesis. The
synthesis → verification → graph steps are [`brain-synthesis-design.md`](brain-synthesis-design.md); the edge/claim
contract is [`shared/brain/`](../../../shared/brain/). The brain's runtime *schema* (how edges are stored
and served) is **settled** — truth-tier edge artifacts (R2 JSONL + the contract) projected by a
deterministic loader into a relational `verified_edges` view served as a 1-hop lookup, no graph DB
(see [`insight-engine-architecture`](../shared/insight-engine-architecture.md) §S6/§A11 and
[`brain-synthesis-design.md`](brain-synthesis-design.md) "Decisions (resolved) item 2"). This doc
deliberately stops at "text + a `paper_uid` ready to cite."

> **Scope & use.** The corpus is a **private study asset for relationship extraction**, never shipped
> in the product and never publicly redistributed. That keeps the licensing posture simple (see
> §7). The **NUS institutional-proxy / publisher-TDM** path is **deferred** — this doc plans only the
> free, open-access-first pipeline.

## 1 · Two-tier placement

A clean instance of the repo's core principle ([memory 0001](../../memory/0001-two-tier-truth.md)):

- **TRUTH (the asset — "raw data is the asset"):** the **paper corpus** (the fetched PDFs / HTML /
  JATS) and the **paper manifest** (the per-paper metadata records) — the record of *what we have and
  where it came from*. **R2 is the canonical store for both the metadata and the binaries:** the manifest
  lives at `manifest/papers.jsonl` (combined index) with one `meta/<paper_uid>.json` per paper alongside
  the `pdf/` `jats/` `text/` objects; the local `data/corpus/` is a **git-untracked cache** (re-derivable
  by re-syncing from R2). Losing the corpus means re-fetching, and re-fetch is not always reproducible (a
  source can go dark), so R2 is the durable truth.
  > **Tradeoff vs the prior design.** The manifest was previously git-tracked (line-level diff history of
  > every metadata change). Moving canonical metadata to R2 loses that git-diff history, but **R2 object
  > versioning** retains prior object versions and can backfill an audit trail; the win is that the
  > metadata no longer has to be small/diff-clean and lives next to the binaries it describes.
- **DERIVED (rebuildable):** extracted plain text, and everything downstream (claims, verifications,
  the served graph). Re-derivable from the corpus + a prompt version.

So: **fetch once, store durably, extract many times.** The expensive, sometimes-irreversible step is
acquisition; everything after it is a re-runnable projection.

## 2 · The source-API catalog

Two distinct layers — **discovery** (find papers + resolve a DOI) and **retrieval** (get the actual
full text). Almost nothing does both; the pipeline *chains* them (§3). Verified against primary docs
(deep-research run, 2026-06-25).

### Free — discovery / metadata (no full-text binary)

| API | Returns | Domain fit | Free / key / limits | TS notes |
|---|---|---|---|---|
| **Crossref REST** | DOI metadata only | General — the canonical DOI resolver | Free, no key. Polite pool with `mailto` (better limits); paid Metadata Plus token optional | JSON over `fetch`. Trivial. |
| **PubMed E-utilities** (NCBI) | PMIDs + metadata → PMC link | ★ Biomedical | Free; 3 req/s, **10 req/s with free key** | XML (or JSON for some); `fast-xml-parser`. |
| **OpenAlex** | Metadata + `best_oa_location.pdf_url` + license fields | General, ~240M works | ⚠️ **2026 usage-based pricing (verified 2026-06-29):** free key required; **$1/day** free usage ($0.10/day keyless). Cost is **per request type**: singleton (one work) **$0** · list/filter **$0.0001** · search $0.001 · semantic/content/text $0.01. **OA-location is a list/singleton call → effectively free at our scale** (the $0.01 figure is the *content* endpoint, which we never use — PDFs come from PMC/CORE/arXiv). Full CC0 snapshot free but ~hundreds of GB → not worth it for 2000 papers. | JSON. OA-location backbone (§3); **batch DOIs into list filters**, see §5.1. |
| **Semantic Scholar (S2AG)** | Metadata + `openAccessPdf` *URL* | General, ~214M papers | Free; key recommended (≈1 RPS introductory) | JSON. Bulk datasets (S2ORC) available. |
| **DOAJ** | Article metadata (CC0) | OA journals only | Free, no key | JSON. `fulltext` link points to the **publisher**, not DOAJ. |
| **Unpaywall** | OA-location lookup *by DOI* | General | Free, `email=` param | JSON. Now an OpenAlex subroutine; returns the PDF URL, not bytes. |
| **Lens.org** | Metadata (scholarly + patents) | General | Free tier, registration/key; quota-limited | JSON. Include; verify quota before relying. |

### Free — direct full-text (serve the actual bytes/text)

| Source | Serves | Domain fit | Free / key / limits | TS notes |
|---|---|---|---|---|
| **PMC Open Access Subset** | **PDF + JATS XML + plain text** + media | ★★ Biomedical — primary | Free, no key. FTP / S3 / OAI-PMH / E-utils / BioC. Bulk OK | JATS XML via `fast-xml-parser`; per-article **license tier** (see §7). |
| **Europe PMC** | Metadata + **full-text REST** over its OA subset | ★ Biomedical (MEDLINE + PMC + preprints) | Free, **no key** | XML default (JSON available). |
| **CORE** | **Binary PDF** (`GET /v3/outputs/{id}/download` → 302 → PDF) + pre-extracted `fullText` | General OA aggregator | Free; key-gated/rate-limited for sustained use | JSON; `fullText` saves re-parsing. camelCase fields. |
| **arXiv** | Atom XML (abstract) + **PDF URL** (`/pdf/{id}`) | Physics / quant-bio / HRV-adjacent preprints | Free, no key; **~1 req / 3 s** | Atom XML → `fast-xml-parser`; PDF fetched separately. |
| **bioRxiv / medRxiv** | Preprint metadata + PDF/JATS | ★ Biomedical preprints | Free API | JSON; include, verify field detail before relying. |

### Paywalled — sanctioned routes & prices (DEFERRED, recorded for completeness)

These need NUS institutional access and are **out of scope for v1** (own follow-up research). Listed so
the doc is the single reference:

| Route | What it is | Cost |
|---|---|---|
| **Elsevier TDM API** (ScienceDirect) | Self-register on `dev.elsevier.com` for a personal key; sanctioned full-text mining of subscribed content | **Free to researchers at a subscribing institution** (e.g. NUS); non-subscriber pay-per-view ≈ US$30–40 / article |
| **Springer Nature TDM** | Institutional TDM data product | Free-ish via institutional licence; otherwise a paid data-solutions product (quote-based) |
| **Wiley TDM** | Token-based TDM over institutional licence | Via institutional licence |
| **OpenAlex Premium** | Higher API limits, monthly/daily snapshots | Paid plan (usage/subscription) — the free $1/day tier covers our scale |
| **CORE membership** | Higher-volume / commercial API tiers | Paid; free tier covers our scale |

*(Pay-per-view figures are ballparks — confirm at purchase time. The whole paywalled column is gated on
the deferred NUS/TDM decision.)*

## 3 · The retrieval pattern

```
 discovery API ──► resolve DOI ──► OA-location lookup ──► classify ──┬─► [downloadable]  fetch PDF      ──► object storage
 (Crossref,        (canonical      (Unpaywall /          retriev-    │                  / PMC JATS / arXiv
  Europe PMC,       paper id)       OpenAlex             ability     │                  / direct bestOaUrl
  PubMed, arXiv,                    best_oa_location)                │                  / CORE (last resort)
  bioRxiv)                                                          └─► [non-downloadable] browser-capture
                                                                         HTML / content   ──► local cache
```

1. **Discover** by research query. Per the [pipeline decision](../../memory/0013-brain-pipeline-and-support-models-decision.md)
   an **agentic seeder** (reads the metric registry `derivedFrom[]` + biotope's insight needs) generates
   the queries; the static topic-seed list (gut microbiome, hydration, antibiotics, sleep/HRV,
   dengue/vector, environmental health) remains the **bootstrap/fallback**. Either way → candidate works +
   identifiers. Adapters capture the **full id set**
   (DOI + PMID + PMCID, where the source exposes it — e.g. Europe PMC `result[]`, PubMed efetch
   `ArticleIdList`) so a paper arrives already cross-linked.
2. **Resolve & dedup** to one canonical paper → assign `paper_uid` (§4). Because discovery carries the
   full id set, `resolveDedup` links disjoint-id variants of one paper up front; the NCBI ID Converter
   crosswalk (§4) is the backstop for the rest.
3. **OA-location:** Unpaywall / OpenAlex `best_oa_location` → an OA PDF URL + license + version, or
   "no OA copy."
4. **Classify retrievability** → `pdf` (OA binary available) · `html` (full text only as HTML/JATS) ·
   `paywalled` (no free full text — defer to NUS/TDM) · `unknown`.
5a. **Downloadable →** fetch the PDF — preferring PMC JATS / Europe PMC JATS, then a **direct fetch of
   the OA-location step's own `best_oa_location` URL** (free, keyless — the pointer step 3 already
   resolved), then arXiv, and only as a last resort CORE's own search+download (metered, §5.1) — →
   **object storage** (§6); record checksum, size, license, source URL.
5b. **Non-downloadable →** hand to the **browser-capture tool** (§5) → save HTML / rendered content →
   **local cache**; record locator.
6. **Extract text** (§5) — once, store the result.
7. **Finalise the manifest record** — status, license, storage location, text-extraction result.

**Four sources serve full text directly** — PMC OA, arXiv, CORE, and the OA-location step's own resolved
URL fetched as-is (+ Europe PMC for its OA subset). Fetching that URL directly (rather than only using it
to classify `retrievability`) is what lets CORE's metered quota be a last resort instead of the default
catch-all for anything without a PMCID/arXiv id.

## 4 · Paper identity — the `paper_uid` (the spine)

Every piece of brain knowledge must trace to its paper(s). The brain contract already carries this:
`Citation.paperId` is *"DOI when available, else a stable internal corpus id"* and every
`QuoteSpan.paperId` must match a `Citation.paperId`. **`paper_uid` IS that `paperId`.** One claim can
cite **several** papers (`citations[]`), and one paper backs many claims — a clean many-to-many with
`paper_uid` as the join key.

**Scheme (deterministic, DOI-preferring, never-empty):**

- If a **DOI** exists → `paper_uid = "doi:" + normalize(doi)` (lowercase, strip `https://doi.org/`).
- Else fall back, in order, to `pmid:…`, `pmcid:…`, `arxiv:…`.
- Else (no external id at all) → `corpus:" + ULID` assigned at first ingest, pinned by a
  content fingerprint (`sha1(normalizedTitle + firstAuthorFamily + year)`) so a re-encounter resolves
  to the same uid instead of duplicating.

**Dedup resolution order** when the same paper arrives from two APIs: DOI → PMCID → PMID → arXiv id →
title+author+year fingerprint. The manifest stores **all** known identifiers (`identifiers` map) so any
future lookup resolves, regardless of which id a downstream step has.

**Reconciliation after OA-location.** Initial dedup can only merge candidates that *share* an id at
discovery time — so the same paper surfaced by two sources with **disjoint** ids (one DOI-only, one
PMCID-only) gets two uids. OpenAlex returns each work's **full** id set (DOI + PMID + PMCID together),
but it can still be incomplete (e.g. a brand-new paper resolves to a PMID with no PMCID yet). So after
OA-location we run a **NCBI ID Converter** crosswalk (free, keyless, the contact email for politeness)
that maps PMID ↔ PMCID ↔ DOI authoritatively and gap-fills each record's missing ids in place — this is
what lets a record that arrived with, say, a DOI+PMID acquire the PMCID that links it to a legacy
`pmcid:`-only representation. A second pass then re-unions records whose `identifiers` now overlap (real
external ids only, never the fingerprint), collapses each group to one DOI-preferring canonical uid, and
deletes the orphaned `meta/<uid>.json` object (a fetched member keeps its binary — `storage.key` is left
untouched, only its uid is reassigned). The reconcile runs both within the current run's batch and
**corpus-wide** over the full manifest (so duplicates left by prior runs are cleaned too). This
guarantees one uid per paper even when discovery sources expose disjoint identifiers.

> Why DOI-derived rather than an opaque ULID for everything: it makes `paperId`s in a synthesised claim
> human-auditable and dedup-stable across re-ingests, while the `corpus:ULID` fallback guarantees even
> a DOI-less preprint or dataset gets a stable handle. The opaque part only appears where nothing
> canonical exists.

## 5 · Tooling — fetch, capture, extract (TypeScript, no Python)

Lives in a new **`tools/brain-ingest/`** (Node/TS, run on the project toolchain — Node 26). No Python
here — `tools/` stays Node/TypeScript per [AGENTS.md](../../../AGENTS.md)'s task-fit language rule, which
confines Python to the isolated `model-training/` workspace only.

| Concern | Choice | Why |
|---|---|---|
| HTTP | native `fetch` | Node 18+/26 has it; zero deps. |
| XML (Atom / JATS / Europe PMC) | `fast-xml-parser` | arXiv, PMC JATS, Europe PMC default to XML. |
| PDF → text | `unpdf` (pref.) or `pdfjs-dist` | `unpdf` is dependency-light & Deno/edge-safe; `pdfjs-dist` if we need layout. Prefer **PMC JATS / CORE `fullText`** over re-parsing a PDF when available — cleaner text. |
| Object-storage client | `@aws-sdk/client-s3` (or tiny `aws4fetch`) | S3-compatible → one client works for R2 / B2 / Supabase. |
| **Browser capture** (non-downloadable) | **Playwright (Chromium)** | Renders JS-heavy publisher pages; saves full **HTML / MHTML**, can print-to-PDF + screenshot for an archival copy. The cache tool for §3-5b. |
| Rate limiting | `p-limit` + per-source token bucket | Respect arXiv 3 s, NCBI 3/s (10/s keyed), CORE ~10/60s bucket, S2 ~1/s. |

**Browser-capture note:** without the (deferred) NUS session, capture only reaches what renders
publicly — which is still valuable: it grabs **OA HTML full text** (PMC, PLoS, Frontiers, MDPI render
full articles as HTML even when the PDF link is awkward) and, for truly paywalled items, the abstract +
metadata. Authenticated capture through NUS is the deferred upgrade that turns `paywalled` → `html`.

### 5.1 · Budget guardrails — hard-stop at 95% of any metered quota

Some sources are **metered with a daily cap**, not merely rate-limited. The ingester tracks cumulative
daily usage **per source** in a small persisted state file (`data/corpus/usage.json`, gitignored) and
**halts before issuing the call that would cross 95% of that source's budget** — fail-closed, not
best-effort. The 5% headroom absorbs in-flight/concurrent calls so we never actually exceed the cap.

| Source | Daily budget | Hard stop (95%) | Unit tracked |
|---|---|---|---|
| **OpenAlex** | $1.00 / day | **$0.95** | summed per-request cost — list/filter $0.0001 · search $0.001 · singleton $0 (we don't use the $0.01 content/semantic/text endpoints). At ~$0.004 for the whole corpus this cap is a safety net, not a bottleneck |
| **NCBI E-utils** | *rate only* (10 req/s keyed) | n/a | throttle, not a daily cap → handled by the token bucket |
| Crossref / Europe PMC / PMC OA / arXiv / Unpaywall / DOAJ / direct OA-URL fetch | unmetered (free, keyless) | n/a | rate-limited only |
| **CORE** | **NOT a daily budget** — corrected 2026-07-01 after live verification. Its `X-RateLimit-*` response headers showed a **~10-request bucket that fully refills ~60s after exhaustion**, not the `1000/day` this table previously (wrongly) claimed. No evidence of any coarser daily cap on a free personal key. | n/a | rate-limited only — `limits/rateLimiter.ts`'s `core` profile is paced to the real ~10/60s bucket, with a 429-aware retry (~61s wait, matching the confirmed refill window) in `retrieval/core.ts` as a backstop. Also **skipped entirely (no query) for `retrievability:'paywalled'` records** — OA-location already confirmed no OA copy exists, and live corpus data showed paywalled/unknown records as the single largest category of CORE calls that came back empty. `'unknown'` records still get a real query. |
| Semantic Scholar / Lens | *no key configured* | n/a | S2 runs anonymous-rate; Lens skipped |

Rules:
- **Persist counters across runs** — a crash mid-run must not reset the day's spend (the file is the
  source of truth, re-read at startup).
- **Reset at the provider's window** — UTC midnight unless the provider documents a rolling window;
  store the window start with the counter.
- **Per-source self-guard, not a whole-run stop** — each metered adapter (CORE) checks its own
  `wouldExceed95` before dispatching and declines gracefully (no network call, never throws) once at its
  hard-stop line, so a paper it can't reach stays `discovered` (never `failed`). This is deliberately
  **not** a whole-run early-exit: the free, unmetered steps ahead of CORE in the retrieval order (PMC
  JATS, Europe PMC, arXiv, the direct OA-URL fetch, §3) never touch CORE's budget, so a capped CORE must
  not stop the run from still serving those papers for free — only CORE itself declines. The run finishes
  its `--limit` batch normally; a resulting run summary reports (informationally) whether a metered
  source ended the run at its cap and how many papers are left `discovered`. A multi-day ingest of the
  ~2000-paper corpus is the expected mode, not an error — resume tomorrow for whatever still needed CORE.
- **OpenAlex cost is deterministic, not estimated** — each request type has a fixed price (above), so
  the tracker sums actual per-call costs rather than guessing; the $0.95 line stays as a hard safety net.

**Host-memory guard (`src/limits/memoryGuard.ts`, added 2026-07-02).** A different kind of guard from
the two above — it protects the **host machine**, not an external API quota. Before each retrieval
attempt (when enabled — the CLI turns it on by default; `run()` callers that omit it get no checking at
all), it reads system-wide free memory (`os.freemem()`/`os.totalmem()`) and, if the machine is critically
low (default: under 10% free **or** under 512MB free, whichever trips first), pauses for a few seconds
before rechecking (up to 3 times) rather than piling more network + PDF-parsing work onto an already
struggling system. Motivated by a real incident: the dev machine was down to ~5% free RAM (many
concurrent editor/agent processes, unrelated to ingestion) and background runs were getting killed
unpredictably. Deliberately **soft-fail**: after its wait budget, it always lets the run proceed anyway —
ingestion's own per-paper footprint is small (a few MB, fully sequential, no local file writes for the
corpus itself — see §6), so pausing is a courtesy, never a reason to leave a paper unfetched.

**OA-location strategy — bulk batched queries (the efficient "bulk", not the snapshot).** Resolve OA
locations by **batching up to 50 DOIs per OpenAlex list call** (`filter=doi:<a>|<b>|…`, `$0.0001`/call →
~40 calls ≈ **$0.004** for the full ~2000-paper corpus) rather than one singleton per paper. **Unpaywall**
(free, 100k/day, `email=` param) is the **zero-cost fallback** for any DOI OpenAlex doesn't resolve. The
full **CC0 snapshot is deliberately NOT used** — it's ~hundreds of GB (the entire 240M-work corpus) and
only pays off at million-paper scale; batched API queries are strictly more efficient for 2000 papers.

## 6 · Storage — where 2000 papers live

**Sizing.** ~2000 biomedical papers: PDFs average ≈2 MB (range 1–5 MB with figures) → **≈4 GB**; HTML /
JATS captures are far smaller (~0.1–0.5 MB) → ≈1 GB; extracted text is negligible. **Total < 10 GB** —
comfortably inside a single free object-storage tier.

**Recommendation — Cloudflare R2 (free tier).**

| Option | Free allowance | Egress | API | Verdict for us |
|---|---|---|---|---|
| **Cloudflare R2** ✅ | **10 GB** storage, 1M writes + 10M reads / mo | **$0** | S3-compatible | **Pick this.** Fits 2000 papers with headroom; S3 client works from Node/TS; no egress cost when we pull text for re-extraction. |
| Backblaze B2 | 10 GB storage, downloads free up to 3× stored/day | Mostly free | S3-compatible | Solid alternative. |
| Supabase Storage | **1 GB** free (Pro = 100 GB @ $25/mo) | metered | S3-compatible | Already in-stack, but **1 GB is too small** for the PDFs — only viable on Pro. |
| AWS S3 free tier | 5 GB **for 12 months only** | metered | S3 | Expires; skip. |

Because the corpus is a **study asset, not served to the app**, egress and latency barely matter — but
R2's zero-egress + 10 GB free + S3 API is the cleanest, and it keeps us off the product's Supabase quota.

**Layout (S3-compatible, content-addressed by `paper_uid`):**

```
r2://ourobion-corpus/                # CANONICAL store (metadata + binaries)
  manifest/papers.jsonl          # the combined manifest index (TRUTH — all records, one JSON/line)
  meta/<paper_uid>.json          # per-paper metadata record (TRUTH — full PaperRecord)
  pdf/<paper_uid>.pdf            # downloadable OA PDFs
  jats/<paper_uid>.xml           # PMC/Europe PMC structured full text (preferred for extraction)
  text/<paper_uid>.txt           # extracted plain text (DERIVED — rebuildable)
local cache (git-untracked — `data/corpus/` is gitignored):
  data/corpus/html/<paper_uid>.html   # browser-captured non-downloadable copies
  data/corpus/papers.jsonl            # local working manifest (a cache; R2 is canonical)
  data/corpus/usage.json              # per-source daily budget counters (§5.1)
```

Practical flow: **cache locally during a run, then sync to R2** as the durable canonical store — both
the binaries AND the metadata (`manifest/papers.jsonl` + one `meta/<uid>.json` per paper) are synced
after the discovered records are upserted and again at end-of-run. Record a `sha256` per object so a
re-sync is idempotent (unchanged objects are sha-skipped) and corruption is detectable.

## 7 · Licensing & compliance posture

Settled for ourobion's **non-commercial study** use:

- **Open-access corpus is broadly usable, including CC BY-NC**, because the use is non-commercial — the
  NC restriction doesn't bite. Ingest the full OA set, not just CC0/CC-BY.
- **Copyright still applies** regardless of legal-entity status — "not a company" is *not* an exemption.
  So: free full text only from OA / sanctioned routes; **no proxy scraping of paywalled all-rights-
  reserved content** in v1 (that's the deferred NUS/TDM question).
- **The brain stores derived claims, not the papers.** Edges carry short grounded `quoteSpan`s and
  `Citation`s, not republished full text — transformative use, the real safety margin. **The corpus is
  never publicly shared or redistributed.**
- **Record the license per paper anyway** (`oa.license` in the manifest). ourobion is heading toward a
  product; the day it commercialises, NC-licensed inputs become a *filter*, not a re-ingest. Cheap
  insurance now.

*(Singapore's Copyright Act 2021 computational-data-analysis (TDM) exception likely strengthens the
lawful-access case for paywalled content — folded into the deferred NUS/TDM research, not relied on
here.)*

## 8 · The manifest record (`PaperRecord`)

The shape of one `data/corpus/papers.jsonl` line — the TRUTH-tier index. (Illustrative; not yet a
`shared/` contract — it becomes one if/when a persisted DB or the app consume it.)

```ts
interface PaperRecord {
  paperUid: string;                 // §4 — the join key; == Citation.paperId
  identifiers: {                    // every known external id (dedup + future lookup)
    doi?: string; pmid?: string; pmcid?: string; arxiv?: string;
    openalex?: string; s2?: string;
  };
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;            // journal / preprint server
  abstract: string | null;
  discoveredVia: string;           // which discovery API surfaced it
  topicTags: string[];             // seed domain(s): 'gut_microbiome' | 'dengue' | ...
  oa: {
    isOa: boolean;
    status: 'gold'|'green'|'hybrid'|'bronze'|'closed'|'unknown';
    bestOaUrl: string | null;
    license: string | null;        // 'cc-by' | 'cc-by-nc' | 'cc0' | 'publisher-specific' | null
    version: 'published'|'accepted'|'submitted'|null;
  };
  // Richer metadata (OPTIONAL — older manifest lines without them still parse).
  // Populated from the OpenAlex Work during OA-location (§10.4).
  metrics?: {                       // citation count is a snapshot; record when read
    citedByCount: number | null;
    source: 'openalex'|'crossref'|null;
    asOf: string | null;            // ISO date the count was read
  };
  journal?: {                       // structured complement to `venue`
    issn: string[];
    publisher: string | null;
    type: string | null;            // 'journal' | 'repository' | 'conference' | ...
  };
  workType?: string | null;        // 'article' | 'preprint' | 'review' | ...
  concepts?: string[];             // subject/topic display names (dashboard facets)
  retrievability: 'pdf'|'html'|'paywalled'|'unknown';
  storage: {
    kind: 'object'|'local'|'none';
    key?: string;                  // r2 key, e.g. pdf/<paper_uid>.pdf
    localPath?: string;            // for browser-captured html
    contentType?: string;
    sizeBytes?: number;
    sha256?: string;
  };
  fullText: { extracted: boolean; method: 'jats'|'core'|'pdf'|'html'|'directOa'|null; charCount: number | null };
  status: 'discovered'|'fetched'|'failed';
  errors: string[];
  fetchedAt: string | null;        // ISO; null until fetched
}
```

The brain's synthesis step reads `text/<paper_uid>.txt` (or `jats/…`), emits `RelationshipClaim`s whose
`citations[].paperId` / `quoteSpans[].paperId` are these `paperUid`s — closing the trace loop from any
served edge back to its sources.

## 8.1 · Invoking a run from nao (GitHub Actions) + the remote control plane

The CLI is normally invoked by a human on their own machine. nao (a Cloudflare Worker) **cannot run it
directly** — a single seed's worth of discovery + retrieval routinely takes minutes to hours (CORE's
own ~10-req/60s bucket alone paces a 100-paper batch to ~10 minutes before any actual work), and every
Worker invocation has a hard CPU-time ceiling far short of that. There is no way to make ingestion
"just run inside the Worker" regardless of how deterministic the pipeline is — it's a platform
execution-time constraint, not a code design choice.

**So nao triggers a real, persistent compute environment instead: a GitHub Actions workflow.**
`.github/workflows/brain-ingest.yml` is a `workflow_dispatch` job — nao's "Run now" button calls
GitHub's REST API (`apps/nao/src/lib/githubDispatch.ts`) to fire that event with the chosen `seed`/
`limit` as **workflow inputs**, and the job runs immediately on a GitHub-hosted runner (checkout →
`npm ci` → `.env` from repo secrets → `npx tsx src/cli.ts ingest --remote-control`). No polling, no
queued mailbox — the seed/limit go straight into the dispatch call.

What's left in `control/ingest-config.json` (same R2 bucket, §6 layout — the one shared surface both
`tools/brain-ingest` and `apps/nao` already read/write) is state that should apply **regardless of how
a run was triggered**:

```ts
interface IngestControlConfig {
  paused: boolean;                       // blocks BOTH "Run now" and any --remote-control CLI run
  limits: { openalexDailyUsd?: number }; // overrides limits/budget.ts's compiled-in $1.00
  updatedAt: string;
  updatedBy: string;
}
```

- **CLI side** (`tools/brain-ingest/src/control.ts`): opt-in via `ingest --remote-control` /
  `resume --remote-control` (`run.ts`'s `RunOptions.controlFromR2`). Read once at the START of a run —
  `paused` skips discovery too, not just retrieval. Best-effort throughout: a missing/unreadable
  document behaves exactly like an uncontrolled run — nothing here is required for local/offline use.
- **nao side**:
  - `app/(app)/api/ingest-control/route.ts` — GET/POST for **settings** (`paused`, budget override)
    against the R2 document. Gated by the existing Supabase middleware, no new auth code needed.
  - `app/(app)/api/ingest-control/trigger/route.ts` — POST to **actually start a run**. Checks
    `paused` FIRST (a real safety switch for the button, not just a hypothetical scheduler) then calls
    `dispatchIngestWorkflow` (`lib/githubDispatch.ts`), which needs a fine-grained GitHub PAT scoped to
    this repo with `Actions: Read and write`, stored as the `GH_ACTIONS_TOKEN` Worker secret (never
    committed), plus `GH_REPO` (`owner/repo`) and optionally `GH_ACTIONS_REF` (defaults to
    `dev-phase2-run4` for the authorized Run 4 integration line).
  - `app/(app)/ingest/page.tsx` + `components/IngestControlPanel.tsx` — pause/resume, "Run now"
    (seed + limit → the trigger route), and the budget override.
  - Both sides keep independently-typed copies of `IngestControlConfig`/`IngestLimits` (same
    duplication pattern as `PaperRecord`/`FullTextInfo` elsewhere in this doc — no shared cross-app
    module).
- **Budget override plumbing** (`limits/budget.ts`'s `BudgetOptions.budgetOverrides`): per-instance,
  merged over the module-level `BUDGETS` — a control-document override never mutates the compiled-in
  default, so an unrelated `run()` call without `controlFromR2` is completely unaffected.
- **Repo secrets the workflow needs** (set manually in GitHub repo settings — never pushed by an
  agent): `INGEST_CONTACT_EMAIL`, `OPENALEX_API_KEY`, `NCBI_API_KEY`, `S2_API_KEY`, `CORE_API_KEY`,
  `LENS_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — same values
  as `tools/brain-ingest/.env` (§10.1's env template).

## 9 · Deferred / open

- **NUS institutional proxy + publisher TDM APIs** (Elsevier/Springer/Wiley) + the **Singapore 2021 TDM
  exception** — own follow-up research before any paywalled automation. Unlocks `paywalled → html/pdf`.
- **Synthesis & verifier pipeline** — the two-LLM passes that consume this corpus (BRAIN-DESIGN §
  safeguard); `promptVersion` scheme.
- **`PaperRecord` as a `shared/` contract + guards** — promote when a DB or the app consumes the
  manifest (same deferral pattern the registry/brain contract used).
- **bioRxiv/medRxiv, Lens.org field-level detail** — include in the fetchers; verify exact response
  shapes before relying.

## 10 · Build sequence

The implementation plan for `tools/brain-ingest/`. §1–§9 are *design* (the what/why); this section is the
*build order* (how, in what sequence, verified at each step). It is the durable companion to the working
plan that lives on the session issue + `docs/sessions/` log (AGENTS §7).

### 10.0 · Ground rules

- **Stack:** Node 26 + TypeScript, ESM, run via `tsx`/`node`. **No Python** in `tools/` (AGENTS.md's
  task-fit rule confines Python to `model-training/` only). Deps per
  §5: `fast-xml-parser`, `unpdf`, `@aws-sdk/client-s3`, `p-limit`, `playwright` (deferred to a later step).
- **Where it runs:** standalone tool, not bundled into the app and not a Supabase function. Secrets come
  **only** from `tools/brain-ingest/.env` via the config loader (10.1) — never inlined, never logged.
- **Tracking:** one session issue + one worktree off `dev-phase2` + one `docs/sessions/` entry (AGENTS §7).
  Each step below is a **small, independently verifiable commit** that keeps `tsc --noEmit` green.
- **Network discipline:** **no live external call before §10.3.** Steps 10.1–10.2 are pure infra,
  unit-tested against **fixtures** (canned API responses in `tools/brain-ingest/tests/fixtures/`) so the
  parsers and budget logic are CI-testable **without keys**.
- **Idempotent + resumable throughout:** the manifest (`papers.jsonl`) + `usage.json` are the only state;
  any step can crash and resume. A multi-day run is the expected mode (§5.1).

### 10.1 · Skeleton + config + types

| | |
|---|---|
| **Goal** | A compiling, runnable tool that loads & validates config — no I/O beyond reading `.env`. |
| **Creates** | `tools/brain-ingest/package.json`, `tsconfig.json`, `src/config.ts` (reads/validates every var from §E of the env template; fails fast on missing **required** keys, marks S2/Lens absent → source disabled), `src/types.ts` (the `PaperRecord` interface from §8 + source/status enums), `src/cli.ts` (arg parsing, `--help`). |
| **Depends on** | nothing. |
| **Done when** | `tsc --noEmit` clean; `node src/cli.ts --check-config` prints which sources are enabled (keyed/keyless/disabled) and exits 0 with a valid `.env`, non-zero if a required key is missing. **No network.** |

### 10.2 · Rate limiter + §5.1 budget tracker

| | |
|---|---|
| **Goal** | The safety infra that *every* network call will route through — built and tested before any call exists. |
| **Creates** | `src/limits/rateLimiter.ts` (per-source `p-limit` + token bucket: arXiv 1/3s, NCBI 10/s keyed/3/s anon, CORE/S2 caps), `src/limits/budget.ts` (loads/persists `data/corpus/usage.json`; per-source daily counters with window-start; `wouldExceed95(source, cost)` guard; resets at UTC midnight), `tests/budget.test.ts`. |
| **Depends on** | 10.1. |
| **Done when** | Unit tests prove: a call that would cross 95% is **refused before dispatch**; counters persist across a simulated restart; UTC-midnight reset works. OpenAlex cost model uses the §5.1 per-request prices. **No network.** |

### 10.3 · Discovery adapters (first live calls)

| | |
|---|---|
| **Goal** | Topic seed → candidate works with identifiers, from the keyless/keyed discovery sources. |
| **Creates** | `src/sources/discovery/{crossref,pubmed,europepmc,arxiv}.ts` (+ `s2.ts` guarded by key presence), each returning a normalized `Candidate {identifiers, title, authors, year, venue, abstract, discoveredVia}`. XML via `fast-xml-parser`; all calls through 10.2. `src/seeds.ts` (the topic seed list from §3.1: gut microbiome, hydration, antibiotics, sleep/HRV, dengue/vector, environmental health). |
| **Depends on** | 10.1, 10.2. |
| **Done when** | Parsers pass against fixtures (offline); a **live smoke run** on one seed returns ≥1 candidate per source within rate limits and records zero budget breaches. Writes candidates to the manifest as `status: 'discovered'`. |

### 10.4 · Identity + dedup + OA-location

| | |
|---|---|
| **Goal** | Collapse candidates to canonical papers with a `paper_uid`, then resolve OA location in **bulk**. |
| **Creates** | `src/identity.ts` (the §4 scheme: DOI→pmid→pmcid→arxiv→`corpus:ULID` fingerprint; dedup resolution order; merges `identifiers` maps), `src/sources/oa/openalex.ts` (**batched list queries — up to 50 DOIs per `filter=doi:…` call**, §5.1), `src/sources/oa/unpaywall.ts` (free fallback). Populates `oa{}` on each `PaperRecord`. |
| **Depends on** | 10.3. |
| **Done when** | Two candidates that are the same paper from different APIs resolve to one `paper_uid` (fixture test); a batch of 50 DOIs costs one OpenAlex list call; every record gets `retrievability` classified (`pdf`/`html`/`paywalled`/`unknown`) and an `oa.license`. |

### 10.5 · Retrieval + text extraction → R2

| | |
|---|---|
| **Goal** | Turn a `pdf`/`html` classification into stored bytes + extracted text. |
| **Creates** | `src/retrieval/{pmcJats,core,arxivPdf,europepmc,directOa}.ts` (prefer JATS / the free direct OA-URL fetch over CORE's metered search, §5), `src/extract.ts` (`unpdf` for PDFs; JATS→text), `src/storage/r2.ts` (`@aws-sdk/client-s3`; `put/get/head`; `sha256` per binary; idempotent re-sync; layout from §6). Browser-capture (Playwright, §5-5b) is a **stub interface here, implemented in 10.7**. `directOa.ts` (added post-launch) fetches the OA-location step's already-resolved `oa.bestOaUrl` directly — unmetered, keyless — so CORE is a last resort rather than the default catch-all for anything without a PMCID/arXiv id. |
| **Depends on** | 10.4. |
| **Done when** | A known OA DOI flows end-to-end: PDF/JATS fetched → uploaded to R2 under `pdf/<uid>` or `jats/<uid>` → `text/<uid>.txt` written → manifest `storage{}` + `fullText{}` filled → re-running skips the already-synced binary (sha256 match). |

### 10.6 · Orchestrator CLI (end-to-end, resumable)

| | |
|---|---|
| **Goal** | One command: seeds → discover → resolve → retrieve → extract → manifest, honoring all guardrails, resumable across days. |
| **Creates** | `src/run.ts` (the pipeline of §3 steps 1–7 wired together), `src/manifest.ts` (append/update `papers.jsonl`, read-back for resume), CLI verbs: `ingest --seed <topic> [--limit N] [--dry-run]`, `status` (manifest + budget summary), `resume`. |
| **Depends on** | 10.5. |
| **Done when** | `ingest --seed dengue --limit 20 --dry-run` plans without calls; the live run fetches ≤20 papers, **a capped metered source (CORE) declines gracefully per-record rather than stopping the run** (§5.1 — the free steps ahead of it still serve what they can) leaving whatever it alone would have needed as `discovered`, and a second invocation resumes without re-fetching. |

### 10.7 · Browser capture (non-downloadable) + hardening

| | |
|---|---|
| **Goal** | Reach OA HTML full text the binary path misses; production-grade error handling. |
| **Creates** | `src/retrieval/capture.ts` (Playwright/Chromium → HTML/MHTML to `data/corpus/html/<uid>.html`, §5-5b), retry/backoff on 429/5xx, structured per-paper `errors[]`, a final run report. |
| **Depends on** | 10.6. |
| **Done when** | A `html`-classified OA article (e.g. a PLoS/Frontiers page) is captured and text-extracted; transient failures retry then mark `status:'failed'` with a reason rather than aborting the run. |

### Milestone mapping & deferrals

- This sequence is the paper-ingestion front end that phase-2-plan's **Track B / W2** assumes "once papers
  arrive" (phase-2-plan line 183) — it is the **prerequisite** to B4 (extract skeleton), not part of it.
- `PaperRecord` stays a **local `types.ts` interface** until a DB or the app consumes the manifest, at
  which point it promotes to a `shared/` contract with guards (the §9 deferral, registry/brain pattern).
- Authenticated NUS/TDM capture, the brain runtime schema, and the synthesis/verifier passes remain
  **out of scope** here (§9) — this build stops, as the design does, at "text + a `paper_uid`."
</content>
</invoke>
