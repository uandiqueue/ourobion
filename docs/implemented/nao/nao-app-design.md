---
title: Ourobion nao — Design (brain inspection & curation)
summary: nao is ourobion's expert web window into the brain (query/visualise the graph, inspect evidence, curate edges); agents building nao read this for its capability pillars, phasing, auth, and build map — the end-to-end engine lives in insight-engine-architecture.
type: design
scope: nao
status: unverified
updated: 2026-08-02
---
# Ourobion nao — Design (brain inspection & curation)

> **Authoritative integrated architecture:** [`../shared/insight-engine-architecture.md`](../shared/insight-engine-architecture.md) is the single source of truth for the end-to-end insight-engine (serve + authoring). This doc is the nao-scoped (brain inspection & curation) view; where it differs, the architecture doc wins.

**Scope.** This doc covers nao's product surface — inspecting, visualising, and curating the brain. The end-to-end 23-stage insight engine and its inter-stage contracts live in [`insight-engine-architecture`](../shared/insight-engine-architecture.md); this doc does not restate them.

**nao** (脑 — "brain") is ourobion's human-facing **window into the brain**: query and visualise the
metric-relationship graph, inspect the *evidence* behind every relationship, and curate the brain — by
hand and, later, with an LLM. It is the **first product surface split out from the main app** (now
**ourobion biotope**): biotope is the consumer ecological-health app; nao is the expert lens on the
knowledge graph that powers biotope's insights.

This doc is the durable design. The brain *contract* it renders lives in [`shared/brain/`](../../../shared/brain/);
how edges are synthesised + verified is [`brain-synthesis-design.md`](brain-synthesis-design.md); how the paper corpus is
acquired is [`brain-ingestion-design.md`](brain-ingestion-design.md); how biotope *consumes* the brain is
[`../biotope/rules-engine-design.md`](../biotope/rules-engine-design.md) and [`../phase-2-plan.md`](../../development/phase-2-plan.md) (Track B/W2).

> **Status (as written 2026-07-26; corrected 2026-08-02).** The contract, R2 corpus,
> synthesis/verification tooling, edge artifacts, deterministic Supabase loader/projection, and nao
> corpus/claims/seed/gap/model/run surfaces exist in the repo. That does **not** prove a production
> deployment: hosted migration parity, real verifier attestation/retrieval, and immutable release
> promotion remain open.
>
> **Corrected:** the 2026-07-26 text also listed *explicit role/RLS enforcement* as open. It landed in
> R4-U2 — `public.nao_members` membership with `viewer`/`curator`/`admin` capability tiers
> ([`20260728010000_nao_staff_roles.sql`](../../../supabase/migrations/20260728010000_nao_staff_roles.sql)),
> enforced in [`apps/nao/src/lib/authz.ts`](../../../apps/nao/src/lib/authz.ts), with negative RLS
> assertions in [`supabase/tests/authz`](../../../supabase/tests/authz).
>
> The referenced `pending-build-register.md` is archived history
> (`docs/archive/runs/run3/pending-build-register.md`) and is **not** a live gap ledger — per
> `AGENTS.md` §7, `docs/archive/` is never an active implementation source. The phasing below explains
> the intended product shape, not a live implementation-status ledger.

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

A clean instance of the repo's core principle ([memory 0001](../../memory/0001-two-tier-truth.md)):

- **TRUTH (never reconstructable):** the **paper corpus** (R2 — metadata + binaries; ingestion design
  §1/§6) and the **canonical `VerifiedEdge` records** — both the machine-made ones (LLM synthesis +
  verification) **and human-curated ones authored in nao**. Human curation is truth: a rebuild must
  never clobber it.
- **DERIVED (rebuildable):** the relational **`verified_edges` view** nao renders (as a client-side
  force-graph projection), and biotope's served insights. `verified_edges` is a *projection* of the
  truth-tier edges — a relational 1-hop lookup over Postgres (no graph DB), rebuilt by the edge loader
  (§4). This is why the served graph is **not** the source of truth — losing it costs only a
  re-projection.

## 3 · Where nao sits (architecture)

- **App:** `apps/nao/` in this monorepo — TypeScript **Next.js (App Router, React)**, deployed as an
  **OpenNext Cloudflare Worker — not Cloudflare Pages** (already on Cloudflare for R2). The build
  target is set by [`open-next.config.ts`](../../../apps/nao/open-next.config.ts) and
  [`wrangler.jsonc`](../../../apps/nao/wrangler.jsonc). A thin **server data layer** (server routes /
  Cloudflare Workers) holds all credentials: **R2 keys and LLM keys are server-side only — never
  shipped in the client bundle.** Work that cannot finish inside a Worker request lifetime is
  dispatched to GitHub Actions instead.
- **Monorepo:** nao is a *sibling* of the Flutter app, which now lives at `apps/biotope/` (the
  `src/ → apps/biotope/` move is done; both apps sit under `apps/`).
- **Shared contracts:** nao imports the brain contract from [`shared/brain/`](../../../shared/brain/)
  (`relationships.ts`, `relationships.schema.ts`, and the gating helpers in `index.ts`) and
  [`shared/types/`](../../../shared/types/) via a repo-root npm workspace
  (`workspaces: ["apps/*","shared","tools/*"]`). **Any change to a `shared/` contract still needs a
  2-reviewer PR** ([memory 0002](../../memory/0002-shared-contract-two-reviewers.md)) — nao consumes the
  contract; it does not fork it.

## 4 · Auth & access

- **Supabase Auth** — the same identity provider as biotope (one account system). nao verifies the
  Supabase JWT in its server layer and enforces a **role** (`viewer` / `curator` / `admin`) for what a
  user may see and write. (Chosen over Cloudflare Access — which would only gate the door — because nao
  wants in-app roles and a path to external users; **not** Firebase, which would add a third cloud.)
- **Hosted Supabase only** for real auth — local Docker can't do OAuth
  ([memory 0011]; biotope's `auth_service` patterns in
  [`apps/biotope/lib/modules/m1_core/impl/auth_service.dart`](../../../apps/biotope/lib/modules/m1_core/impl/auth_service.dart)
  are the reference). The exact public `/` route is a static product explainer with a Login entry;
  legacy `/how-it-works` links redirect to it. Every corpus, data, control, and API surface requires
  an authenticated user with an effective `nao_members` role (the brain is a shared asset, not
  per-user data, so this is access-gating + edit-attribution, not per-row RLS).

## 5 · Data sources & feature phasing

The brain fills in over time, so nao ships in phases. Each phase is gated on the previous.

### v1 — Corpus dashboard *(ships now, R2-backed)*

Reads the paper corpus directly from R2 via a server-side `@aws-sdk/client-s3` client — listing from
`manifest/papers.jsonl`, detail from `meta/<paper_uid>.json` (reuse the keys/layout in
[`tools/brain-ingest/src/storage/r2.ts`](../../../tools/brain-ingest/src/storage/r2.ts); the record shape is
the `PaperRecord` in [`tools/brain-ingest/src/types.ts`](../../../tools/brain-ingest/src/types.ts)).

- **Papers ingested** count; **search** (title / author / `topicTags` / `concepts`); **facets**
  (`oa.status`, `retrievability`, `workType`, year, `metrics.citedByCount`); **per-paper detail**
  (title, authors, venue, OA status + license, journal/ISSN/publisher, citation count, all identifiers).
- Mirrors what `brain-ingest status` reports. **Full text (`text/<uid>.txt`) is never fetched or served.**

### v2 — Graph + evidence *(after the synthesis/verification pipeline + edge store + relational projection)*

A force-directed graph of **servable `VerifiedEdge`s** (nodes = metrics, edges = relations). Click an
edge → an **evidence panel**: the `QuoteSpan.quote` **snippets** (+ `locator`) and the `Citation`s
(each deep-linked to its paper's metadata card via `paperId == paper_uid`), plus **quality markers read
straight from the contract** (§6). *(Pillar 1.)*

### v3 — Secondary ingestion pathway

A curator attaches a paper + metadata directly (writes a `PaperRecord` into the R2 corpus) and/or
authors a relationship by hand → written to the **truth-tier edge store with `provenance:'human'`**, so
a projection rebuild never clobbers it. *(Pillar 2.)*

### v4 — LLM query + modification *(extension)*

Natural-language query over a *retrieved* brain subgraph — constrained so it introduces **no
relationship not in the retrieved set** (the same guardrail as biotope's grounded synthesis,
[`../phase-2-plan.md`](../../development/phase-2-plan.md) W2) — plus LLM-*proposed* edges that require **human approval**
before entering the truth store. *(Pillar 3.)*

### The edge store (v2+)

Canonical `VerifiedEdge`s live in auditable **truth-tier edge artifacts** (R2 JSONL + the
`shared/brain/` contract), each tagged `provenance: 'llm' | 'human' | 'seed'`. A deterministic **edge
loader projects them into the relational Postgres serving tables** (`relationship_claims` +
`edge_verifications`, read through the `verified_edges` view) — a 1-hop lookup (`where subject = $k or
object = $k`), **no graph DB**. nao renders the graph as a **client-side force-graph projection over
`verified_edges`** and reads the **truth store directly** for editing/audit. Rebuilding
`verified_edges` from the truth store is always safe.

## 6 · Evidence & quality markers — reuse the contract, don't reinvent

The brain contract ([`shared/brain/relationships.ts`](../../../shared/brain/relationships.ts)) already
encodes everything nao must display:

- **Snippets** = `QuoteSpan.quote` (verbatim, deterministically presence-checked) + `locator`
  (section/page/figure); tied to `Citation.paperId`, which **equals the corpus `paper_uid`** — so a
  snippet deep-links to its paper's metadata card.
- **Evidence quality** = `Citation.evidenceTier` (1–5: mechanistic → meta-analysis),
  `Citation.impactTier` (venue weight, kept separate from study-design strength),
  `EdgeVerification.confidence` (0..1), `dqs.weight`, `corroboration {supporting, contradicting}`,
  `verdict`, and the rolled-up **`servingBand`** (`high` / `mid` / `hold`) + `needsReview` from
  [`shared/brain/index.ts`](../../../shared/brain/index.ts). nao surfaces these as-is.
- The future **source-reliability grading standard** is an **extension of `impactTier`** — folding in
  corpus metadata already captured (`journal`, `metrics.citedByCount`, `workType`) into a per-source
  reliability score. It does **not** need a new evidence model.

## 7 · Visual design — "bio-neo-mythical"

The brand mark already *is* this thesis: **mythical** (ouroboros — an *open* ring: "the loop of
understanding is never finished", the shared 23-segment/23-crossing ring + coiling serpent every
Ourobion product wears), **bio** (that ring reads as haploid chromosomes woven in a DNA double-helix),
**neo** (bioluminescent teal→blue→violet gradient, fluorescence-microscopy glow). Every Ourobion product
keeps that ring and serpent and changes only the **nucleus** at the centre; nao's nucleus is a
**knowledge graph** — a single bright hub node, four mid nodes radiating out on connecting edges, each
branching again to smaller leaf nodes — intelligence that is *structured*, the orchestration core that
coordinates everything downstream. So nao is biotope's **dark, expert, graph-centric sibling** — biotope
is the warm light *ecosystem*; nao is the deep, glowing *brain*. Tokens and mark files come from the
**Nao identity kit** at [`assets/ourobion-nao-logo/`](../../../assets/ourobion-nao-logo/) (`DESIGN.md` +
`README.md` + `color/colors.css` / `colors.json`) — nao's brand source of truth, distinct from the
master kit at [`assets/ourobion-brand/`](../../../assets/ourobion-brand/) that the shared ring/serpent
construction derives from; the sibling system is
[`../biotope/ui/ui-design-context.md`](../biotope/ui-design-context.md).

- **Palette (Ourobion dark):** background `#0B1D24`; accent ramp **`#2BC4BE` → `#2FB7D6` → `#3FA2E6` →
  `#5E8DF0` → `#7C86F2`**; eyebrow labels `#2BC4BE`; light text on dark. The 23-step coil ramp
  (`color/colors.json`'s `coil_ramp_full_23`) is the **data-viz gradient** (node colour by domain, edge
  colour by relation kind, glow by `edgeScore`).
- **Mark usage — dark is primary:** nao is infrastructure, so **dark on `#0B1D24` or darker** is the
  primary rendering; the **light** variant (teal→blue on white) is only for white/pale surfaces (print,
  embedded docs, a light card dropped onto an otherwise-dark page — see the `.nao-light` /
  `[data-theme="light"]` scope in `theme.css`). The app renders the fixed-**40px**
  `/brand/nao-mark-dark.svg` in the top bar — the kit's documented legibility floor ("the full graph
  holds together to ~40 px") — and the full **vertical lockup** (`/brand/nao-lockup-dark.svg`: mark
  stacked over an `ourobion` kicker and `nao` wordmark) on the login surface, the one screen with room
  for it. Keep clear space of at least the envelope-ring diameter around the mark; **below ~40 px use
  the simplified hub-and-nodes favicon glyph, never the full mark** (the favicon in `<head>` already
  does this).
- **Typography:** the app loads **Outfit** (`next/font/google`, `apps/nao/src/app/layout.tsx`) for both
  UI/body and display/headers, and **JetBrains Mono** for eyebrows, labels, numbers, and identifiers —
  **not** Manrope; Manrope is not loaded anywhere in the app. In the kit's own SVG files the wordmark is
  Outfit outlined to paths, so no font load is needed to render the logo itself. Keep biotope's
  **uppercase, letter-spaced eyebrow** labels.
- **Graph aesthetic:** dark canvas; nodes = glowing cyan orbs (size by connectivity); edges = teal→blue
  gradient strands (thickness/opacity by `confidence`/`edgeScore`; colour/style by `relation` kind);
  **bioluminescent glow on hover/active**. `react-force-graph` (WebGL) or Cytoscape.js are the candidate
  libs — both render arbitrary data, so they fit the "project from the truth tier" model and aren't
  tied to any graph database's own viz.
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

- [`shared/brain/relationships.ts`](../../../shared/brain/relationships.ts),
  [`relationships.schema.ts`](../../../shared/brain/relationships.schema.ts),
  [`index.ts`](../../../shared/brain/index.ts) — edge contract + gating (`edgeScore`, `servingBand`,
  `servableEdges`, `needsReview`).
- [`tools/brain-ingest/src/types.ts`](../../../tools/brain-ingest/src/types.ts) — `PaperRecord` (v1 model).
- [`tools/brain-ingest/src/storage/r2.ts`](../../../tools/brain-ingest/src/storage/r2.ts) — R2 key layout
  (`MANIFEST_KEY`, `metaKey`, `pdfKey`/`jatsKey`/`textKey`) + S3 client setup.
- [`assets/ourobion-nao-logo/`](../../../assets/ourobion-nao-logo/) — the **Nao identity kit**: palette
  (`color/colors.json` / `colors.css`), mark + vertical lockup SVGs (dark + light), and the favicon
  glyph. This is nao's source of truth for brand assets; `apps/nao/public/brand/` is a copy of it.
- [`assets/ourobion-brand/`](../../../assets/ourobion-brand/) — the master kit: palette and logo SVGs for
  the shared open-ouroboros ring + coiling serpent construction every Ourobion product's mark derives
  from (still accurate for that shared system; nao-specific work should use the Nao kit above).

**Implemented foundation:**

- The repo-root package boundary and `apps/nao/` Next.js application.
- R2/D1 corpus reads, Supabase-backed sign-in, corpus/claims/operations surfaces, and the shared UI variables.
- R2 edge artifacts plus the deterministic `tools/edge-loader/` projection into
  `relationship_claims`, `edge_verifications`, and the relational `verified_edges` view.

## 9 · Verification (v1 acceptance)

1. `npm run dev` in `apps/nao`; sign in via the hosted Supabase project as an authorised role.
2. Dashboard lists the R2 corpus; **paper count matches `brain-ingest status`** for the same bucket.
3. Search + facets (oa / topic / type / year / citations) filter correctly against `manifest/papers.jsonl`.
4. Per-paper detail renders metadata; **confirm `text/<uid>.txt` is never fetched/exposed**, and that R2
   credentials are absent from the client bundle (inspect built JS / network tab).
5. `tsc --noEmit` + lint clean; an unauthenticated / under-privileged user cannot load the dashboard.

## 10 · Deferred / open

- **Production brain path** — the synthesis/verifier/loader foundation exists; real verifier
  attestation and retrieval, hosted migration parity, immutable release selection/promotion, rollback,
  and production evidence remain open. See [`brain-synthesis-design.md`](brain-synthesis-design.md).
- **Role and privacy boundary** — ~~explicit viewer/curator/admin membership, direct-write revocation,
  redacted global-job responses, and negative role/RLS tests remain release blockers.~~
  **Resolved in R4-U2 (verified 2026-08-02).** Membership and the viewer/curator/admin tiers ship in
  [`20260728010000_nao_staff_roles.sql`](../../../supabase/migrations/20260728010000_nao_staff_roles.sql);
  redaction grants in [`20260728010002_nao_redaction_grants.sql`](../../../supabase/migrations/20260728010002_nao_redaction_grants.sql);
  negative role/RLS assertions in [`supabase/tests/authz`](../../../supabase/tests/authz) (P-a / P-b / P-c).
  Membership grants **no** cross-user data authority — no per-user table policy was added or widened.
- **Source-reliability grading standard** — **decided**: an `evidenceTier` study-design classifier + an
  `impactTier` venue lookup (SJR + OpenAlex; JCR dropped as paid), per
  [`brain-support-models-design.md`](brain-support-models-design.md). Extends `impactTier` (§6) — no new evidence model.
- **Deployment proof** — exact-tip Cloudflare build/deploy evidence and an environment-matched
  D1/R2/Supabase verification run are still required.
- **External users / richer roles** — Supabase Auth was chosen partly to keep this open.
