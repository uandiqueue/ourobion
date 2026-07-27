---
title: MT4 — Viceroy causal-language-risk training bundle, with leakage control reworked
summary: Built docs/temp/model-training/viceroy-training/ as the sibling of the Zebra bundle for the run-2 priority-2 model, reworking fold construction in response to the leakage hit during the Zebra run. Verifying the corpus schema found it ships no PMID, which invalidates the training plan's PMID-grouping requirement and leaves same-paper leakage uncontrolled — recorded rather than papered over. 160 tests pass; nothing trained, no corpus data committed.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# MT4 — Viceroy training bundle

Issue: [#168](https://github.com/uandiqueue/ourobion/issues/168)
Branch: `feat/model-training/mt4-viceroy-bundle` (cut from `dev-phase2-run4`, PR into the same)
Task claim: `mt4-viceroy-bundle` / `claude` / `agentjwork`

memory: none

## Attempted

Jayden asked which model follows Zebra, then for a training bundle like `zebra-training/` for it,
and — mid-build — noted that **the Zebra training run hit data leakage**, to be taken into account
in Viceroy's design.

The answer to the first question is **Viceroy**, rescoped to `viceroy-causal-language-risk-v0`:
[`run2/README.md`](../temp/model-training/run2/README.md) sets it as priority 2, *"only if Zebra
lands"*. That supersedes `model-roster.md` §7 (which puts Viceroy last) and the plan review's
§10.2 one-day list (which puts Leafcutter first) — the run-2 disposition accepted every technical
finding in that review but disputed the ordering on purpose-fit grounds.

## Changed

**New: `docs/temp/model-training/viceroy-training/`** — a portable bundle mirroring
`zebra-training/`'s shape, so a reader of one can read the other.

- `src/viceroy/` — `config` (preregistered recipe + leakage knobs), `data` (4 native classes,
  normalization, corpus reports, the scope-boundary check), `splits` (the reworked core),
  `metrics` (pure stdlib, group-resampled bootstrap, the directional report), `model`
  (class-weighted CE, 4-class head), `cli` (`preflight | fetch | dry-run | splits | smoke | train
  | evaluate`).
- `tests/` — 160 tests, no network, no ML stack (2 skip without torch).
- Docs — `README`, `CONTEXT`, `INTERPRETING-RESULTS`, `OWNER-NOTE`, **`LEAKAGE.md`**, `build-log`.
- `.gitignore`, `setup-macos.sh`, `requirements-macos.txt`, `licence-approval.example.json`,
  `fetch_assets.py`, a synthetic fixture corpus.

**Edited:** `docs/temp/model-training/README.md` — added a portable-bundles table and a pointer
that `run2/README.md` sets the current execution order.

## Decided

**Fold construction, not fold assertion.** Zebra assigns folds by size balance, then asserts no
key spans a boundary — so the assertion is the first thing that knows about a constraint the
assigner never tried to satisfy. Viceroy constructs folds so the invariants hold (whole provenance
groups, class-balanced greedy assignment, deterministic and seed-free) and runs the assertions
afterwards as a double-check. Measured: fold class counts land within **1 row** per class across
all five folds.

**Don't trust an inherited split.** Zebra took the corpus's official train/dev as given. Viceroy
builds its own folds over the whole corpus.

**Report the residual instead of claiming zero.** `residual_leakage_audit` re-scans at a
*lower* threshold than the grouping one and reports what grouping missed. `ViceroyConfig` refuses
an audit threshold above the grouping threshold, since that could only produce a false all-clear.

**A `splits` subcommand.** Builds folds, runs every check, writes `split-artifact.json`, trains
nothing — inspect the split before spending compute.

**Scope boundary enforced in code.** `preflight_check_scope_boundary` is Viceroy's equivalent of
Zebra's label-blindness signature check: `mechanistic` is never predicted, `no_relationship` never
maps to a kind or to `RelationKind.no_effect`, and preflight exits 2 if `CONTRACT_MAP` is widened.

**Stricter licence gate.** GPL-3.0 corpus, so `status: approved` alone is insufficient — a
complete `gpl3_determination` answering the plan's four §4.2 questions with
`permits_intended_use: true` is required, or every gated subcommand exits 2.

## Findings that affect the plan, not just the bundle

Verified against the real distributed corpus at pinned commit `7ca243a0…` (inspection only; the
corpus stayed in a scratch directory and **no corpus data was committed**).

1. **The corpus ships no PMID.** The training plan §6 requires folds "grouped by PMID so no
   paper's sentences straddle folds". The released labelled file has exactly two columns,
   `sentence` and `label`. The repository's *unlabelled* sample file does carry `pmid`, so the
   authors had paper ids and did not publish them with the labels.
2. **Same-paper leakage is therefore uncontrolled, and not fixable by thresholding.** One
   identified paper's three conclusion sentences sit at pairwise Jaccard **0.22–0.24** and land in
   three different folds; another confirmed same-paper pair crosses folds at 0.58. Meanwhile 590
   pairs already sit at 0.25–0.40, so lowering the threshold would merge hundreds of unrelated
   papers. The bundle says this plainly rather than claiming a clean split.
3. **The published anchor is row-level.** Upstream `main.py` uses `StratifiedKFold(shuffle=True,
   random_state=0)` over sentences with no grouping, so the plan's **0.90 accuracy / 0.88
   macro-F1** anchor — and the ≥0.80 promotion threshold set against it — are not comparable to a
   group-safe number.
4. **Measured corpus facts:** 3,061 rows; class counts exactly as the plan states; imbalance
   6.4:1; majority-class accuracy **0.443**; 8 exact-duplicate rows; **one sentence carrying two
   different labels**; token lengths p90 30, so the 256-cap never binds.
5. **Cue-lexicon baseline, measured** — the bar the encoder must beat: macro F1 **0.539**, 95% CI
   [0.514, 0.560] group-resampled. Its dangerous cell (correlational read as causal) is n=123,
   rate 0.123.

## Left

- **S5 — the GPL-3.0 determination is unrecorded**, so the bundle is blocked by design. That is a
  valid completion state, not an obstacle to route around.
- S6–S9 (fetch, smoke, train, evaluate) queued for the target machine.
- The Viceroy training plan still states the PMID-grouping requirement and the ≥0.80 threshold
  against a row-level anchor. Both are contradicted by finding 1 and 3 above. I did not edit the
  plan — it is a preregistered document, and amending it is a separate decision.
- Recovering PMIDs (exact-sentence search against the PubMed API) is the real fix for finding 2;
  `group_policy="pmid"` already works and fails closed until then.

## Blockers

None for this session's scope. The bundle is complete and verified as far as it can be without a
licence determination or the target hardware.

## Notes

- A latent bug was fixed while verifying: `preflight` is documented as working before the ML stack
  is installed, but `_env_report` crashed on a missing torch. It now degrades to a reported
  finding. **`zebra-training/` has the same latent bug** and was not touched.
- Pre-existing and unrelated: an untracked `src/` of Flutter build artifacts sits at the repo
  root. Left alone.
