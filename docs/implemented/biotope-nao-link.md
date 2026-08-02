---
title: biotope ↔ nao Runtime Link
summary: The seam view of how biotope (consumer app) and nao (brain curation surface) connect at runtime — they never call each other; everything is shared indirectly via Supabase identity, shared/ code contracts, and the verified_edges Postgres view. Agents read this to understand the app-to-brain boundary; stage detail lives in insight-engine-architecture.md.
type: architecture
scope: shared
status: canonical
updated: 2026-07-26
---

# biotope ↔ nao — the runtime link

> **Status: authoritative ground truth (cross-app).** How **biotope** (the consumer app) and **nao**
> (the brain's curation/ingestion surface) actually connect at runtime. The full 23-stage design lives
> in [`insight-engine-architecture.md`](insight-engine-architecture.md); the brain's synthesis +
> verification pipeline is [`../nao/brain-synthesis-design.md`](nao/brain-synthesis-design.md); the front of the paper
> pipeline is [`../nao/brain-ingestion-design.md`](nao/brain-ingestion-design.md); the deterministic
> serve engine is [`../biotope/rules-engine-design.md`](biotope/rules-engine-design.md). This
> doc is the *seam* view — it does not repeat those.
>
> **Supersedes** the earlier `docs/biotope-nao-link.md` draft (branch `docs/biotope-nao-link-plan`),
> which projected the served graph into **Neo4j Aura**. There is **no graph database** — the served
> graph is a 1-hop lookup over the relational `verified_edges` view (architecture §S6, decision P27).

## 1 · The headline fact: there is no app-to-app link

biotope and nao **never call each other**. No shared API, no cross-app navigation, no direct network
path. Everything they share is indirect, through three things:

1. **Shared identity** — one Supabase Auth project. biotope gates per-user (RLS on personal rows).
   nao's product contract requires `viewer`/`curator`/`admin`, but the current middleware enforces
   authentication only; explicit membership/role enforcement and negative RLS tests remain the O25 /
   B-SEC1 production blocker in the
   `pending-build-register` (`docs/archive/runs/run3/pending-build-register.md`, archived). Never infer authorization from
   the current route existing.
2. **Shared code contracts** — both import `shared/brain/` (the `RelationshipClaim`/`EdgeVerification`
   types + `edgeScore`/`servingBand` gating) and `shared/metrics/` via the repo-root npm workspace.
   Either app changing these needs a 2-reviewer PR.
3. **A shared data layer they each touch independently** — the brain's serving surface is the Postgres
   `verified_edges` view (`relationship_claims` ⨝ newest active `edge_verifications`, architecture §S6).
   **nao writes to it** (via the R2→Postgres edge loader, §A11); **biotope only reads from it**, at one
   place (§3). Neither app is aware the other exists at request time.

## 2 · Where cross-metric relationships get decided (offline, not at request time)

The served graph is **read** during insight composition, but relationships are **authored offline**.
biotope's deterministic engine never issues a live query to discover a relationship mid-evaluation —
that would break the two-tier-truth invariant (the serve path is pure functions + table reads, no
authoring-time IO). Instead:

- The offline authoring pipeline (§A1–A11) synthesises and adversarially verifies each metric→metric
  edge from papers, and the loader projects the survivors into `verified_edges`.
- At serve time the composer (§S7) does a **1-hop join**: for a fired single-metric pattern it looks up
  that metric's servable neighbours in `verified_edges` and attaches their citations. Pure SQL
  (`where subject = $k or object = $k`, two btree indexes) — no traversal engine, no graph DB.

So the brain informs *what is served alongside a pattern*, not *what the engine evaluates*.

## 3 · The one live read path: the composer + presentation phrasing

Per the architecture, biotope's only runtime consumer of the brain is the composer (§S7) plus the
cached card phrasing (§S8).

**Worked example.** A user's HRV has trended above *their own* personal baseline (§S3, never a fixed
absolute, never cross-user) for several days. §S4 fires a `signal` pattern on `hrv_ms` — the brain
plays no part in *detecting* this (it only holds population-level relationships, never any individual's
readings). The composer (§S7) then joins that fired pattern to the **1-hop servable edges** for
`hrv_ms` in `verified_edges`, checks the user's own D2 personal signal (§S5), and classifies a branch:

- **`agree`** (servable edge, personal null-or-consistent) → a **cited card** (§S8), phrased by the
  cached Claude Haiku 4.5 presentation step, e.g. *"Your HRV has stayed above your usual range this
  week — research links this pattern to changes in recovery load,"* with the quote spans + citations +
  evidence tier behind the source button.
- **`idiosyncratic`** (stable personal signal, no servable edge) → a distinct, clearly-labelled **"still
  researching this" card** (uncited, `producer='personal'`, no citation) AND a gap-ledger event.
- **`research-context` / `contradiction`** → gap-ledger events only (not surfaced).

If no servable edge for `hrv_ms` exists, the card still renders with its plain deterministic template —
missing brain data silently no-ops, it never blocks a card (same posture as
[wearable sync best-effort](../memory/0006-wearable-sync-best-effort.md)).

**Grounding + gate.** The phrasing prompt contains only the composed-insight payload; it introduces no
number or relation not in the input, is cached per `insight_id` (fire-triggered, not per-render), and
passes `validateCopyString` ([non-diagnostic copy](../memory/0003-non-diagnostic-copy.md)) before
storage. Server-side only; keys never reach the client.

## 4 · Edge selection & trust gating at the seam

Before any edge becomes user-visible the seam has to answer two questions: *how strongly* an edge is
trusted enough to serve, and *which* of a metric's servable neighbours a card actually mentions. Both are
settled by the **shared `shared/brain/` contract**, called identically on both sides of the seam — nao's
curator UI and biotope's composer use the same `edgeScore` / `servingBand` / `servableEdges` /
`needsReview` functions, so biotope can never surface an edge nao's own reviewers would treat as
not-ready. The grading math (weights, thresholds, tiers) is owned by
[`insight-engine-architecture.md`](insight-engine-architecture.md) §S6 + the hyperparameter registry (§9)
and `shared/brain/index.ts`; this section records only the *seam consequences*, not those stage defs.

### 4.1 · Trust grading is one shared gate, not a biotope-side decision

Every edge carries a rolled-up 0–1 `edgeScore` — verifier confidence, shaded by study-design
`evidenceTier` and net *independent-root* corroboration (composition + weights owned by architecture §S6
/ §9, `index.ts:40-48`). `servingBand()` buckets that score:

- **`high`** — serve plainly (a cited card, §3 `agree`).
- **`mid`** — serve with a "limited evidence" qualifier.
- **`hold`** — never served, on either side.

biotope's composer joins **only servable edges** (`servableEdges()` = `status='active'` ∧ band ≠ `hold`,
`index.ts:61`) — the same predicate nao's UI uses to decide an edge is presentable. Notability
(`impactTier`, venue weight) is deliberately **excluded** from `edgeScore` (architecture invariant 4), so
a top-venue paper running a weak design still lands in a low band. There is therefore no second,
biotope-side trust judgement: biotope inherits nao's grade verbatim. Contradicted / grounded-but-low
edges are the inverse — `needsReview()` (`index.ts:75-81`) suppresses them and routes them to a curator;
they are never a serve candidate regardless of any other score (architecture §S7 `contradiction` branch).

### 4.2 · Edge selection: which neighbour a card actually mentions

As the brain grows a single metric can accrue several servable neighbours at once. A card states one
clear claim, not a pile — and the phrasing LLM never arbitrates which. Selection is deterministic, ahead
of phrasing:

1. **Relation-kind filter (serve-time).** `no_effect` (a studied null, kept in the store only so the dead
   edge isn't re-proposed) and `confounds` (a data-quality caveat about some *other* relationship, not an
   "X→Y" claim) are excluded from surfacing outright, regardless of `edgeScore`. This is stricter than the
   servable-verdict gate: such an edge can be `active` and well-graded yet still must not reach a card.
2. **Direction eligibility.** Only monotonic relations (`increases|decreases`) may set a card's
   direction; `modulates|correlates` edges attach as **context-only citations**, never a directional
   claim (architecture invariant 3 / §S7).
3. **Rank + cap.** Servable edges are ordered by `edgeScore` desc (`servableEdges()`, `index.ts:68`); the
   composer surfaces the **single top directional edge** for the fired metric, not the whole 1-hop pool. A
   fired pattern is single-metric (`FiredPattern.metricKey`, architecture §S4) — cross-metric relations
   live in the edge, not the pattern — so a card carries one primary relationship plus any context-only
   citations. (The 1-hop neighbour cap N per metric is still an open tuning knob, §7.)

### 4.3 · Direction is phrased against the user's own movement

Whether a relationship exists and which way it runs is fixed at verification time — never guessed at
serve time. The one thing the seam resolves per fire: a monotonic edge is phrased against **which way
this user's metric actually moved**. The composer already carries this as
`direction: 'consistent'|'inconsistent'` (`sign(edge.relation)` vs `pattern.state`, architecture §S7
`ComposedInsight.edges[]`), so the *same* stored edge phrases oppositely for a metric that rose vs. one
that fell — same edge, opposite copy, because the observed movement was opposite. `modulates|correlates`
are phrased without asserting a direction ("this pattern is linked to…"), consistent with their
context-only role above.

## 5 · Who writes a relationship, and how it reaches biotope

`verified_edges` has **three writers**, distinguished by `RelationshipClaim.provenance`. nao is only one,
and not the expected majority — full detail in [`../nao/brain-synthesis-design.md`](nao/brain-synthesis-design.md):

1. **`provenance:'llm'` — the automated pipeline, doesn't touch nao's UI.** A seeder/queue picks a pair;
   a synthesis LLM proposes a claim (§A8); a **second, decorrelated non-Anthropic** adversarial verifier
   re-grounds it with its own retrieval (§A10) before it can leave `uncertain`
   ([adversarial edge verification](../memory/0012-brain-adversarial-edge-verification.md)). Expected
   majority over time.
2. **`provenance:'human'` — a curator working in nao.** Attaches a paper or approves a proposed edge
   before it's trusted (nao's real write role — a check layer, not the primary source).
3. **`provenance:'seed'` — hand-authored priors**, bootstrapped once from the metric registry's
   `derivedFrom[]`, so the brain isn't empty before any pipeline run or curation.

Whichever path writes it, the same asynchronous route reaches biotope — **no push/webhook**, no "edge
changed" notification:

```
 pipeline (llm) writes R2 edge artifacts ┐
 nao curator (human) edits               ├──► R2 edges/*.jsonl
 hand-seeded (seed)                       ┘            │
                                                       ▼
                          nao edge loader (§A11): R2 → Postgres, precomputes edge_score/serving_band
                                                       ▼
                                          verified_edges view (truth, §S6) updated
                                                       ▼
                    (next time a matching pattern fires) → composer §S7 joins it → §3
```

A newly-written edge simply becomes visible the next time a card fires whose pattern metric matches it,
once the loader has run. No Neo4j projection step exists.

## 6 · The reverse direction: biotope feeding the brain what it's missing

The brain does not only grow from papers researchers happen to pick — one research-query source is what
biotope users actually need. This is the **gap ledger** (§A1), not an ad-hoc table:

- Every time the composer (§S7) fires a pattern that finds **no servable edge** (or only below-band
  edges), it writes a gap event (`personal-signal-no-edge`, `lit-candidate-no-edge`, `edge-below-band`)
  to `gap_ledger`. One cheap write beside an already-cheap read; no LLM call on the serve path.
- The ledger's `demand` counter is **aggregate only — never any per-user identifier** (privacy: it is a
  demand signal, not user data, so it needs no RLS/consent handling).
- The queue builder (§A3) ranks ledger rows by `f(personalSignal, litCandidate, demand, servability-gain)`,
  turns each into targeted queries (§A2 term map), and dispatches an ingest run over the existing R2
  control plane + GitHub Actions (`apps/nao/src/lib/githubDispatch.ts`). The pipeline researches the
  gap; the loader (§A11) lands any new edge; the next report surfaces it with a novelty boost.

**No live notification back.** If the pipeline later produces a verified edge for a previously-missing
pair, biotope isn't told — the live lookup that used to come up empty simply succeeds next time a
matching pattern fires. Same asynchronous, no-push posture as everything else here.

## 7 · Settled vs. open

**Settled (was open in the Neo4j draft):** the serving store is the relational `verified_edges` view,
not Neo4j (no Bolt driver / Aura connectivity question); evidence for the phrasing prompt is read from
the composed-insight payload (edge citations carried through §S7), not denormalised graph properties;
the "reverse direction" is the `gap_ledger`, not a bespoke `insight_needs` table; cache lifecycle =
regenerate phrasing on the `insight_id` card upsert.

**Open (confirm at implementation):** the loader trigger cadence (cron vs. dispatch-callback, §A11);
the 1-hop neighbour cap per metric at serve time (starting guess, tune once real edges exist); the
completeness-disclaimer roll-up copy. Tracked in the hyperparameter registry
([architecture §9](insight-engine-architecture.md)).
