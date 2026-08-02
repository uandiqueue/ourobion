---
title: Model-training run 2 — accepted plan corrections
summary: Disposition of codex's five-model plan review. Twenty-two findings accepted, one partially, one rejected with evidence. Records what changes in each plan before its MT unit may be implemented, including the label-dependent evidence construction in Zebra that would have inflated its headline scores.
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Model-training run 2 — accepted plan corrections

Disposition of [`../five-model-training-plans-review.md`](../five-model-training-plans-review.md)
(codex, 2026-07-27) against the five plans I authored. Reviewed independently; findings were checked
against the sources rather than accepted on assertion.

**Summary: I agree with the review.** Three of its five verdicts overturn plans I wrote, and two of the
findings are defects that would have produced misleading results rather than merely untidy ones. One
recommendation — the one-day priority order — I dispute on purpose-fit grounds, with reasoning in §6.

No plan file is amended by this document. Each amendment lands with its MT unit; this is the accepted
worklist.

## 1. Zebra NLI Shadow v0 — WORKABLE after corrections

| # | Finding | Disposition |
|---|---|---|
| Z1 | **Evidence construction leaks label availability.** Supported/contradicted rows get gold rationale sentences plus context; `NEI` rows get BM25-selected sentences | **ACCEPTED — the most important finding in the review** |
| Z2 | Split assertions stop at internal train folds; no train↔official-dev leakage guard | **ACCEPTED** |
| Z3 | `NEI → uncertain` is not a clean contract mapping | **ACCEPTED** |
| Z4 | Audit eligibility gate underpowered and ambiguous | **ACCEPTED** |
| Z5 | §12 still binds a separate `model-lab` git SHA | **ACCEPTED** |

**On Z1.** My plan constructed the evidence window *differently depending on the label*. The classifier
can then learn the input-selection policy instead of entailment — a rationale-shaped window means
supported/contradicted, a BM25-shaped window means uncertain — and inference never has gold rationales.
My plan anticipated a *length* shortcut ("report evidence-token-length distributions by label") but not
the structural one, and the note that "BM25 never assigns the label" is beside the point: the *procedure*
carries the label even when the selector does not. This would have inflated the headline number.

**Correction:** one label-blind retrieval and windowing policy for every class across training, CV, dev,
audit and the LLM comparison. A gold-rationale run survives only as an explicitly named
`oracle-evidence` secondary analysis, and eligibility must rest on the label-blind result.

**On Z3.** The contract distinguishes `unsupported` ("no evidence found either way — absence, not
contradiction") from `uncertain` ("could not be grounded"). SciFact `NEI` is neither exactly. Rename the
model-native class **`insufficient_evidence`**, define its SciFact source mapping, and claim it fills
neither five-way state directly.

## 2. Giraffe Study-Design v0 — NOT WORKABLE AS WRITTEN

**ACCEPTED, and independently verified.** StudyTypeTeller's labels are:

> Clinical-study-protocol · Human-systematic-review · Non-systematic-review · Human-RCT-non-drug-intervention
> · Human-RCT-drug-intervention · Human-RCT-non-intervention · Human-case-report ·
> Human-non-RCT-non-drug-intervention · Human-non-RCT-drug-intervention · Animal-systematic-review ·
> Animal-drug-intervention · Animal-non-drug-intervention · Animal-other · In-vitro-study · Remaining

There is **no cohort class and no cross-sectional class**; both collapse into `Remaining`. My plan
simultaneously (a) named StudyTypeTeller the primary gold set and (b) made tier-2-vs-tier-3 F1 ≥0.50 an
eligibility gate. Those are mutually incompatible — the gate cannot be measured on that gold set. I did
not catch it.

Accepted corrections: use StudyTypeTeller only for the clearly mappable coarse slices (tiers 1, 4, 5) and
as a robustness probe; build a dedicated blinded five-tier gold set with real tier-2/3 counts; publish and
hash a closed `giraffe-label-rules-v0` (exact PT/MeSH/check-tag IDs, precedence, ambiguity, abstention)
before preprocessing; align the input to A5's residue contract; and pick either stratified sampling or
class-weighted loss rather than both.

**Consequence for today: Giraffe cannot be trained today.** Its primary evaluation now requires human
annotation that does not exist.

## 3. Salmon Relation/Direction v0 — WORKABLE, narrower

**ACCEPTED.** Preserve BioREDirect's native direction states (`rightward/leftward/undirected/none`)
rather than collapsing them into my three-state scheme; add an explicit *unrepresentable* outcome to the
relation map instead of forcing biomedical labels onto the contract enum; select on both heads; report
coverage-aware metrics; keep v0 offline research only, never writing `directionCheck` or
`RelationshipClaim.relation`.

This is consistent with what my plan already refused to cover (`no_effect`, `confounds`); the review
correctly extends the same discipline to the relation and direction maps themselves.

## 4. Viceroy Claim-Kind v0 — NOT WORKABLE AS WRITTEN

**ACCEPTED, and the criticism is sharper than my own.** The contract defines `ClaimKind` as *"the
strongest claim the evidence licenses"*. The Yu/Li/Wang corpus labels *which causal language an author
used*. Those are different questions, and no corpus F1 on the second validates the first.

I flagged the `mechanistic` coverage gap and the spin problem (>80% of titles misinterpret
non-significance), but I did not flag that the **task itself** is mismatched with `claimKindCheck`. The
pair-alignment point is also correct: a conclusion sentence may assert several relationships and is not
aligned to the specific claim's metric pair.

**Accepted correction — rescope and rename to `viceroy-causal-language-risk-v0`.** An auxiliary detector
of causal wording that flags claims for verifier attention or error analysis. It never populates
`claimKindCheck` and is never described as evidence validation.

Note this *preserves* the model's practical value. "Flags when a paper's conclusion uses stronger causal
language than its design supports" is still a real signal and still demonstrable — it simply is not the
contract field.

## 5. Leafcutter Sentence-Role v0 — NOT WORKABLE AS WRITTEN

**ACCEPTED.** PubMed 200k RCT yields three primary roles under my own mapping (background+objective →
`background`, methods → `method`, results+conclusions → `finding`), not four. My plan described a
four-role primary head, which the specified data cannot train. I documented the `other` gap honestly but
still framed the head as four-role — the framing was wrong.

Also accepted: `hedge` is orthogonal and duplicates the existing `assertion='hedged'` field, so a hedged
finding should not lose its primary role; Stage B (full-text) is effectively **mandatory** rather than
conditional, because `other` cannot exist in an abstract-only corpus; the ≥300-sentence audit needs
paper-level separation, dual review, class quotas and a predeclared non-inferiority test against Haiku;
and "MiniLM-class" pins no checkpoint, revision, tokenizer, ONNX opset or parity tolerance.

**Correction:** Stage A is explicitly `background | method | finding` with abstention, treated as
baseline evidence and **not** an A4 replacement.

## 6. Where I disagree — the one-day priority order

The review ranks **Leafcutter first**, on cost and probability of an interpretable result. I dispute
this, and it is the only substantive disagreement.

Jayden's two stated purposes are (1) a second-source signal to help the LLM decide, with token reduction
explicitly *deferred* until reliability is confirmed, and (2) a hackathon showcase. Against those:

- Leafcutter is **not demoable** — sentence-role tagging is plumbing with no visible output.
- Its only near-term value is **cost reduction**, which is the purpose explicitly deprioritised.
- By the review's own verdict it can today be at most a 3-role baseline that is **"not an A4
  replacement"** — so it cannot be integrated either.

So it optimises for a purpose that is not being pursued, and produces an artifact that can be neither
shown nor shipped. Cheapness is not sufficient justification when the output serves no stated goal. The
review's ranking axis — "value × chance of an interpretable result" — is reasonable, but its *value* term
does not reflect the two purposes actually stated.

I accept everything else in §10, including the reality check that five models in one day is not workable
and that controls must not be cut to produce weight files.

## 7. Rejected

Nothing was rejected outright. Every technical finding above is accepted; only the priority ordering in
§10.2 is disputed, and on grounds of purpose rather than correctness.
