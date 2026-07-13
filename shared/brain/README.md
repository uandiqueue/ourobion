# The Brain — relationship contract

`shared/brain/` is the cross-language contract for **the brain**: ourobion's knowledge graph of
scientifically-derived relationships between metrics. Nodes are metric keys (from
[`shared/metrics/registry.ts`](../metrics/registry.ts)); edges are relationships synthesised from the
literature and then independently verified.

See [`docs/nao/brain-synthesis-design.md`](../../docs/nao/brain-synthesis-design.md) for the full design (why a second LLM, the
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
| `relation` | `increases` · `decreases` · `modulates` · `correlates` · `confounds` · `no_effect` (`no_effect` records a studied null) |
| `claimKind` | `causal` · `correlational` · `mechanistic` — the axis synthesis most overstates |
| `evidenceTier` | study-design strength `1` mechanistic … `5` meta-analysis — the brain's analog of metric `reliability` |
| `impactTier` | venue / citation weight, kept **separate** from `evidenceTier` |
| `verdict` | `supported` · `partial` · `unsupported` · `contradicted` · `uncertain` |
| `confidence` | verifier's calibrated belief, 0..1 |
| `dqs.weight` | edge's contribution to graph trust, 0..1 — analog of metric `dqs.weight` |

## Gating (where trust becomes behaviour)

`index.ts` is the single home for gating, kept as pure functions:

- `edgeScore(v)` — rolls `confidence` × evidence-tier × net-corroboration into a 0..1 trust score.
- `servingBand(v)` — `high` (serve plainly) · `mid` (serve with a "limited evidence" qualifier) ·
  `hold` (don't serve). Thresholds in `EDGE_GATES`.
- `isServable(v)` / `servableEdges(edges)` — what the graph may surface, ranked by trust.
- `needsReview(edges)` — `contradicted` edges (suppress + flag the source) and grounded-but-low edges.

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

## Deferred (lands with the first persistence + consumer)

TS-first, like the registry was before its env metrics landed:

- **`relationships.dart` + a `brain-relationships-ts-dart-parity` guard** — when the Flutter app
  renders edges.
- **A `brain-edge-to-schema` guard** — when the graph is persisted to a table/migration.
- **A `brain-endpoint-to-registry` guard** — asserting every edge endpoint resolves to an active
  registry metric (`metrics.isActiveMetric`).

These follow the `couplings.yaml` pattern in [`docs/biotope/metrics-registry-design.md`](../../docs/biotope/metrics-registry-design.md);
they aren't added yet because there's no Dart consumer or DB table to hold honest. See
`docs/nao/brain-synthesis-design.md` → "Guards (deferred)".
