# Session 20260625T030745Z — uandiqueue — claude — brain-relationship-contract

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** feat/shared/metric-platform-w0
- **Type:** Foundation — the brain's relationship contract + the second-LLM verification safeguard, with docs.

## Attempted
Lay the shared contract for **the brain** (biotope's knowledge graph of scientifically-derived metric
relationships) ahead of its ingestion pipeline, and answer the standing design question: *should a
second LLM verify each synthesised edge?* Conclusion — useful, not redundant, **iff** the verifier is
independent (own retrieval) and adversarial; encode those properties as schema invariants rather than
prose. Shape-locked now so M5b isn't rewritten when it consumes edges (same move as env_daily).

## Changed
- **New contract `shared/brain/`** (TS-first, mirroring `shared/metrics`):
  - `relationships.ts` — `RelationshipClaim` (synthesis output) + `EdgeVerification` (verifier output)
    + `VerifiedEdge`; `RelationKind`, `ClaimKind`, `Verdict`, `EvidenceTier` (1–5, analog of metric
    `reliability`), `ImpactTier` (kept separate), `Citation`, `QuoteSpan`.
  - `relationships.schema.ts` — zod schemas + `AssertExact<>` (4 interfaces) + `validateClaim` /
    `validateVerification`. superRefine encodes the safeguard: `supported`/`contradicted` ⇒
    `independentRetrieval.performed`; `supported`/`partial` ⇒ ≥1 corroborating source; `contradicted`
    ⇒ ≥1 contradicting; claim ⇒ ≥1 citation + ≥1 grounded quote span; `edgeId` == `relationKey`;
    no self-loops; quoteCheck arithmetic consistent.
  - `index.ts` — `relationKey`, `edgeScore` (confidence × evidenceTier × net-corroboration),
    `servingBand` (high/mid/hold, `EDGE_GATES`), `isServable`, `servableEdges`, `needsReview`.
  - `README.md` — contract + the "why the second pass isn't redundant" runbook.
- **Design doc `docs/BRAIN-DESIGN.md`** — failure modes, the safeguard rationale, the two ladders,
  the gating table, cheaper complementary checks (quote-grounding/corroboration/contradiction-search/
  tiered spend), two-tier placement, **deferred guards**, alternatives, open decisions.
- **Repo context wired:** `AGENTS.md` §2 (brain edges as a derived projection) + §3 (contract pointer);
  `shared/SHARED-CONTEXT.md` (new RelationshipClaim/EdgeVerification section + header bump);
  `docs/memory/0012-brain-adversarial-edge-verification.md` + index.
- **README** — factual "🧬 The brain" section (design + engineering, no marketing) + doc pointer.

## Decided
- **Second-LLM verification is worth it — but only grounded + adversarial.** Same-model re-opining
  shares blind spots and rubber-stamps; the value is in independent retrieval. Encoded as the
  `independentRetrieval ⇒ verdict` invariant, not left to the prompt.
- **Trust is a graded `edgeScore`, not a yes/no gate** — verification feeds confidence/tier, mirroring
  the registry's `reliability`/`dqs` philosophy.
- **`evidenceTier` (study design) and `impactTier` (venue) kept separate** — a top venue can still run
  a weak design; collapsing them loses that signal.
- **TS-first, guards deferred.** No `couplings.yaml` edges yet — there's no Dart consumer or DB table
  to hold honest, and shipping placeholder guard files with nothing to assert is the smell the
  couplings header warns against. Today's guard is the in-file `AssertExact` + zod. Dart parity /
  schema / endpoint→registry guards land with the first persistence + consumer (documented).

## Left (handed off / next)
- Synthesis + verifier pipeline implementation (tooling or edge function) + a `promptVersion` scheme.
- Persistence decision (Supabase table vs generated artifact) — lands when M5b consumes edges.
- The three deferred guards (Dart parity, DB schema, endpoint→registry) on first consumer.
- M5b wiring: surface the "why" using `servableEdges` / `servingBand`.

## Blockers
- None. Verified: `tsc --noEmit` clean in `shared/`. (No Dart/SQL touched; no new guard files, so the
  couplings existence check is unaffected.)
