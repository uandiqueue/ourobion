---
title: Hackathon submission write-up · refreshed against issue #277
summary: The submission-ready five-pillar text refreshed after the two trained research checkpoints, the Haiku disagreement pilot and the 2026-07-31 landings — with the honest model section, the two harness bugs that were ours, the claims in the current writeup.md that are now false, the paste-ready system-connection-map rows, and the demo-script corrections.
type: reference
scope: run4
status: draft
updated: 2026-08-01
---

# Hackathon submission write-up · refreshed against issue #277

Issue: [#277](https://github.com/uandiqueue/ourobion/issues/277) · branch
`docs/run4/hackathon-submission-277` · base `dev-phase2-run4` @ `c8144f6`

## What this file is

`docs/hackathon/the_launchpad_challenge/writeup.md` (updated 2026-07-30) and its companion
`system-connection-map.md` are **stale**: the write-up still states that no support model was trained,
which stopped being true when Zebra v1 and Viceroy v0 were frozen and byte-verified. This file is the
refreshed replacement text plus the exact corrections needed in those two documents. It is written so
that the shared submission docs can be updated in one edit pass by whoever holds the merge, without
this branch touching files another branch is editing.

It is a submission-facing projection, not architecture authority. Where it disagrees with
`model-training/evidence/publication-results/`, the canonical docs win.

**Nothing in this file may be read as a scientific-validation, deployment, or model-promotion claim.**
Run 4 is local-only. `validated=false`, `serving_ready=false` and `public_weights_cleared=false` for
both checkpoints, and no trained model is wired into any user-visible surface.

---

## 1 · Five pillars (submission text)

<!-- WORD-COUNTED SECTION BEGIN -->

### Problem

Health apps surface patterns — *"your gut comfort dips on low-hydration days"* — but they are generic
and unexplained: a user cannot tell coincidence from signal. The obvious upgrade — an LLM
that explains *why* — is the most dangerous component to front a health claim: LLMs state correlation
as causation, reverse cause and effect, generalise an animal study to a person. The problem
is not data or model access; it is **grounding the interpretation** when the best tool for grounding is
the least trustworthy one.

Existing approaches fall short: trusting the model begs the question; the same model re-asked inherits
its own blind spots; retrieval-augmented citation still lets a model misread sources; manual grading
(GRADE, Cochrane) is rigorous but costs months per question.

We target the gap: **automated, evidence-grounded verification of LLM-proposed relationships** — cheap
at ingestion, honest enough to refuse when a claim cannot be grounded. We did not pre-register numeric
success criteria; the operating point was set after our first run, and we say so rather than retrofit
one. This needs an agent, not one call: verification demands independent retrieval and an
adversarial second pass. We demonstrate on health-metric relationships; our prebuild app (*biotope*)
consumes this layer and is not the contribution.

### Approach

Two decorrelated LLMs, not one clever prompt. A synthesis model (OpenAI) proposes a relationship from a
paper; an adversarial model from a different vendor family (Anthropic, in the run we executed) must
refute it through its **own independent retrieval**, defaulting to `uncertain` when it cannot ground the
claim — a schema invariant (`independentRetrieval.performed`), not a prompt request.

We deliberately **cut** agent count rather than grow it: only synthesis, adversarial verification,
presentation and human curation keep judgment; extraction, passage selection and gating are
deterministic, and the cheapest check runs first: a `quoteCheck` precedes any verifier
token. Two evidence ladders stay uncollapsed — study design and venue — because rigor and
notability are not one axis.

Alongside this we trained two small **discriminative** checkpoints as research-only probes of a cheap
non-generative second opinion: Zebra v1 (claim/evidence entailment) and Viceroy v0 (causal wording in a
conclusion sentence). Neither is in the serving path, and neither may influence a user-visible output.

**Honest weakness:** `edgeScore` weights and `EDGE_GATES` thresholds (0.8/0.5) are uncalibrated —
provisional pending a labelled set, not derived numbers.

### Evidence

The deterministic gate (`quoteCheck`, schema validation) is unit-tested. On it we ran the full pipeline
end to end once: a canonical paper extracted in full (91,162 characters), synthesis over 12 selected
passages, then the verifier's own retrieval returning `uncertain` with **zero independent sources
found** — the edge was **held, not served**. That refusal is our strongest artifact.

Serving integrity was proven separately: a fixed-edge harness passed **20/20**, and cards rendered on a
physical Android device from 21 days of **simulated** data.

Both checkpoints then ran offline on real weights, every byte hash-verified before load (6/6 files per
release; 3.1 s and 2.8 s CPU inference; no API call, nothing leaving the machine). We ran a
**disagreement pilot** against Haiku 4.5 on 96 sentences each, stratified by
topic from our own 1,298-paper corpus manifest: Zebra disagrees on **42.7%** [32.8, 52.6], κ 0.236;
Viceroy on **47.9%** [37.9, 57.9], κ 0.205. The disagreement is structured: 33 of Zebra's 41 sit in one
cell — Zebra `insufficient_evidence` against Haiku `supported`.

**Nobody has adjudicated these, so we make no correctness claim: this measures agreement, not
accuracy, and we do not claim our model is the better one.** What it does establish is narrower: on at
least ~43% of real conclusion sentences the two systems cannot both be right. That is a measured reason
not to trust a single verifier.

### Constraints

Cost is paid once at ingestion and amortised over every read, so spend is tiered: full
independent-retrieval verification is reserved for high-impact, low-corroboration edges. Budget
guardrails fail closed — a hard stop at 95% of any provider quota, plus per-source token buckets. Our
one measured run reconstructed locally to roughly **SGD 0.065** (OpenAI) and **SGD 0.134** (Anthropic);
provider billing is authoritative.

Platform limits shaped the design: *nao* runs on Cloudflare Workers, whose CPU ceiling cannot sustain a
long ingestion job, so it dispatches a GitHub Actions run instead. Retrieval is OA-first; we do not
redistribute closed-access text.

We have no GPU: both checkpoints were trained on an Apple MPS laptop, which is why they are small
encoders and why three further support models remain untrained. Weights stay private — licence clearance
is unresolved — so we describe them and do not distribute them. We do not claim PDPA compliance or data
isolation for any hosted demo.

### Honesty & Trajectory

**What we did not build, plainly.** *biotope* is prior work — 118 commits before 3 Jul 2026 — the
backdrop, not the delta. The verified graph is **one held edge from one paper**. Our pipeline evaluation
is a **single end-to-end run**: one refusal observed, zero baseline comparisons — a demonstrated
mechanism, not a measured accuracy rate. Nothing is deployed; every number here is from a local run.

On the models we are blunter. Zebra **failed two of its three preregistered readiness gates**: macro-F1
0.599 against ≥0.70, and minimum-seed recall 0.4348/0.5796 against ≥0.60. Only
calibration passed (ECE 0.0491). Viceroy has one frozen fold, not completed cross-validation, and
same-paper leakage it cannot rule out. Two bugs in the comparison harness were **ours, not the models'**
— an earlier "model bias" finding turned out to be an evidence-format mismatch, and an earlier version
of the test had zero label variance and therefore measured nothing. The weakest number in the pilot is
ours to name: only 33 of Viceroy's 96 sentences carried an explicit conclusion cue; the other 63 were
last-sentence fallbacks, often recommendations with no clean causal label.

**Next:** adjudicate ~100 of those disagreements with a non-Claude-family judge and human spot-checks —
that is what converts a disagreement rate into a directional claim — build the hand-labelled gold set
for the baseline-vs-verifier comparison this write-up is still missing, and re-run the pilot on
cued-only sentences. Ourobion is non-diagnostic, not a medical device.

<!-- WORD-COUNTED SECTION END -->

Word count, five pillar sections only (appendices, the `###` headings and the marker comments excluded,
per the rules): **1,000** whitespace-delimited tokens, measured over the marked block. It is at the
limit with no margin, so any addition must be paid for by a deletion. The first drafts of this text ran
1,125 words; everything cut was descriptive design prose (the graph-DB aside, the R2 "mailbox"
iteration, the OpenAlex cost-model detail, the exact byte counts, which survive in §2.1). **No caveat,
failed gate, or negative result was cut to make the limit**, and none may be — if a future edit needs
room, take it from the Approach or Constraints description, never from Honesty.

---

## 2 · The model section, in full

This is the long-form version of the Evidence and Honesty paragraphs above, for a judge who pushes on
them or reads the appendices. Everything in it is drawn from
`docs/sessions/20260730T185942Z-uandiqueue-claude-offline-inference-runner.md` and
`model-training/evidence/publication-results/`.

### 2.1 What exists

Two trained, frozen, privately stored research checkpoints, content-addressed and byte-verified (#250),
with a read-only offline inference runner (#266, PR #270 merged).

| | Zebra v1 | Viceroy v0 |
|---|---|---|
| Task | 3-way claim/evidence: `supported` / `contradicted` / `insufficient_evidence` | 4-way causal wording: `no_relationship` / `direct_causal` / `conditional_causal` / `correlational` |
| Release | `sha256-e1d09fbd…` | `sha256-751fbf1f…` |
| Verified | 438,938,903 B, 6/6 files | 438,942,033 B, 6/6 files |
| Inference | 3.1 s | 2.8 s |
| Base model | BiomedBERT (MIT) | BiomedBERT (MIT) |
| Training data | `allenai/scifact_entailment` (CC BY-NC 2.0) | Yu, Li & Wang corpus (GPL-3.0 repo, unresolved data terms) |

Every byte of every artifact is hashed against a frozen manifest before load, and the release id is
itself the digest of that manifest, so the six per-file hashes cannot be edited independently. The runs
were fully offline: no API call, no network egress of corpus text, deterministic, and the temp bundle
directory is removed in a `finally` (verified against real 419 MB bundles).

Viceroy's label space came from the shipped `config.json`, not from the issue that commissioned it —
there is **no `mechanistic` class** in the checkpoint, and the distinction it actually draws is *direct*
versus *conditional* causal wording. A bare `causal` alias is deliberately absent: resolving it would
mean picking one of the two, and that is exactly what an alias table must not do.

### 2.2 The headline numbers, and what they are not

A disagreement pilot against Haiku 4.5, 96 rows per model, sampled from the real `ourobion-corpus`
manifest (1,298 papers; topics `gut_microbiome`, `antibiotics`, `environmental_health`, `hydration`,
`sleep_hrv`, `dengue_vector`), stratified by topic, seed 266:

| | Zebra v1 | Viceroy v0 |
|---|---|---|
| Disagreement with Haiku 4.5 | **42.7%** [32.8, 52.6] | **47.9%** [37.9, 57.9] |
| Cohen's κ | **0.236** | **0.205** |

κ of 0.21–0.24 is conventionally "fair to slight" agreement. We are not presenting it as agreement.

**The pilot measured agreement, not correctness.** There is no ground truth for these sentences. No row
has been adjudicated. Therefore:

- We do not claim Zebra or Viceroy is more accurate than Haiku 4.5, on this corpus or any other.
- We do not claim Haiku is wrong on the rows where it differs from us.
- We do not report any accuracy, precision or recall figure on the nao corpus, because none exists.
- We do not claim the models are `validated` or `serving_ready`. Both are false and stated as false.

The one inference that *is* available from a disagreement rate alone is symmetric and costs us nothing
to state: where two systems assign mutually exclusive labels to the same row, they cannot both be
right, so on **at least** 42.7% (Zebra) and 47.9% (Viceroy) of these rows at least one of the two
systems is wrong. It does not say which. It also assumes a well-defined gold label exists for the row,
which is precisely what §2.4 says is doubtful for 63 of Viceroy's 96 sentences — so even this claim is
sound for the cued subset and shakier for the fallback subset.

### 2.3 The disagreement is structured — and what that does and does not mean

33 of Zebra's 41 disagreements are a single cell: Zebra `insufficient_evidence` where Haiku says
`supported`. Viceroy's disagreements point the same direction — Haiku reads recommendations and
aspirations, e.g. *"highlight the need for interventions to reduce transmission"*, as causal claims.
The labelling prompt given to Haiku explicitly warned that the evidence was keyword-retrieved and often
irrelevant to the claim.

That pattern is a **hypothesis about where the two systems diverge**, not evidence that either is
right. Two readings survive the data equally well:

1. Haiku credits topical overlap as support, and Zebra's refusals are correct; or
2. Zebra's threshold for `supported` is too conservative on retrieved evidence, and Haiku's reading is
   correct.

Nothing we have run distinguishes these. Blinded adjudication sheets were produced — 46 Viceroy rows,
41 Zebra rows, model identity shuffled per row — but they are scratchpad-only and must be regenerated;
they were never adjudicated. **Anyone editing this section must keep both readings on the page.** The
temptation is to keep reading 1 and drop reading 2, and that single deletion would turn an honest
finding into an unsupported accuracy claim.

### 2.4 The weakest point, named by us

Only **33 of Viceroy's 96** sentences carried an explicit conclusion cue. The other **63** were
last-sentence fallbacks — frequently recommendations, limitations or future-work lines with no clean
causal label at all. A judge who opens the sample will find them, so we say it first: roughly two
thirds of the Viceroy sample is sentences on which the task itself is ill-posed, and the 47.9% figure
is therefore a mixture of real disagreement and a labelling task with no right answer. Re-running on
cued-only sentences is the single most informative next measurement, and it has not been run
(see §4).

Zebra's per-class evidence is weak in a different way and we state it rather than round it:

| Gate | Target | Result | Verdict |
|---|---|---|---|
| Mean macro F1 | ≥0.70 | 0.5991 ± 0.0081 | **Fail** |
| Every-class minimum-seed recall | ≥0.60 | contradicted 0.4348; supported 0.5796 | **Fail** |
| Mean ECE | ≤0.10 | 0.0491 | Pass |

Those are three-seed, four-fold grouped cross-validation numbers on a 1,007-row development pool, with
no fresh independent audit. Viceroy's 0.8656 macro-F1 (group-bootstrap 95% CI 0.833–0.896) is **one
frozen fold**, not completed five-fold cross-validation, and lexical surrogate grouping cannot fully
exclude same-paper leakage; the optimistic bias is unquantified. Viceroy's ~0.997 confidence on the
semantically right class is real but was observed on a **six-row hand-written smoke test**, and
`conditional_causal` drew zero predictions there, so that class is unexercised.

### 2.5 Two harness bugs — both ours, not the models'

Two defects in the comparison harness were found and fixed. Both had produced a wrong conclusion about
a model, and in both cases the model was fine:

1. **Hand-written single-sentence evidence made Zebra's `supported` class never fire.** Zebra's recipe
   is label-blind **BM25 top-3** evidence; the harness fed it one hand-written sentence. With
   training-matched input, `supported` fires 37/96. The earlier report of a "`contradicted` bias" in the
   model was an evidence-format mismatch in our harness. That earlier finding is **retracted** — and
   retracting it does not license the opposite claim either: we have not shown Zebra is unbiased, only
   that the observation that suggested bias does not survive a correct input format.
2. **Retrieving evidence from one arbitrary same-topic paper made `insufficient_evidence` correct
   96/96.** Zero label variance means the test measured nothing at all. Retrieval must rank across the
   whole topic pool.

**Any re-run must preserve both fixes, or it re-measures the harness instead of the models.** This
sentence exists because the first version of each bug produced a plausible-looking result table.

### 2.6 Licence and distribution boundaries

- **Do not distribute weights.** `public_weights_cleared=false` for both checkpoints. Zebra needs a
  release decision covering weights, tokenizer, model card, attribution and non-commercial constraints;
  Viceroy's owner waiver explicitly excludes publishing or shipping the weights.
- **Do not show SciFact examples.** The recorded approval covers a non-commercial, non-serving research
  pilot, excludes redistribution, and does **not** settle whether evaluation examples may be shown.
  Demo material must come from the OA corpus papers, with attribution.
- The offline run described here is a **local** run: no Actions run URL, no runner image, no
  GitHub-recorded tool versions. It is not #266 §5 acceptance evidence, and §5 cannot be executed until
  the workflow reaches a default branch through the owner-gated promotion path.

---

## 3 · Corrections required in the shared submission docs

These are the edits the merge holder should apply; this branch does not make them, to avoid colliding
with concurrent work.

### 3.1 `writeup.md` — claims that are now false

| Current text | Status | Replacement |
|---|---|---|
| "No support model was trained; SciFact/HealthVer/BioRED are roadmap data only." (Honesty) | **False** | Two were trained: Zebra v1 on `allenai/scifact_entailment`, Viceroy v0 on the Yu/Li/Wang causal-language corpus. HealthVer and BioRED remain unused. Three further support models remain untrained. |
| "We have no local GPU, so the three planned support models that would cheapen verification stay roadmap, untrained." (Constraints) | **Half false** | The no-GPU constraint is true and shaped the choice of small encoders; both shipped checkpoints were trained on Apple MPS. Say "three *further*" models. |
| Appendix G: "SciFact, HealthVer, BioRED — named as roadmap training data only; no training performed." | **False** | Same correction as above; SciFact's CC BY-NC terms and the no-examples constraint belong here. |
| Appendix B: 248 delta commits through `547280f`, measured 2026-07-28 | **Stale** | `git rev-list --count 2214fbb..HEAD` is **483** at `c8144f6` (2026-08-01), merge commits included. Re-measure at the frozen submission commit rather than copying either number. |
| Appendix B / C: `pre-hackathon-baseline` tag "not yet created" | **Still true** | `git tag -l` is still empty on this base. Either create the tag or keep the commit-date argument as the only checkable claim. |
| Appendix G: "Agnes AI, GMI Cloud — not used" | **Verify** | Not re-checked here. A pricing-config commit for Agnes exists on `main` (`815f44c`), which is configuration support rather than a run — confirm no call was ever made before repeating "not used". |
| Evidence: "4 rule-based cards plus two research cards" | **Verify** | The 2026-07-28 demo observed 2 active cards (one rules, one relationship). Reconcile against the frozen demo state before submission. |

The Evidence and Honesty pillars also need the model paragraphs from §1 spliced in; that is the
substantive refresh, not a wording fix.

### 3.2 `system-connection-map.md` — scope C rows, paste-ready

Add under the **existing** label `Planned/research-only; not serving` in §2 Component status. Do not
invent a new label; do not alter the label definitions in §0.

```markdown
| Zebra v1 (claim/evidence entailment checkpoint) | Planned/research-only; not serving | Trained, frozen, privately stored, byte-verified (#250); read-only offline runner #266 / PR #270. Failed 2 of 3 readiness gates (macro-F1 0.599 vs ≥0.70; min-seed recall 0.4348/0.5796 vs ≥0.60); ECE 0.0491 passed. `validated=false`, `serving_ready=false`, `public_weights_cleared=false`. Zero imports from `apps/`, `supabase/`, `shared/`, `tools/brain-ingest`; `tools/check_arch_boundaries.mjs` is the CI guard that blocks them. Evidence: `model-training/evidence/publication-results/zebra-v1-results.md` |
| Viceroy v0 (causal-wording checkpoint) | Planned/research-only; not serving | Trained, frozen, privately stored, byte-verified (#250); same runner. One frozen fold (macro-F1 0.8656, group-bootstrap 95% CI 0.833–0.896), not completed cross-validation; same-paper leakage uncontrolled. Classifies author wording only — it does **not** assess whether evidence licenses a causal claim. `validated=false`, `serving_ready=false`, `public_weights_cleared=false`. Evidence: `model-training/evidence/publication-results/viceroy-v0-results.md` |
| Zebra/Viceroy vs Haiku 4.5 disagreement pilot | Planned/research-only; not serving | 96 rows each from the real corpus manifest, seed 266: 42.7% / 47.9% disagreement, κ 0.236 / 0.205. **Agreement, not accuracy — unadjudicated, so no correctness or ranking claim is available.** Evidence: `docs/sessions/20260730T185942Z-uandiqueue-claude-offline-inference-runner.md`, `docs/development/run4/hack-submission-277.md` |
```

§9 (submission-safe claims) should gain one line: *the two research checkpoints ran offline on verified
weights and disagree with a general LLM on ~43–48% of real conclusion sentences; nobody has adjudicated
those disagreements, so no accuracy or ranking claim about either side is available.*

---

## 4 · Issue #277 scope A and B were NOT done

Both require fresh model and provider runs. **No provider spend was authorised for this session, so
neither was executed.** They remain open follow-ups, unchanged in scope.

| Scope | Work | Status |
|---|---|---|
| A | Re-run the Viceroy comparison on **cued-only** sentences and report whether the disagreement rate moves | **Not done** — needs a fresh inference run plus fresh Haiku labels |
| B | Adjudicate ~30 rows minimum, ~100 ideally, to support a directional claim | **Not done** — needs an adjudicator |
| C | Land the honest claims in the shared submission docs | **Drafted here, not applied** — see §3, deliberately left for the merge holder |

Sizing carried forward from the issue: the observed ~45% disagreement rate means **~220 sampled rows
yields ~100 disagreements**, far cheaper than the 500–700 originally projected. At 100 adjudicated
disagreements the 95% CI is ±10%; at 30 it is ±18%, which still excludes a tie if one side wins 70/30.

**The adjudicator must not be a Claude-family model.** Haiku 4.5 is one of the two systems under
comparison, so an Opus adjudication is correlated rather than independent. Human, or a genuinely
different vendor family with human spot-checks.

Until B is done, no sentence anywhere in the submission may rank the models against the LLM.

---

## 5 · What landed and what did not

Landed on `dev-phase2-run4` on 2026-07-31 (base `c8144f6`):

| Issue | PR | Change |
|---|---|---|
| #266 | #270 | Read-only offline inference runner; #266 now closed |
| #290 | #296 | Per-unit landing base advanced to the #270 merge; product-cap acceptance still `false` |
| #284 | #293 | `CoverageCard` truthfulness — the "every channel" claim now requires a complete day |
| #286 | #295 | Citation DOI canonicalisation, dot-segment rejection, link semantics |
| #285 | #294 | Trend axes derived from the metric registry instead of a hardcoded switch |

In flight at time of writing, not landed: **#287** (Scan controls + stepper a11y), **#282**
(acceptance-test coverage for the #268 contract), **#264** (owner-approved product-envelope deviation
record).

Explicitly deferred and **not delivered** — none of these may be described as done, partial, or
in progress in any submission material:

| Issue | Why not delivered |
|---|---|
| **#222** (U6c MEDIUM metric collector families) | Gated on the unbuilt A4-1 → A4-2 → A4-3 chain |
| **#283** (host biotope as a Flutter web app) | Owner-deferred behind #222. **There is no hosted biotope deployment.** |
| **#275** (nao operator UI for synthesis/verification) | Not built |
| **#246** (14+7 positive-control acceptance) | Blocked on #240 requirement 4 — an unbuilt provider-attested monotonic verification — and on absent `data/corpus/demo-edges` artifacts |

---

## 6 · Demo-script corrections

`hack-mvp-demo-script.md` is dated 2026-07-28 and is **not edited by this branch** (another branch is
editing that area). These are the corrections to apply to the talk track; the demo script's own honest
posture — local fallback, nothing hosted, simulated data — remains correct and should be kept.

**Falsified by the #284 landing.** Step 1 tells the presenter to point at "the 82/100 **coverage**
label". At 82 the card previously read *"Every channel captured today"*, which was false — 82 is
reachable with four of seven daily-core channels unlogged. After PR #293 the card reads *"Coverage
recorded today"* with *"82 / 100 pts — run a sweep to capture more today"*; only a canonical `dqs` of
exactly 100 renders the completeness claim, and below 60 it reads *"Coverage in progress"*. Update the
talk track, and do not say "every channel" on stage at 82.

**Falsified by the #285 landing.** Trend axis ticks now derive from `shared/metrics/registry.ts`
instead of a seven-key hardcoded switch, so `stool_count` no longer draws a gridline labelled `1.5`.
If a trend is shown, the honest framing is "axis policy comes from the shared metric registry", not
"we hand-tuned the axes".

**Falsified by earlier landings, still wrong in the script.** Two "not built" claims are stale:

- Step 4 and the "What is not built" list say there are **no Archive trends (issue #200)**. #200 is
  closed and `ArchiveTab` renders the reused `MetricTrendSection` under its own eyebrow. The script
  understates the app here.
- Step 2 says "This is not the proposed `scanSweep` restyle". #201 is closed and `scan_tab.dart` now
  carries the sweep presentation (`sweepDuration` 1500 ms, sweep-band and completion-overlay keys).

**Changed by the #286 landing.** In step 3 the citation link now lower-cases DOIs and rejects
dot-segment DOIs into the honest unavailable-link state. The surfaced research citation is **still a
hand-authored fixture, not a real paper and not LLM synthesis** — keep saying exactly that.

**New hazard, not yet fixed (#287, open).** An expanded Scan gap card has no tap target to collapse it:
with a single Needs-You card showing, the only way out is to answer the metric. Reduce-motion still
waits ~2.4 s. Either avoid that path live or narrate it as a known open defect.

**Do not merge the two evidence stories.** The demo script's "no live provider/LLM calls" is still true
of the app. Tonight's model runs also made no API call — but they are a separate, offline research
track. No trained checkpoint touches Home, Scan, Insights, Archive or Profile, and the demo must not
imply otherwise.

**Not re-verified in this session** (treat as unchanged, not as fixed): the O28 `MetricTile` overflow at
1.6× text scale and its skipped regression, B-UI3 `humanVerdict`, and B-UI10/B-UI11 raw-identifier
leakage into ordinary-user provenance copy.

---

## 7 · The claim ledger for this refresh

A single table a reviewer can walk to check that nothing here outruns its evidence.

| Claim | May we say it | Evidence |
|---|---|---|
| Two checkpoints trained, frozen, content-addressed, every byte hash-verified before load | **Yes** | #250, #266/PR #270, offline-runner session log |
| Offline inference, no API, nothing left the machine, deterministic | **Yes** | Same |
| Measured disagreement rates and κ, with CIs and the structure of the disagreement | **Yes** | Same, §2.2–2.3 |
| Zebra's real CV numbers **including the two failed gates** | **Yes** | `zebra-v1-results.md` |
| Viceroy ~0.997 on the semantically right class, n=6 hand-written rows | **Yes, with n stated** | Offline-runner session log |
| At least ~43% of rows have one wrong label between the two systems | **Yes, as a deduction** | §2.2, with the ill-posed-row caveat |
| Any accuracy figure on the nao corpus | **No** | No ground truth exists |
| Zebra or Viceroy outperforms an LLM | **No** | Unadjudicated |
| Haiku is wrong where it disagrees with us | **No** | Unadjudicated; §2.3 keeps both readings |
| `validated` or `serving_ready` | **No — must be stated false** | #266 acceptance criterion |
| Zebra passed its readiness gates | **No — it failed two of three** | `zebra-v1-results.md` |
| Weights published or distributable | **No** | `public_weights_cleared=false` for both |
| SciFact evaluation examples shown | **No** | Approval does not settle it |
| Hosted biotope deployment | **No** | #283 deferred behind #222; nothing deployed |
| Scientific validation, model promotion, production traffic | **No** | Run 4 is local-only by boundary |

## 8 · References

- `docs/sessions/20260730T185942Z-uandiqueue-claude-offline-inference-runner.md` — the offline
  inference evidence, the `id2label` finding, the four review findings, the local live run.
- `model-training/evidence/publication-results/{zebra-v1,viceroy-v0}-results.md` — the canonical
  training and evaluation numbers, gates, limitations and licence status.
- `docs/hackathon/the_launchpad_challenge/writeup.md`, `system-connection-map.md` — the shared submission
  docs this file refreshes.
- `docs/development/run4/hack-mvp-demo-script.md` — the demo runbook §6 corrects.
- `model-training/src/ourobion_model_lab/inference/` — runner, release pins, schemas.
