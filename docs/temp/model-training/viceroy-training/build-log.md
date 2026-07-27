---
title: Viceroy Causal-Language-Risk v0 — training build log (resumable)
summary: Resumable state for the MT4 Viceroy build. The portable bundle (code, tests, docs, licence gate) is complete and its split/leakage design is verified against the real corpus; the corpus schema check found no PMID column, which invalidates the training plan's PMID-grouping requirement and leaves same-paper leakage uncontrolled. Nothing has been trained and no corpus data is committed.
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Viceroy Causal-Language-Risk v0 — training build log

Issue: [#168](https://github.com/uandiqueue/ourobion/issues/168)
Branch: `feat/model-training/mt4-viceroy-bundle` (cut from `dev-phase2-run4`)
Task claim: `mt4-viceroy-bundle` / `claude` / `agentjwork`

**▶ RESUME AT: S5 — record the GPL-3.0 determination, then run the bundle on the target machine.**

This is the **priority-2 model** from the run-2 decision: *"Train Zebra first. Then rescoped
Viceroy if it clears."* The model trained is `viceroy-causal-language-risk-v0`, not
`viceroy-claim-kind-v0` — the rescope was accepted in full during review and is enforced in code,
not just in prose.

## Worklist

| Step | What | Status | Notes |
|---|---|---|---|
| S0 | Corpus schema + licence survey | **done** | Verified against the real file. Found the PMID blocker below |
| S1 | Bundle skeleton mirroring `zebra-training/` | **done** | Same shape, so a reader of one can read the other |
| S2 | Implement `src/viceroy/**` | **done** | config · data · splits · metrics · model · cli |
| S3 | Tests | **done** | 160 pass, 2 skip without torch. No network, no ML stack needed |
| S4 | Verify the split pipeline against the real corpus | **done** | Numbers in `LEAKAGE.md`; corpus stayed in scratch, never committed |
| S5 | Record the GPL-3.0 determination | **queued** | **Blocks everything.** Substrate fails closed without it |
| S6 | Fetch + hash the corpus on the target machine | queued | ~420 MB, dominated by BiomedBERT |
| S7 | CPU smoke on fixtures | queued | |
| S8 | Train (single seed, one held-out fold) | queued | Main compute — deliberately last |
| S9 | Evaluate and write up | queued | |

## S0 findings — the corpus is not what the plan assumed (2026-07-27)

Verified directly against the distributed file at pinned commit
`7ca243a00ec07f1c63fd9ac5b0acc9cac3a6a596` (repository last updated 2020-10-27).

**Blocker — there is no PMID.** The training plan §6 requires folds "grouped by PMID so no paper's
sentences straddle folds". The released labelled file has exactly two columns, `sentence` and
`label`. The repository's *unlabelled* sample file (`sample_new_sentences.csv`) does carry a `pmid`
column, so the authors had paper ids and did not publish them with the labels.

This is not recoverable by being careful. Measured: one identified paper's three conclusion
sentences have pairwise Jaccard similarity **0.22–0.24** and land in three different folds. No
threshold separates that from ordinary topical overlap — 590 pairs already sit at 0.25–0.40.

**Consequence, recorded rather than papered over:** exact-duplicate and boilerplate leakage are
controlled; **same-paper leakage is not**, and results carry an unquantified optimistic bias. The
full measured picture is in [`LEAKAGE.md`](./LEAKAGE.md).

**Related finding — the published anchor is row-level.** Upstream `main.py` uses
`StratifiedKFold(n_splits=K, shuffle=True, random_state=0)` over sentences, with no grouping. So
the plan's external anchor of **0.90 accuracy / 0.88 macro-F1** is not comparable to a group-safe
number, and the plan's ≥0.80 promotion threshold inherits that mismatch. A group-safe score is
expected to be lower; falling short of 0.80 is therefore weaker evidence of failure than the plan
implies.

**Corpus facts confirmed.** 3,061 rows. Class counts exactly as the plan states — `no relationship`
1,356 (label 0), `direct causal` 494 (1), `conditional causal` 213 (2), `correlational` 998 (3);
imbalance 6.4:1, majority-class accuracy **0.443**. Token lengths: min 3 / median 18 / p90 30 /
max 57, so the plan's 256-wordpiece cap never binds. Eight exact-duplicate rows. **One sentence
carries two different labels** — an annotation conflict, dropped by default and counted.

**Licence.** Repository is GPL-3.0 (full text at the pinned commit, fetched and hashed alongside
the data). The determination remains unrecorded, so the model is blocked at S5.

## S4 findings — the split pipeline, measured (2026-07-27)

Run against the real corpus in a scratch directory; **no corpus data was committed to the repo**.

| Quantity | Value |
|---|---|
| Rows kept after dropping the conflicting-label pair | 3,059 |
| Exact-duplicate rows collapsed · near-dup links | 8 · 7 |
| Groups | 3,044 (11 multi-row, largest 5) |
| Fold class balance | within **1 row** per class across all 5 folds |
| Residual pairs ≥ 0.60 crossing a fold | **45** — all citation/registration boilerplate |
| Pairs ≥ 0.80 crossing a fold | **0** (non-zero would be an assignment bug) |
| Wall-clock | ~1 second, CPU, no ML stack |

**Cue-lexicon baseline, measured** (the bar the encoder must beat): macro F1 **0.539**, 95% CI
[0.514, 0.560] group-resampled; balanced accuracy 0.526; accuracy 0.599 against the 0.443 majority
baseline. Directional cells: causal→correlational n=22 (rate 0.031); **correlational→causal n=123
(rate 0.123)** — the dangerous direction.

## What differs from the Zebra bundle, and why

Same shape and conventions throughout, so a reader of one can read the other. The differences are
all consequences of either the task or the Zebra leakage incident:

| Area | Zebra | Viceroy | Why |
|---|---|---|---|
| Fold assignment | size-balanced, then asserted | **class-balanced by construction**, then asserted | An assertion at the end reports an unusable split; it cannot produce a usable one |
| Split source | inherits the corpus's official train/dev | **builds its own folds** over the whole corpus | An inherited split is someone else's judgement about leakage |
| Grouping | claim↔abstract components | text ∪ near-duplicate ∪ (pmid) union-find | No paper id exists; the surrogate is explicit about its recall limit |
| Residual leakage | not reported | **`residual_leakage_audit`** at a lower threshold | Reports what grouping missed instead of claiming zero |
| CLI | — | **`splits` subcommand** | Inspect the split before spending compute, not after |
| Preflight guard | label-blind signature check | **scope-boundary check** on `CONTRACT_MAP` | The rescope is this model's equivalent load-bearing invariant |
| Loss | plain CE | **class-weighted CE** (train split only, never tuned) | 6.4:1 imbalance |
| Licence gate | `status == approved` | **+ complete `gpl3_determination`** | GPL-3.0 data, legally unsettled propagation to weights |
| Metrics | — | **`directional_confusion_report`**, `accuracy` bundled with the majority baseline | One confusion cell is dangerous; accuracy alone is meaningless at 0.443 |

## Ledger

| When | Step | What ran | Outcome |
|---|---|---|---|
| 2026-07-27 | S0 | GitHub API + raw file fetch of the corpus, LICENSE listing, upstream `main.py`; schema/class/duplicate analysis in scratch | PMID blocker found; class counts and licence confirmed; row-level upstream split confirmed. **Nothing committed, nothing trained** |
| 2026-07-27 | S1–S3 | Bundle authored; `python -m unittest discover` | 160 pass, 2 skip (no torch). No network, no ML stack |
| 2026-07-27 | S4 | Split pipeline + cue baseline against the real corpus, in scratch | Numbers above. **No corpus data committed, no compute beyond ~1s of CPU** |

## Standing limits for whatever this produces

Single seed, one grouped split, no independent audit set — **preliminary**. Same-paper leakage
uncontrolled and unquantifiable from this corpus. Non-serving unconditionally: no influence on
`EdgeVerification`, `claimKindCheck`, edge score, cards, routing or spend, and no A10
short-circuit. `mechanistic` is never predicted; `no_relationship` never grounds
`RelationKind.no_effect`. A documented no-go remains a valid outcome, and a blocked GPL-3.0
determination is a valid completion state.
