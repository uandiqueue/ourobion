# Zebra v1 / Viceroy v0 vs Haiku 4.5 — disagreement pilot

**Date:** 2026-07-31 · **Status:** working record, deliberately untracked · **Issue:** [#277](https://github.com/uandiqueue/ourobion/issues/277)

This directory is **gitignored on purpose**. #277 is hard-gated behind full issue
reconciliation, and none of this should land in the repo before that gate opens. It is kept here,
rather than in a session scratchpad, so the experiment survives the session and can be re-run
instead of re-derived.

Nothing here is validation. Both checkpoints remain `validated=false`, `serving_ready=false`,
`public_weights_cleared=false`.

---

## What was tested

Not "how accurate are these models" — there is no ground truth for the nao corpus. The question was:

> Where does a small discriminative model disagree with a general LLM on **real ingested papers**,
> and is that disagreement structured or random?

This is the decorrelation question `docs/memory/0012` and `0013` commit the design to. It is
answerable without knowing who is right, which is what makes it worth running now.

**Benchmark model:** Haiku 4.5, run as a subagent in-session. No API key, no router, no spend.

## Headline results

| | Zebra v1 | Viceroy v0 |
|---|---|---|
| Rows | 96 | 96 |
| Disagreement with Haiku | **42.7%** [32.8, 52.6] | **47.9%** [37.9, 57.9] |
| Cohen's kappa | 0.236 | 0.205 |
| Model mean confidence (disagreeing rows) | 0.762 | 0.957 |

Both sit in "slight-to-fair" agreement — barely above chance.

### The disagreement is structured, not noise

**Zebra** — 33 of 41 disagreements are a single confusion cell:

|  | Haiku supported | Haiku contradicted | Haiku insufficient |
|---|---:|---:|---:|
| **Zebra supported** | 31 | 2 | 4 |
| **Zebra contradicted** | 1 | 0 | 1 |
| **Zebra insufficient** | **33** | 0 | 24 |

Haiku called 65/96 `supported`; Zebra 37. The labelling prompt explicitly warned that evidence was
assembled by keyword retrieval and was often topically adjacent but irrelevant. Haiku still said
"supported" for two thirds of rows. The apparent failure mode is **over-crediting vocabulary overlap
as evidential support** — precisely the risk a single-LLM verifier would carry silently.

**Viceroy** — same direction. Haiku reads recommendations and aspirations as causal claims:

- *"These results highlight the need for targeted outdoor interventions … to reduce the risk of
  dengue transmission"* → Viceroy `no_relationship`, Haiku `direct_causal`
- *"A parsimonious model … may support screening-oriented characterization"* → Viceroy
  `no_relationship`, Haiku `conditional_causal`

Viceroy's own weakness shows in the reverse direction: it missed explicitly conditional framing
(*"if R≤1 the mosquitoes vanish, if R≥1 they must spread"* → Viceroy `direct_causal`, Haiku
`conditional_causal`, and Haiku looks right there).

### Nobody has adjudicated

**No correctness claim is available from this pilot.** The readings above are hypotheses about the
*pattern*, not verdicts. Blinded sheets are in `data/ADJUDICATE-*.tsv` (model identity shuffled per
row; keys in `*-key.json`).

The adjudicator **must not be a Claude-family model** — Haiku is one of the two systems under
comparison, so an Opus adjudication is correlated, not independent.

---

## Two harness bugs — both in this harness, not in the models

Recording these prominently because each one *looked* like a model defect and would have been
reported as one.

### 1. Zebra's `supported` class "never fired"

On five hand-written smoke pairs, Zebra returned 4 `contradicted` / 1 `insufficient_evidence` and
never `supported`. That reads as a broken or badly-biased model.

It was an input-format mismatch. Zebra's recipe is **BM25 top-3 evidence selection** — at training
time `evidence_text` was several retrieved sentences concatenated, not one tidy hand-written
sentence. With training-matched construction, `supported` fires **37/96**.

### 2. All-`insufficient_evidence` collapse

The first pair-builder drew evidence from *one arbitrary same-topic paper*. Those sentences almost
never bore on the claim, so Zebra answered `insufficient_evidence` for **96/96** at median
confidence 0.855 — which is *correct behaviour*, but leaves zero label variance and makes the
disagreement test measure nothing.

Fix: rank BM25 across **every** other paper in the topic pool. That is also closer to SciFact, where
a claim is checked against retrieved abstracts that actually discuss it.

**Any re-run must preserve both fixes**, or it re-measures the harness rather than the model.

---

## Method

**Corpus:** `ourobion-corpus` R2 bucket, 2,807 objects; `manifest/papers.jsonl` = 1,298 papers,
1,147 with abstracts. Topics: gut_microbiome 283, antibiotics 223, environmental_health 220,
hydration 199, sleep_hrv 192, dengue_vector 189.

**Sampling:** stratified by `topicTags[0]`, 16 per topic, `SEED = 266`, reproducible.

**Viceroy inputs** — conclusion sentences from abstracts. Preference for explicit conclusion cues
("in conclusion", "these findings", "we conclude"…), falling back to the abstract's final sentence.
Filters: 60–400 chars, balanced parentheses, <25% digits, sentence-final punctuation.

**Zebra inputs** — claim = a conclusion sentence from paper A; evidence = BM25 top-3 sentences
ranked across all *other* papers in the same topic. Same-paper leakage asserted 0.

**Access note:** corpus reads use a standalone script (`scripts/corpus_survey.py`) that reuses the
reviewed `build_signed_headers` signer but **does not** touch `assert_allowed_target`. The model
runner's bucket pin (PR #270 review finding 2) stays intact. Do not disable that guard to reach the
corpus.

## Known limitations

1. **Viceroy sampling is soft.** Only 33 of 96 sentences carried explicit conclusion cues; the other
   63 were last-sentence fallbacks, frequently recommendations or future-work lines with no clean
   causal label. Some of the 47.9% is likely sampling artifact. **Re-run cued-only before quoting
   this number.** (#277 scope item A.)
2. **n = 96.** Disagreement-rate CIs are ±10 points.
3. **Off-domain rows.** The corpus includes arXiv maths/ML papers (188 arXiv venue entries); some
   sampled rows contain raw LaTeX. Both models are biomedical.
4. **Single benchmark model**, single prompt, no self-consistency or prompt-sensitivity check.
5. **Unadjudicated**, as above.

## Sizing for the full run

The observed ~45% disagreement rate is 2–4× higher than pre-pilot estimates, which makes the real
run much cheaper than projected:

| Adjudicated disagreements | CI half-width | Rows to sample at p≈0.45 |
|---|---|---|
| 30 | ±18% | ~70 |
| **100** | **±10%** | **~220** |
| 384 | ±5% | ~850 |

~220 rows yields ~100 disagreements — not the 500–700 estimated before the pilot. Human adjudication
is the binding cost, not compute: Zebra scores 96 rows in ~9 s after a ~95 s verified download.

## Reproducing

```bash
conda activate ourobion-inference           # py3.12, torch 2.4.1+cpu, transformers 4.44.2
cd model-training
set -a && . .env && set +a                  # MODEL_R2_* (read-only, model bucket)

python experiments/2026-07-31-disagreement-pilot/scripts/sample_conclusions.py
python experiments/2026-07-31-disagreement-pilot/scripts/sample_zebra_pairs.py

PYTHONPATH=src python -m ourobion_model_lab.cli predict \
  --model viceroy-v0 --input-manifest viceroy-pilot-clean.jsonl --output viceroy-pilot-preds.jsonl
PYTHONPATH=src python -m ourobion_model_lab.cli predict \
  --model zebra-v1   --input-manifest zebra-pilot-clean.jsonl   --output zebra-pilot-preds.jsonl
```

Then label blind with a non-Claude-family model and join on `row_id`.

`row_id` uniqueness matters: the first sampler truncated `paperUid` to 24 chars and produced a
collision, which the runner's duplicate-`row_id` guard caught before scoring. That guard is load
bearing — keep the index suffix.

## Files

| Path | What |
|---|---|
| `scripts/corpus_survey.py` | Read-only corpus lister/fetcher; no guard bypass |
| `scripts/sample_conclusions.py` | Viceroy conclusion-sentence sampler |
| `scripts/sample_zebra_pairs.py` | Zebra claim/evidence builder with pooled BM25 |
| `data/*-pilot-inputs.jsonl` | Sampled rows with provenance (`_topic`, `_cued`, uids) |
| `data/*-pilot-clean.jsonl` | Schema-valid runner inputs |
| `data/*-pilot-preds.jsonl` | Model outputs with logits/probabilities/model identity |
| `data/haiku-*.tsv` | Haiku labels, joined on `row_id` |
| `data/ADJUDICATE-*.tsv` | Blinded sheets — 46 Viceroy, 41 Zebra |
| `data/*-key.json` | Which label came from which system |
