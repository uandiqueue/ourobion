# The Brain — relationship contract

**Runbook only; rationale in [`docs/implemented/nao/brain-synthesis-design.md`](../../docs/implemented/nao/brain-synthesis-design.md), stages in [`docs/implemented/shared/insight-engine-architecture.md`](../../docs/implemented/shared/insight-engine-architecture.md).**

`shared/brain/` is the cross-language contract for **the brain**: ourobion's knowledge graph of
scientifically-derived relationships between metrics. Nodes are metric keys (from
[`shared/metrics/registry.ts`](../metrics/registry.ts)); edges are relationships synthesised from the
literature and then independently verified.

See [`docs/implemented/nao/brain-synthesis-design.md`](../../docs/implemented/nao/brain-synthesis-design.md) for the full design (why a second LLM, the
evidence ladder, gating, the two-tier placement).

## Two records, two LLM passes

An edge is produced in two passes, kept as two records so verification can be re-run without
re-synthesising:

| Pass | Record | Produced by | What it is |
|---|---|---|---|
| 1. Synthesis | `RelationshipClaim` | an LLM reading papers | the proposed edge + its citations + grounding quote spans |
| 2. Verification | `EdgeVerification` | a **second, independent** LLM | an adversarial, evidence-grounded re-check that feeds gating |

The two join into a `VerifiedEdge` — the servable unit of the graph.

## Why the second pass isn't redundant

Synthesis is generative (high hallucination surface); verification is discriminative and grounded (a
narrow, checkable task). A second pass only earns its cost when it is **independent** and
**adversarial** — so those two properties are enforced as schema invariants, not left to prompt
discipline:

- A verdict of `supported` / `contradicted` **requires `independentRetrieval.performed === true`** —
  re-opining over the synthesis context (no fresh retrieval) can only ever be `uncertain`. This is
  the invariant that stops the verifier being a rubber stamp.
- `supported` / `partial` require ≥1 corroborating source; `contradicted` requires ≥1 contradicting
  source.
- A claim must cite ≥1 source and ground ≥1 verbatim quote span, and every span must point at a
  cited source — so a near-free deterministic `quoteCheck` can run *before* the verifier LLM.

## Field reference

The authoritative shapes are in [`relationships.ts`](./relationships.ts). Highlights:

| Field | Meaning |
|---|---|
| `edgeId` | deterministic `${subject}\|${relation}\|${object}` (see `index.relationKey`) — re-runs update the same edge |
| `derivation` | the synthesis node's plain-language reasoning trace — how the quoted sentences produce the claim; captured at synthesis time (never regenerated on view), copy-gated before storage |
| `Citation.population` | per-paper studied population, verbatim, when stated — distinct from the claim-level `population` (the claimed scope); U1 applicability-grader input |
| `charStart` / `charEnd` | a `QuoteSpan`'s offsets into the source's canonical extracted text (`null` when unknown) — makes the deterministic quote check exact |
| `relation` | `increases` · `decreases` · `modulates` · `correlates` · `confounds` · `no_effect` (`no_effect` records a studied null) |
| `claimKind` | `causal` · `correlational` · `mechanistic` — the axis synthesis most overstates |
| `evidenceTier` | study-design strength `1` mechanistic … `5` meta-analysis — the brain's analog of metric `reliability` |
| `impactTier` | venue / citation weight, kept **separate** from `evidenceTier` |
| `verdict` | `supported` · `partial` · `unsupported` · `contradicted` · `uncertain` |
| `confidence` | verifier's calibrated belief, 0..1 |
| `dqs.weight` | edge's contribution to graph trust, 0..1 — analog of metric `dqs.weight` |

## Gating (where trust becomes behaviour)

`index.ts` is the single home for gating, kept as pure functions. **Since C15 the RANK and the
SERVING DECISION are separate** (`docs/development/run4/config-decisions.md` C15):

- `singlePaperGate(v)` — **the serving decision.** Asks only whether the claim faithfully
  represents the paper it cites: verdict relevance, the deterministic quote gate, and
  direction / claim-kind / effect-size matching, then a `confidence` floor. Returns the band plus
  named `failures`. Config: `SINGLE_PAPER_GATE`.
- `edgeScore(v)` — rolls `confidence` × study-design tier × net-corroboration into a 0..1
  composite. **A rank only — it no longer gates.**
- `servingBand(v)` — `high` (serve plainly) · `mid` (serve with a "limited evidence" qualifier) ·
  `hold` (don't serve). Thin reader of `singlePaperGate`; floors in `EDGE_GATES` read against
  `confidence`.
- `isServable(v)` / `servableEdges(edges)` — what the graph may surface, ranked by `edgeScore`.
- `needsReview(edges)` — `contradicted` edges (suppress + flag the source) and grounded-but-held edges.

**A card can be served on the strength of a single paper.** Corroboration, study-design tier, venue
impact tier and the other-paper `scopeCheck` are still computed, stored and ranked on, but they
cannot withhold a card (`SINGLE_PAPER_GATE.nonGatingSignals`). The risk that the one paper is wrong
or unreplicated reaches the user through `EdgeVerification.caveat` (#300 §E) — that caveat is now
the **only** mechanism carrying it.

## Two-tier truth

The **contract** (`relationships.ts`) is TRUTH — git-tracked, 2-reviewer
([memory 0002](../../docs/memory/0002-shared-contract-two-reviewers.md)). The **instances** (claims +
verifications) are a **rebuildable projection** ([memory 0001](../../docs/memory/0001-two-tier-truth.md)):
never hand-edit a verdict — to change one, fix the input (paper corpus, synthesis/verifier prompt —
bump `promptVersion`) and re-run the job.

## Drift guard

`relationships.schema.ts` mirrors the registry's pattern: a zod schema validates each record at
runtime (the jobs `validateClaim` / `validateVerification` their own output before persisting), and a
compile-time `AssertExact<>` fails `tsc` if the hand-written interfaces and the zod-inferred types
drift apart.

## Guards and remaining parity

- **Landed:** `brain-edge-schema` couples the relationship contract to the
  `relationship_claims`/`edge_verifications` migration through
  `tools/edge-loader/tests/edge_table_schema.test.ts`.
- **Landed:** `brain-endpoints-metrics-registry` asserts every edge endpoint resolves to an active
  registry metric through `tools/edge-loader/tests/edge_endpoints_registry.test.ts`.
- **Still deferred:** `relationships.dart` plus TS↔Dart parity, because Flutter consumes the
  provenance/card RPC shape rather than mirroring the full authoring contract today. Add the mirror
  only when a real Dart consumer needs it.

The executable coupling declarations live in
[`docs/graph/couplings.yaml`](../../docs/graph/couplings.yaml). See the broader guard design in
[`docs/implemented/nao/brain-synthesis-design.md`](../../docs/implemented/nao/brain-synthesis-design.md).
