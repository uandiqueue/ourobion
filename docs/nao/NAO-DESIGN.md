# Ourobion nao — Design (brain inspection & curation)

**nao** (脑 — "brain") is ourobion's human-facing **window into the brain**: query and visualise the
metric-relationship graph, inspect the *evidence* behind every relationship, and curate the brain — by
hand and, later, with an LLM. It is the **first product surface split out from the main app** (now
**ourobion biotope**): biotope is the consumer ecological-health app; nao is the expert lens on the
knowledge graph that powers biotope's insights.

This doc is the durable design. The brain *contract* it renders lives in [`shared/brain/`](../../shared/brain/);
how edges are synthesised + verified is [`BRAIN-DESIGN.md`](BRAIN-DESIGN.md); how the paper corpus is
acquired is [`BRAIN-INGESTION-DESIGN.md`](BRAIN-INGESTION-DESIGN.md); how biotope *consumes* the brain is
[`../biotope/INSIGHTS-ENGINE-DESIGN.md`](../biotope/INSIGHTS-ENGINE-DESIGN.md) and [`../PHASE2-PLAN.md`](../PHASE2-PLAN.md) (Track B/W2).

> **Status (current reality).** The brain has a **contract** (`shared/brain/`, TRUTH, 2-reviewer-guarded)
> and a **paper corpus** (on Cloudflare R2, see ingestion design) — but **no edges yet**: the synthesis
> LLM, the verification LLM, and a runtime edge store are unbuilt (Track B). So nao's graph/evidence
> features depend on work that does not exist, while a **paper-corpus dashboard ships from R2 today.**
> **v1 is therefore the corpus dashboard;** the graph, evidence, ingestion, and LLM features land in
> phases as the brain fills in (§5).

## 1 · What nao is (three capability pillars)

1. **Query + visualisation** — render the brain as a graph; inspect each relationship's evidence
   (grounded quote snippets + citations) and quality markers.
2. **Secondary ingestion pathway** — let a human attach a paper + metadata, or author a relationship,
   directly into the brain (the automated corpus pipeline is the primary pathway).
3. **LLM query + modification (extension)** — natural-language questions over the graph, and
   LLM-*proposed* edges that a human approves before they enter the brain.

nao deliberately **shows derived claims and short grounded evidence — never full paper text** (the
licensing + transformative-use posture from the ingestion design §7 carries over: the corpus is a
private study asset, never redistributed).

## 2 · Two-tier placement (the rule that shapes the data model)

A clean instance of the repo's core principle ([memory 0001](../memory/0001-two-tier-truth.md)):

- **TRUTH (never reconstructable):** the **paper corpus** (R2 — metadata + binaries; ingestion design
  §1/§6) and the **canonical `VerifiedEdge` records** — both the machine-made ones (LLM synthesis +
  verification) **and human-curated ones authored in nao**. Human curation is truth: a rebuild must
  never clobber it.
- **DERIVED (rebuildable):** the **Neo4j graph** nao renders, and biotope's served insights. Neo4j is a
  *projection* of the truth-tier edges, rebuilt by a sync job (§4). This is why Neo4j is **not** the
  source of truth — losing it costs only a re-projection.

## 3 · Where nao sits (architecture)

- **App:** `apps/nao/` in this monorepo — TypeScript **Next.js (App Router, React)**, hosted on
  **Cloudflare Pages** (already on Cloudflare for R2). A thin **server data layer** (server routes /
  Cloudflare Workers) holds all credentials: **R2 keys, Neo4j keys, and LLM keys are server-side only —
  never shipped in the client bundle.**
- **Monorepo:** nao is a *sibling* of the Flutter app, which now lives at `apps/biotope/` (the
  `src/ → apps/biotope/` move is done; both apps sit under `apps/`).
- **Shared contracts:** nao imports the brain contract from [`shared/brain/`](../../shared/brain/)
  (`relationships.ts`, `relationships.schema.ts`, and the gating helpers in `index.ts`) and
  [`shared/types/`](../../shared/types/) via a repo-root npm workspace
  (`workspaces: ["apps/*","shared","tools/*"]`). **Any change to a `shared/` contract still needs a
  2-reviewer PR** ([memory 0002](../memory/0002-shared-contract-two-reviewers.md)) — nao consumes the
  contract; it does not fork it.

## 4 · Auth & access

- **Supabase Auth** — the same identity provider as biotope (one account system). nao verifies the
  Supabase JWT in its server layer and enforces a **role** (`viewer` / `curator` / `admin`) for what a
  user may see and write. (Chosen over Cloudflare Access — which would only gate the door — because nao
  wants in-app roles and a path to external users; **not** Firebase, which would add a third cloud.)
- **Hosted Supabase only** for real auth — local Docker can't do OAuth
  ([memory 0011]; biotope's `auth_service` patterns in
  [`apps/biotope/lib/modules/m1_core/impl/auth_service.dart`](../../apps/biotope/lib/modules/m1_core/impl/auth_service.dart)
  are the reference). A `nao_role` claim (app_metadata or a `nao_members` table) gates access; **v1
  requires an authenticated, authorised user even to load** (the brain is a shared asset, not per-user
  data, so this is access-gating + edit-attribution, not per-row RLS).

## 5 · Data sources & feature phasing

The brain fills in over time, so nao ships in phases. Each phase is gated on the previous.

### v1 — Corpus dashboard *(ships now, R2-backed)*

Reads the paper corpus directly from R2 via a server-side `@aws-sdk/client-s3` client — listing from
`manifest/papers.jsonl`, detail from `meta/<paper_uid>.json` (reuse the keys/layout in
[`tools/brain-ingest/src/storage/r2.ts`](../../tools/brain-ingest/src/storage/r2.ts); the record shape is
the `PaperRecord` in [`tools/brain-ingest/src/types.ts`](../../tools/brain-ingest/src/types.ts)).

- **Papers ingested** count; **search** (title / author / `topicTags` / `concepts`); **facets**
  (`oa.status`, `retrievability`, `workType`, year, `metrics.citedByCount`); **per-paper detail**
  (title, authors, venue, OA status + license, journal/ISSN/publisher, citation count, all identifiers).
- Mirrors what `brain-ingest status` reports. **Full text (`text/<uid>.txt`) is never fetched or served.**

### v2 — Graph + evidence *(after the synthesis/verification pipeline + edge store + Neo4j)*

A force-directed graph of **servable `VerifiedEdge`s** (nodes = metrics, edges = relations). Click an
edge → an **evidence panel**: the `QuoteSpan.quote` **snippets** (+ `locator`) and the `Citation`s
(each deep-linked to its paper's metadata card via `paperId == paper_uid`), plus **quality markers read
straight from the contract** (§6). *(Pillar 1.)*

### v3 — Secondary ingestion pathway

A curator attaches a paper + metadata directly (writes a `PaperRecord` into the R2 corpus) and/or
authors a relationship by hand → written to the **truth-tier edge store with `provenance:'human'`**, so
a Neo4j rebuild never clobbers it. *(Pillar 2.)*

### v4 — LLM query + modification *(extension)*

Natural-language query over a *retrieved* brain subgraph — constrained so it introduces **no
relationship not in the retrieved set** (the same guardrail as biotope's grounded synthesis,
[`../PHASE2-PLAN.md`](../PHASE2-PLAN.md) W2) — plus LLM-*proposed* edges that require **human approval**
before entering the truth store. *(Pillar 3.)*

### The edge store (v2+)

Canonical `VerifiedEdge`s live in an auditable **truth-tier store** — a Supabase table `verified_edges`
(or R2 JSONL) — each tagged `provenance: 'llm' | 'human' | 'seed'`. A small **sync job projects them into
Neo4j Aura (free tier)** for traversal + visualisation. nao reads **Neo4j** for the graph and the
**truth store** for editing/audit. Rebuilding Neo4j from the truth store is always safe.

## 6 · Evidence & quality markers — reuse the contract, don't reinvent

The brain contract ([`shared/brain/relationships.ts`](../../shared/brain/relationships.ts)) already
encodes everything nao must display:

- **Snippets** = `QuoteSpan.quote` (verbatim, deterministically presence-checked) + `locator`
  (section/page/figure); tied to `Citation.paperId`, which **equals the corpus `paper_uid`** — so a
  snippet deep-links to its paper's metadata card.
- **Evidence quality** = `Citation.evidenceTier` (1–5: mechanistic → meta-analysis),
  `Citation.impactTier` (venue weight, kept separate from study-design strength),
  `EdgeVerification.confidence` (0..1), `dqs.weight`, `corroboration {supporting, contradicting}`,
  `verdict`, and the rolled-up **`servingBand`** (`high` / `mid` / `hold`) + `needsReview` from
  [`shared/brain/index.ts`](../../shared/brain/index.ts). nao surfaces these as-is.
- The future **source-reliability grading standard** is an **extension of `impactTier`** — folding in
  corpus metadata already captured (`journal`, `metrics.citedByCount`, `workType`) into a per-source
  reliability score. It does **not** need a new evidence model.

## 7 · Visual design — "bio-neo-mythical"

The brand mark already *is* this thesis: **mythical** (ouroboros — an *open* ring: "the loop of
understanding is never finished"), **bio** (cell/nucleus, 23-segment ring = haploid chromosomes, DNA
double-helix weave), **neo** (bioluminescent teal→blue gradient, fluorescence-microscopy glow). So nao
is biotope's **dark, expert, graph-centric sibling** — biotope is the warm light *ecosystem*; nao is the
deep, glowing *brain*. Tokens come from
[`assets/ourobion-brand/`](../../assets/ourobion-brand/); the sibling system is
[`../biotope/ui-context/UI-DESIGN-CONTEXT.md`](../biotope/ui-context/UI-DESIGN-CONTEXT.md).

- **Palette (Ourobion dark):** background `#0B1D24`; accent ramp **`#2BC4BE` → `#2FB7D6` → `#3FA2E6` →
  `#5E8DF0` → `#7C86F2`**; eyebrow labels `#2BC4BE`; light text on dark. The 23-step coil ramp is the
  **data-viz gradient** (node colour by domain, edge colour by relation kind, glow by `edgeScore`).
- **Typography:** **Manrope** for UI/body (continuity with biotope); **Outfit** for display/headers +
  the wordmark. Keep biotope's **uppercase, letter-spaced eyebrow** labels.
- **Graph aesthetic:** dark canvas; nodes = glowing cyan orbs (size by connectivity); edges = teal→blue
  gradient strands (thickness/opacity by `confidence`/`edgeScore`; colour/style by `relation` kind);
  **bioluminescent glow on hover/active**. `react-force-graph` (WebGL) or Cytoscape.js are the candidate
  libs — both render arbitrary data, so they fit the "project from the truth tier" model and aren't
  locked to Neo4j's own viz.
- **Quality visual grammar:** `evidenceTier` → a 1–5 pip bar; `servingBand` → a colour state (cyan =
  high, amber = "limited evidence"/mid, muted = hold); `confidence` → a ring meter; contradicted /
  needs-review edges flagged (per `needsReview`).
- **Ambient/backdrop:** a dark evolution of biotope's "living backdrop" — slow deep-teal/blue glows
  (high blur, low opacity) on near-black, or a slowly rotating/pulsing **open-ring + helix** motif:
  "deep-sea bioluminescence", calmer than biotope's pastels. Reuse the open-ring/helix for loaders,
  empty states, section dividers.
- **Shape & voice:** inherit biotope radii (14–24px) but slightly more technical; **glowing 1px borders**
  on dark surfaces rather than soft shadows. Voice: precise, scientific, *alive* — never clinical.

## 8 · Build map (reuse vs create)

**Reuse (do not duplicate):**

- [`shared/brain/relationships.ts`](../../shared/brain/relationships.ts),
  [`relationships.schema.ts`](../../shared/brain/relationships.schema.ts),
  [`index.ts`](../../shared/brain/index.ts) — edge contract + gating (`edgeScore`, `servingBand`,
  `servableEdges`, `needsReview`).
- [`tools/brain-ingest/src/types.ts`](../../tools/brain-ingest/src/types.ts) — `PaperRecord` (v1 model).
- [`tools/brain-ingest/src/storage/r2.ts`](../../tools/brain-ingest/src/storage/r2.ts) — R2 key layout
  (`MANIFEST_KEY`, `metaKey`, `pdfKey`/`jatsKey`/`textKey`) + S3 client setup.
- [`assets/ourobion-brand/`](../../assets/ourobion-brand/) — palette (`color/colors.json`), logo SVGs.

**Create:**

- A repo-root `package.json` with workspaces so `apps/nao` can import `shared/`.
- `apps/nao/` — the Next.js app: an R2 reader in a server route, Supabase auth + role gate, the corpus
  dashboard UI, and a design-token module derived from the brand palette.
- (v2+) `verified_edges` truth store + the Neo4j projection sync job.

## 9 · Verification (v1 acceptance)

1. `npm run dev` in `apps/nao`; sign in via the hosted Supabase project as an authorised role.
2. Dashboard lists the R2 corpus; **paper count matches `brain-ingest status`** for the same bucket.
3. Search + facets (oa / topic / type / year / citations) filter correctly against `manifest/papers.jsonl`.
4. Per-paper detail renders metadata; **confirm `text/<uid>.txt` is never fetched/exposed**, and that R2
   credentials are absent from the client bundle (inspect built JS / network tab).
5. `tsc --noEmit` + lint clean; an unauthenticated / under-privileged user cannot load the dashboard.

## 10 · Deferred / open

- **Brain synthesis + verification pipeline** (Track B) — the real critical path for everything past v1;
  nao v2 cannot render a real graph until edges exist. See [`BRAIN-DESIGN.md`](BRAIN-DESIGN.md).
- **Truth-tier `verified_edges` store + Neo4j projection sync** — **shape now decided** (Supabase table
  or R2 JSONL = truth; deterministic sync → Neo4j projection) per the
  [pipeline decision](../human-briefs/2026-07-01-brain-pipeline-and-training-eval.md); build lands with v2.
- **Source-reliability grading standard** — **decided**: an `evidenceTier` study-design classifier + an
  `impactTier` venue lookup (SJR + OpenAlex; JCR dropped as paid), per
  [`BRAIN-MODELS-TRAINING.md`](BRAIN-MODELS-TRAINING.md). Extends `impactTier` (§6) — no new evidence model.
- **`apps/biotope/` move** — relocating the Flutter app under `apps/` is optional housekeeping.
- **External users / richer roles** — Supabase Auth was chosen partly to keep this open.
