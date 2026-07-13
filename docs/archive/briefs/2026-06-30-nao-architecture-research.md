> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [phase-2-plan.md](../../shared/phase-2-plan.md).

# nao — architecture research & options brief (2026-06-30)

**Audience:** stakeholders deciding how to build **ourobion nao** (the brain-inspection web app).
**Question this brief answers:** are the architecture decisions in the nao plan (see
[`../nao/NAO-DESIGN.md`](../../nao/NAO-DESIGN.md)) sound, or are there better ways — and which stack fits
which end-goal? **Method:** current-best-practice web research, mid-2026 (sources at the end). This is a
decision aid, not a commitment; nothing here changes the two-tier-truth rule (R2 stays canonical).

> **Recap of what nao is:** a dark, expert "window into the brain" — query/visualise the
> metric-relationship graph, inspect evidence behind each edge, and curate it. **v1 = a paper-corpus
> dashboard** (the brain has no edges yet — the synthesis/verification pipeline is unbuilt).

---

## 1 · Verdict at a glance

| Decision (current plan) | Verdict | Better / refined option |
|---|---|---|
| Framework: **Next.js** | ✅ Keep | Fine for a dashboard; only the *deploy adapter* changes |
| Host: **Cloudflare Pages** | 🔁 **Refine** | **OpenNext → Cloudflare Workers** (`next-on-pages` is deprecated) |
| R2 access: **`@aws-sdk/client-s3`** | 🔁 **Refine** | **Native R2 binding** (`env.BUCKET.get`) — no credentials, ~100× faster |
| Search: **parse `papers.jsonl` per request** | 🔁 **Refine** | **Index into D1 + FTS5** (a rebuildable index) — <50 ms search/facets |
| Auth: **Supabase Auth** | ✅ Keep | Verify at edge with **`jose` + JWKS**; roles via **Custom Access Token Hook** |
| Brain store: **Neo4j Aura Free (projection)** | ⚠️ **Reconsider** | **JSON-artifact-first**; if a graph DB is needed, **Neo4j Community self-host** — *never Aura Free* |
| Graph viz: **react-force-graph / Cytoscape** | 🔁 **Refine** | **Sigma.js v3** (WebGL, custom glow, DB-agnostic) |
| Placement: **`apps/nao/` monorepo** | ✅ Keep | Add the concrete shared-types wiring (workspaces + `transpilePackages`) |
| v1 scope: **corpus dashboard only** | ✅ Keep | Correct — ships value without waiting on the brain |
| Two-tier truth | ✅ Keep | All of D1 / JSON-artifact / Neo4j are *derived projections* |

**Bottom line:** the *shape* of the plan is sound. Three things are worth changing before any code:
the **deploy target** (OpenNext/Workers), the **search layer** (D1, not per-request JSON parsing), and
the **graph store** (don't depend on Neo4j Aura Free). Each is a derived/infra choice — none disturbs the
data model.

---

## 2 · Decision-by-decision evaluation

### 2.1 Hosting & framework — 🔁 refine the adapter
**Current:** Next.js on Cloudflare Pages. **Finding:** `@cloudflare/next-on-pages` is **deprecated**; the
supported path is **OpenNext (`@opennextjs/cloudflare`) → Cloudflare Workers** (full Node compatibility,
ISR, Next 16). Next.js itself remains a good fit for a faceted dashboard (lighter options — SvelteKit,
Astro, plain Vite+React — don't pay off here; Astro is static-first). **Do:** build for OpenNext/Workers
from day one.

### 2.2 R2 access — 🔁 use the native binding
**Current:** `@aws-sdk/client-s3` server-side, "keep creds out of the bundle." **Finding:** on Workers,
the **native R2 binding** (`env.BUCKET.get(key)`) needs **zero credentials**, is ~100× lower latency, and
is far simpler — it *eliminates* the credential-leak risk rather than mitigating it. The S3 SDK stays
only in the brain-ingest **tool** (runs on Node, off-Cloudflare). **Do:** native binding for nao.

### 2.3 Search/data serving — 🔁 index, don't scan
**Current:** read `manifest/papers.jsonl` from R2 each request. **Finding:** parsing the whole manifest
per request is ~60–110 ms + wasted CPU and gives no real search or facets. **Index the manifest into
Cloudflare D1 (SQLite) + FTS5** — a *derived index rebuilt from R2* → **<50 ms** keyword + faceted
queries on the free tier. Graduate to **Vectorize** only when semantic "papers like this" is wanted.
**Do:** D1 + FTS5 for v1 search; R2 remains canonical.

### 2.4 Auth — ✅ keep Supabase, modernise the verification
**Current:** Supabase Auth; role via `app_metadata` or a table. **Finding:** Supabase now uses
**asymmetric ES256 signing keys + a JWKS endpoint** — verify the token **at the edge with `jose` +
`createRemoteJWKSet`** (no round-trip), and read a **`user_role` claim added by a Custom Access Token
Hook** (preferred over `app_metadata`, which doesn't auto-sync). Use `@supabase/ssr` `getClaims()`.
⚠️ **Migrate to the new signing keys; legacy `sb_anon`/`sb_service_role` keys expire end-2026.**

### 2.5 Brain store — ⚠️ the one to reconsider
**Current:** "Neo4j as a projection; Aura Free." **Finding:** **Neo4j Aura Free auto-pauses after 72 h
idle and is deleted after ~90 days idle** — a real data-loss trap for a low-traffic internal tool. And at
nao's scale (**hundreds–low-thousands of edges**) a dedicated graph DB is arguably unnecessary:
- **JSON graph artifact** (rebuilt from the truth-tier edges, served from R2/D1, loaded client-side) —
  zero graph-DB ops; great up to a few thousand edges. **Recommended first step.**
- **Postgres** (you already run Supabase) — fine for shallow lookups; recursive CTEs get slow for deep
  multi-hop traversal.
- **Neo4j Community (self-hosted)** or **Memgraph** — only when deep traversal at real scale pays off;
  **self-host, not Aura Free.**
Your *"Neo4j-as-projection"* decision still holds — the projection just starts as a **file**, which also
matches BRAIN-DESIGN's own "generated artifact vs table" open decision.

### 2.6 Graph visualisation — 🔁 Sigma.js v3
**Current:** react-force-graph or Cytoscape. **Finding:** **Sigma.js v3** (WebGL, `@react-sigma`, custom
`NodeProgram`/`EdgeProgram` + `@sigma/layer-webgl`) is the best fit for a performant, **DB-agnostic**,
dark graph with custom **bioluminescent glow**; it renders the JSON-artifact projection directly. Cytoscape
is canvas-only (slower at scale); react-force-graph is simpler but less customisable; Neo4j NVL is coupled
to Neo4j.

### 2.7 Monorepo shared types — ✅ keep, wire it concretely
`shared/brain/*.ts` is already consumed by **Deno** (Supabase fns) + **Node** (tools). Adding nao (a
bundler) → export `.ts` **directly (no build)**, list the shared pkg in Next's **`transpilePackages`**, and
give Deno an **import map with explicit `.ts` extensions**. One source of truth.

---

## 3 · Plans for different end-goals

Pick the column that matches the goal; rows are the stack choices.

| | **A. Fastest demo / least effort** | **B. Lowest ops & cost (recommended for v1)** | **C. Future-proof / scale & external users** |
|---|---|---|---|
| **Best when** | "Show a corpus dashboard this week" | Internal tool, small team, minimal moving parts | Many edges, semantic search, public/org users |
| **Host** | Next.js + Vercel (or Pages) | **OpenNext → CF Workers** | OpenNext → CF Workers |
| **Corpus read** | parse `papers.jsonl` (accept the cost) | **R2 binding + D1/FTS5 index** | R2 binding + D1, **+ Vectorize** (semantic) |
| **Auth** | Supabase Auth (simple gate) | Supabase Auth + edge JWKS + role hook | Same + org/SSO, finer RBAC |
| **Brain graph** | none yet (dashboard only) | **JSON artifact → Sigma.js** | Neo4j **Community self-host** / Memgraph → Sigma.js |
| **Effort** | hours | ~1–2 days for v1 dashboard | weeks (gated on the synthesis pipeline) |
| **Cost** | free–$ | **all free tier** | low → moderate (a VM for the graph DB) |
| **Risk** | per-request CPU waste; rework later | minimal | most infra to operate |

**Recommendation:** **Plan B** for v1 — it's the all-Cloudflare-free-tier path (OpenNext/Workers + R2
binding + D1/FTS5 + Supabase Auth), has **no secrets in the app** and **no idle-deletion trap**, and it
upgrades cleanly toward Plan C (add Vectorize, swap the JSON artifact for a self-hosted graph DB) **only
when the brain's scale demands it**. Plan A only makes sense if a throwaway demo is needed before the
real build.

---

## 4 · Risks & caveats

- **The real critical path is the brain itself** — nao's graph/evidence features (v2+) are blocked on the
  unbuilt **synthesis + verification pipeline** (Track B), not on nao's stack. v1 (dashboard) is
  independent and shippable now.
- **Supabase key migration** (asymmetric signing keys; legacy API-key expiry end-2026) should be done
  regardless of nao.
- **D1 and the JSON artifact are derived** — both must be rebuildable from R2 / the truth-tier edge store;
  treat them as caches, never sources of truth.
- **OpenNext maturity** — verify the current OpenNext + Next version pairing before committing (it tracks
  Next releases closely).

---

## 5 · Sources (mid-2026)

- OpenNext Cloudflare adapter — https://opennext.js.org/cloudflare ; CF Next guide — https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- R2 Workers API (native bindings) — https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- Cloudflare D1 — https://developers.cloudflare.com/d1/ ; Vectorize — https://developers.cloudflare.com/vectorize/
- Supabase JWT signing keys — https://supabase.com/blog/jwt-signing-keys ; Custom Access Token Hook — https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Neo4j Aura pause/auto-delete policy — https://support.neo4j.com/s/article/17480821630355--Aura-Instance-Access-Issues-Understanding-Pausing-Resuming-and-Auto-Delete-Policy
- Sigma.js customization — https://www.sigmajs.org/docs/advanced/customization/
- Deno workspaces — https://deno.com/blog/v1.45
</content>
