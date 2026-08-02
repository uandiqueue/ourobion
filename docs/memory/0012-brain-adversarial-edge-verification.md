---
id: "0012"
title: The brain verifies synthesised edges with a second, grounded, adversarial LLM
summary: Every brain edge is synthesised then re-checked by an independent, adversarial verifier LLM against freshly-retrieved evidence; schema invariants force grounding (no retrieval ⇒ uncertain) and emit a graded trust score, not a yes/no gate.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-08-02
---

# 0012 — The brain verifies synthesised edges with a second, grounded, adversarial LLM

**The brain** (knowledge graph of scientifically-derived metric relationships) produces every edge in
two LLM passes: synthesis proposes a `RelationshipClaim`; a **second, independent LLM** re-checks it
against **freshly-retrieved** evidence and emits an `EdgeVerification`. Contract:
[`shared/brain/`](../../shared/brain/); design: [`brain-synthesis-design.md`](../implemented/nao/brain-synthesis-design.md).

**Why:** synthesis from papers is the highest hallucination-surface step; a wrong edge is written once
and read forever, so quality is paid at ingestion time (amortised). A second pass is only
non-redundant if it is **independent** (own retrieval, not re-opining over the synthesis context) and
**adversarial** (prompted to refute, defaults to `uncertain`). Re-asking the same model the same
question shares its blind spots and rubber-stamps.

**How it's enforced (not left to prompts):** schema invariants in `relationships.schema.ts` —
a `supported`/`partial`/`contradicted` verdict **requires `independentRetrieval.performed === true`**
(no grounding ⇒ `uncertain`); an approving verdict needs a **passing `quoteCheck`** and a
`directionCheck` that matches the claim; claims must ground a
verbatim quote span so a deterministic `quoteCheck` runs before the verifier LLM. Verification emits
**structured evidence metadata → a graded trust score** (`edgeScore` / `servingBand` in `index.ts`),
not a yes/no gate. Two ladders, kept separate: `evidenceTier` (study design 1–5, analog of metric
`reliability`) and `impactTier` (venue).

**Amendment 2026-08-01 — corroboration no longer decides the verdict.** The clause above originally
read "`supported`/`partial` need ≥1 corroborating source". It is **superseded by owner instruction**
(2026-08-01: *"we focus on single paper verification"* / *"Why still checking other studies?"*): the
verdict now answers only whether a claim is a **faithful reading of the ONE paper it cites**, and
corroboration / impact tier / venue prestige / evidence tier reach the user through the **`caveat`**
instead. The measured defect: two faithful single-paper claims came back `unsupported` (conf 0.92)
with the caveat *"The other studies found did not back this up."* The independent-retrieval clause is
UNCHANGED and still mandatory — retrieval runs, it just no longer votes. Contract invariants now bind
an approving verdict to the quote gate + `directionCheck` (fidelity), not to a headcount. Details in
[brain-synthesis-design](../implemented/nao/brain-synthesis-design.md) "What the verdict answers".

**Two-tier truth:** the contract is TRUTH (2-reviewer per
[0002](0002-shared-contract-two-reviewers.md)); the claims/verifications are a rebuildable projection
per [0001](0001-two-tier-truth.md) — never hand-edit a verdict, fix the input + re-run. Guards
(Dart parity, DB schema, endpoint→registry) are **deferred** until first persistence/app-render, like
the registry deferred env metrics — today's guard is the in-file `AssertExact` + zod.
