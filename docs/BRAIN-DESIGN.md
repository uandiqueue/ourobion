# The Brain — Design

**The brain** is ourobion's knowledge graph of scientifically-derived relationships between metrics.
Nodes are metric keys ([`shared/metrics/registry.ts`](../shared/metrics/registry.ts)); edges are
relationships ("more X → less Y", "X modulates Y") synthesised from the scientific literature by an
LLM and then independently verified by a second LLM before they can be served.

This doc records *why* the brain is built the way it is. The contract shapes live in
[`shared/brain/`](../shared/brain/); the runbook is [`shared/brain/README.md`](../shared/brain/README.md).

## Why

Insights need a *reason*, not just a correlation in one user's data. The brain is the reusable,
auditable layer of "what relates to what, and how strongly the science backs it" — so M5b can explain
*why* it surfaced a pattern, and so a weak relationship can't quietly drive a strong claim.

But an LLM synthesising relationships from papers is the highest hallucination-surface step in the
whole system. A synthesised edge can be wrong in ways that are individually plausible and collectively
silent:

- **Hallucinated** — an edge no cited paper actually supports.
- **Direction flipped** — A→B asserted where the paper shows B→A.
- **Claim-kind inflated** — a correlation reported as causation (the most common and most damaging).
- **Overgeneralised** — an effect found in a narrow population stated for everyone.
- **Effect-size inflated** — a marginal effect stated as strong.
- **Mis-tiered** — a weak study cited with the authority of a strong one.

A wrong edge is written once and read forever — it propagates into every downstream answer. So the
brain pays its quality cost at **ingestion time**, where it is amortised over every future read.

## The safeguard — a second, independent, adversarial verifier

When the synthesis LLM proposes an edge, a **second LLM verifies it against freshly-retrieved
evidence** before it can be served. The pivotal design decision is *what makes this non-redundant*:

> A second LLM that re-opines over the **same context** with a "does this look right?" prompt is
> mostly theatre — it shares the synthesis model's blind spots and is biased toward agreement. The
> verifier earns its cost **only** when it (a) retrieves evidence **independently** (pulls the cited
> paper + searches for corroborating/contradicting work) and (b) is **adversarial** (prompted to
> refute, defaults to "not supported" when it can't ground the claim).

Those two properties are not left to prompt discipline — they are **schema invariants** in
[`relationships.schema.ts`](../shared/brain/relationships.schema.ts):

- A verdict of `supported` / `contradicted` **requires `independentRetrieval.performed === true`**. No
  independent retrieval ⇒ the verdict can only be `uncertain`. This single invariant is what
  structurally prevents the rubber-stamp failure mode.
- `supported` / `partial` require ≥1 corroborating source; `contradicted` requires ≥1 contradicting
  source.
- Each claim must cite ≥1 source and ground ≥1 verbatim quote span, every span pointing at a cited
  source — so a deterministic, near-free `quoteCheck` runs *before* the verifier LLM (if the cited
  span isn't even in the source, that's a free-caught hallucination).

The verifier does not emit a yes/no gate — it emits **structured evidence metadata** that feeds a
trust score. That is more valuable than a pass/fail and mirrors the registry's `reliability` / `dqs`
philosophy: signal, not a binary.

### The verifier targets the specific failure modes

`EdgeVerification` carries one field per failure mode above — `directionCheck`, `claimKindCheck`
(with the `supportedKind` the evidence actually licenses), `scopeCheck` (claimed vs supported
population), `effectSizeCheck` — so a downgrade is explainable, not a black-box score.

## The two ladders (mirroring `MetricReliability`)

The registry rates *how data was captured* with `reliability: 1|2|3|4`. The brain needs the analog for
*how a relationship was established*, kept on the same shape so it reads familiarly:

- **`evidenceTier: 1|2|3|4|5`** — study-design strength of the strongest supporting source:
  `1` mechanistic/in-vitro · `2` cross-sectional/observational · `3` cohort/longitudinal · `4` RCT ·
  `5` meta-analysis/systematic review.
- **`impactTier: high|moderate|low|preprint`** — venue / citation weight.

These are **deliberately separate**. A high-impact venue can still publish a weak design; collapsing
the two would lose exactly the signal that catches an authoritative-sounding but methodologically weak
claim.

## Gating — where trust becomes behaviour

Trust is a graded score, not a gate. [`shared/brain/index.ts`](../shared/brain/index.ts) is the single
home for it (pure, testable functions):

`edgeScore(v)` rolls `confidence` × evidence-tier × net-corroboration into 0..1, and `servingBand(v)`
buckets it:

| Band | Condition | What the brain does |
|---|---|---|
| `high` | score ≥ `EDGE_GATES.high` (0.8) | serve plainly, "well-supported" |
| `mid` | score ≥ `EDGE_GATES.mid` (0.5) | serve with a "limited evidence" qualifier |
| `hold` | below `mid`, or `uncertain` / `unsupported` | don't serve — re-run or review |
| — | `contradicted` | suppress **and** flag the source for re-scrape (`needsReview`) |

## Cheaper checks that complement the second LLM

The second pass is the backbone, not the only line of defence. These capture much of the value per
dollar and are encoded or recommended:

1. **Quote-grounding (encoded).** Synthesis must emit the verbatim span it relied on; a deterministic
   `quoteCheck` confirms the span exists before the verifier LLM spends a token. Kills the majority of
   hallucinations cheaply.
2. **Cross-paper corroboration (structural).** `corroboration.supporting` — an edge backed by N
   independent papers is intrinsically stronger; not LLM-dependent.
3. **Active contradiction search (adversarial).** The verifier hunts for refuting papers, not just
   confirming ones — the highest-value, least-done check.
4. **Tiered spend (operational).** Full independent-retrieval verification on high-impact or
   low-corroboration edges; the cheap `quoteCheck` alone for the rest. Apply the same impact-tier
   triage the product already uses to the *verification budget*.

## Two-tier truth

This is a clean instance of the repo's core principle
([memory 0001](memory/0001-two-tier-truth.md)):

- **TRUTH** — the *contract* (`shared/brain/relationships.ts`): git-tracked, 2-reviewer
  ([memory 0002](memory/0002-shared-contract-two-reviewers.md)).
- **DERIVED / rebuildable** — the *instances* (claims + verifications) and the stored graph. Never
  hand-edit a verdict; to change one, fix the input (paper corpus, synthesis/verifier prompt — bump
  `promptVersion`) and re-run. Re-running verification with a better verifier later is legitimate
  *because* it's a projection.

## Guards (deferred)

The brain is **TS-first** — its ingestion/synthesis pipeline is backend/tooling, and the graph isn't
persisted or app-rendered yet. So, exactly as the registry deferred its env metrics, the cross-seam
guards land with their first real consumer rather than as empty placeholders:

| Guard (future `couplings.yaml` edge) | Lands when |
|---|---|
| `brain-relationships-ts-dart-parity` | the Flutter app renders edges (add `relationships.dart`) |
| `brain-edge-to-schema` | the graph is persisted to a table/migration |
| `brain-endpoint-to-registry` | first persistence — every endpoint resolves to an active registry metric (`metrics.isActiveMetric`) |

Today's guard is the in-file `AssertExact<>` (compile-time, via `tsc`) plus the runtime zod schemas —
self-contained and honest for a TS-only contract. Adding `couplings.yaml` edges now would mean
shipping placeholder guard files with nothing real to assert, which the enforcement model
([`docs/graph/couplings.yaml`](graph/couplings.yaml) header) treats as a smell.

## Alternatives considered

- **No second pass (synthesis-only + quote-grounding).** Cheapest. Catches hallucination via
  `quoteCheck` but not direction flips, claim-kind inflation, or overgeneralisation — the errors that
  survive a single model's priors. Rejected as the *default* for served edges; acceptable as the
  tiered fallback for low-impact edges.
- **Self-consistency (same model, re-ask, vote).** Catches stochastic one-off errors but not the
  systematic ones (shared priors → correlated mistakes). Rejected as the primary safeguard; the
  independent-retrieval invariant is precisely what this lacks.
- **Human-in-the-loop on every edge.** Highest precision, doesn't scale to a literature corpus.
  Retained only for the `needsReview` set (contradicted / grounded-but-low), where volume is small.

## Open decisions

1. **Verifier model choice** — same family as synthesis (cheaper, simpler) vs a different model
   (better error decorrelation). Recommendation: different model or at least different prompt framing;
   decorrelation is the whole point.
2. **Persistence** — a Supabase table vs a rebuildable generated artifact under the (deferred)
   structural-graph location. Recommendation: table, once M5b consumes edges; until then, a generated
   file is enough.
3. **Re-verification cadence** — on `promptVersion` bump only, vs periodic re-runs as the corpus
   grows. Recommendation: on bump + on new corroborating/contradicting source for an existing edge.
