---
title: Private read-only offline model inference runner
summary: Adds a research-only inference path for the frozen Zebra v1 and Viceroy v0 releases — content-addressed release pins, a stdlib SigV4 read-only R2 client, fail-closed artifact verification, model-native output schemas, and a manual-dispatch-only workflow.
type: session
scope: model-training
status: canonical
updated: 2026-07-30
---

# Private read-only offline model inference runner

Issue: #266
Branch: `feat/model-training/offline-inference-runner-266`

## Attempted

- Build the offline research inference runner described in #266, end to end: model-native prediction
  CLIs, fail-closed artifact acquisition, a manual GitHub Actions workflow, and the test matrix.
- Verify the read-only credential and the pinned release prefixes against the real private bucket
  without downloading weights or loading a model.

## Changed

- `model-training/src/ourobion_model_lab/inference/` — new package:
  - `releases.py` — the pinned release registry.
  - `r2.py` — a stdlib SigV4 client exposing GET and LIST only.
  - `acquire.py` — download + full-manifest verification, with cleanup in a `finally`.
  - `schemas.py` — strict JSONL row schemas and model-native label spaces.
  - `predict.py` — orchestration in a fixed, safety-relevant order.
  - `runners/` — Zebra and Viceroy, with Torch/Transformers imported inside functions.
- `cli.py` — a `predict` subcommand, deliberately outside `JobSpec.execute()`.
- `.github/workflows/model-inference.yml` — `workflow_dispatch` only, `contents: read`, gated on the
  `model-inference` environment, closed choice lists for model and manifest.
- `model-training/inference-manifests/` — two frozen public JSONL manifests plus a README, with two
  **individually named** `.gitignore` negations.
- `model-training/.env.example` — the four `MODEL_R2_*` names, no values.
- README — a `predict` section and the updated layout.
- Seven new test modules; the suite goes from 158 to 281 tests.

## Decided

- **The release id authenticates the digests, so they are not duplicated.** Writing six SHA-256
  literals per model into `releases.py` would have put them in two places with nothing detecting
  drift. Instead each release is pinned by `sha256(local-bundle-sha256sums.txt)` — which is how the
  #250 prefixes were named — and `load_release()` re-derives that digest before reading the per-file
  hashes out of the manifest it just authenticated. One pin per model instead of six, and the six
  cannot be edited independently.

- **Class order is resolved by name from the checkpoint, never positionally.** This is what caught
  the finding below. A positional assumption fails silently: every row comes back confidently
  mislabelled and the output file looks completely normal.

- **No boto3.** SigV4 is ~80 lines of `hmac`, the zero-install core CI job could not install a
  dependency anyway, and header-signing (rather than presigned URLs) means no credential-bearing URL
  can ever reach a log, a traceback, or a shell history.

- **Bounds refuse rather than truncate.** A prediction over silently trimmed text misrepresents what
  was scored, which is worse than no prediction because it looks like a result.

- **`.gitignore` negations are per-file, not a directory glob.** A `inference-manifests/*.jsonl`
  negation would mean anyone dropping a corpus in that folder commits it — precisely the accident the
  extension rules exist to prevent.

- **`predict` bypasses `JobSpec.execute()` deliberately.** It trains nothing and reads no dataset, so
  the licence-approval and data-manifest gates have nothing to check; its gates are the release
  registry and artifact verification instead. Recorded here because `cli.py`'s own docstring warns
  against exactly this bypass for the training subcommands.

## Finding — Viceroy v0's label space is not what #266 describes

Issue #266 specifies Viceroy's four classes as
`correlational | causal_claim | mechanistic | none` and requires that the runner "must never
manufacture `mechanistic`".

The shipped checkpoint declares something different. Its `config.json`, downloaded from the pinned
private release and hash-checked against the frozen manifest, contains:

```json
{"0": "no_relationship", "1": "direct_causal", "2": "conditional_causal", "3": "correlational"}
```

There is **no `mechanistic` class at all**. The issue was written from the training plan rather than
the shipped artifact. The declared label space now follows the checkpoint, and the "never manufacture
`mechanistic`" requirement is met structurally — it is outside the closed set, so no threshold,
tie-break or rounding rule could emit it.

Two consequences worth carrying forward:

- The distinction Viceroy actually draws is **direct** vs **conditional** causal language, which is a
  finer claim than "causal". `no_relationship` is its null class, not a generic "none". Anything that
  later consumes these predictions must use the checkpoint's meanings.
- A bare `causal` is deliberately **not** in the alias table: resolving it would have to pick one of
  the two causal classes, and picking is exactly what an alias table must not do. It fails closed.

Zebra v1, by contrast, matched the assumed space exactly:
`{0: supported, 1: contradicted, 2: insufficient_evidence}`.

## Verification

Offline:

- `python -m unittest discover -s tests` — **281 passed** (158 before this change).
- `ruff format --check` — 52 files already formatted. `ruff check` — all checks passed.
- `mypy` — no issues in 31 source files.
- Import purity asserted in a subprocess: importing the inference package or `cli.py` pulls in no
  torch/transformers/numpy/scipy/sklearn/datasets.

Live, against the real private bucket (read-only credential, no weights loaded):

- Credential resolved and redacted in `repr` as designed.
- Both pinned prefixes listed successfully — a SigV4 canonicalisation bug would have surfaced as 403.
- Each prefix contains **exactly** the six expected filenames, no extras, no nesting.
- `config.json` downloaded for both models (883 and 941 bytes) and **hash-matched** the frozen
  manifest, exercising the real download-and-verify path against real bytes.

## Review round — four blocking findings on PR #270, all fixed

Review at head `f2f81b0` returned changes-required. All four were real; none were disputed.

1. **A completely failed forward pass reported success.** `run_inference` hardcoded `ok=True`, so a
   run whose every batch raised — the runner catches batch exceptions and emits `status=error` rows,
   so this is reachable — still exited 0. A green acceptance run proving nothing is the worst
   possible outcome for this job. `ok` is now `rows_error == 0`; error rows are still written so the
   evidence survives, and the completion log drops to WARNING when not ok.

2. **The bucket and endpoint were documented but not enforced.** `credentials_from_env` accepted any
   non-empty bucket, and `MODEL_ARTIFACT_BUCKET` was only used to build release identity. A
   `MODEL_R2_BUCKET` typo pointing at the corpus bucket would have been accepted silently. Added
   `assert_allowed_target()`: exact bucket, `https` scheme, `.r2.cloudflarestorage.com` host suffix,
   no userinfo, no path/query/fragment. Called from both `credentials_from_env` and the client
   constructor, because credentials can be built directly.

3. **CRLF checkout broke the content-addressed manifests on Windows.** This one I had the evidence
   for and failed to connect: I computed the CRLF digests (`e3806b3b…`, `45cbf55c…`) while verifying
   the release ids, observed they did not match, and treated that as confirmation of the LF form
   rather than as a hazard on the repo's Windows-native dev machine, where `core.autocrlf=true` makes
   CRLF the *checked-out* form. Every inference run and the tracked-pin tests would fail there while
   passing on Linux CI. Fixed with `text eol=lf` in `.gitattributes` for both manifest globs, plus
   test writes switched from `write_text` to `write_bytes` (universal-newline translation had the
   same effect in synthesized fixtures), plus assertions that no tracked manifest contains a CR byte.

4. **Floating action tags in a credentialed workflow.** `setup-python@v5` and `upload-artifact@v4`
   were tags, and setup steps run in the same job that later receives the R2 secrets. Both pinned to
   commit SHAs; a test now requires every `uses:` in the workflow to be a 40-character SHA.

Added `tests/test_inference_review_regressions.py` (19 tests). Suite: 281 → **300**.

## Local live run — both models, real weights, full pipeline

Run on this device (WSL2/Linux) after the review fixes, at branch head `2128ae3`. Owner-authorised.
Conda env `ourobion-inference`, Python 3.12.13, `torch 2.4.1+cpu`, `transformers 4.44.2` — the exact
`constraints.txt` pins.

| | Zebra v1 | Viceroy v0 |
|---|---|---|
| Release | `sha256-e1d09fbd…` | `sha256-751fbf1f…` |
| Verified bytes | 438,938,903 (6/6 files) | 438,942,033 (6/6 files) |
| Download + verify | 75.0 s | 30.8 s |
| Inference | 3.1 s | 2.8 s |
| Rows | 5 ok, 0 error | 6 ok, 0 error |
| Input manifest sha256 | `ef3c9a38…` | `c4a0e745…` |
| Output sha256 | `abb0a621…` | `152762c8…` |

Both exited 0. No `ourobion-zebra-v1-*` / `ourobion-viceroy-v0-*` temp directory survived either run,
so the `finally` cleanup holds against real 419 MB bundles, not just fixtures.

### Viceroy's output corroborates the `id2label` finding

Every prediction landed at ~0.997 on the semantically right class:

- "…was **associated with** shorter transit times" → `correlational`
- "These results **demonstrate that** increased fibre **shortens** transit" → `direct_causal`
- methods sentence about recruitment window → `no_relationship`
- "**correlated with** next-day mood" → `correlational`
- "**Reducing** screen exposure **advanced** sleep onset" → `direct_causal`

That alignment is independent evidence that the checkpoint's four classes really are the ones read
from `config.json`, and that resolving the permutation by name produced the right mapping. A
scrambled mapping could not have produced this pattern.

One row I wrote intending `conditional_causal` ("Among participants with low baseline intake…
whereas no effect in those already meeting the recommendation") came back `direct_causal`. Arguable
rather than wrong — the sentence does assert a direct effect within a subgroup. `conditional_causal`
drew zero predictions across the six rows, so that class is unexercised.

### Zebra shows a `contradicted` bias worth flagging

3 of 5 rows match my expectation; `supported` was never the argmax; confidences are far lower
(0.60–0.80 versus Viceroy's 0.997). The two misses are both rows whose evidence plainly supports the
claim.

The mapping is very unlikely to be the cause: the unambiguous `contradicted` rows (evidence reporting
no significant difference; a "no relationship" claim contradicted by its evidence) and the
`insufficient_evidence` row (irrelevant methods text, 0.82) are all confidently correct. Swapping
`supported`/`contradicted` would break those three to fix two.

**Five hand-written rows are a smoke test, not an evaluation.** This says the pipeline runs and the
labels are wired correctly; it says nothing rigorous about model quality, and `validated=false`
remains exactly right for both checkpoints.

### This is not §5 acceptance evidence

It is a local run. There is no Actions run URL, no runner image, no GitHub-recorded tool versions.

**§5 as written cannot currently be executed at all**: GitHub only dispatches a `workflow_dispatch`
workflow that exists on the *default* branch, and `model-inference.yml` lives on this feature branch
targeting `dev-phase2-run4`. A dispatch attempt returns
`HTTP 404: workflow model-inference.yml not found on the default branch`. `main` is off-limits, so
the workflow becomes dispatchable only after the owner-gated `dev-phase2-run4` → `dev-phase2` → `main`
promotion. That is a sequencing constraint #266 did not anticipate.

## Left

- **The full live acceptance run in #266 §5 has not been performed.** It needs a `workflow_dispatch`
  of `model-inference.yml` after the GitHub `model-inference` environment has its two secrets and two
  variables set. No forward pass has run against real weights, so the runners' tokenisation and
  batching are proven by construction and unit tests, not by a completed inference.
  **#266 stays open after this PR merges**, per review, until both private live runs and the
  remaining external evidence (run URLs, tool versions, input/output hashes, timing, credential-scope
  confirmation, upload-token revocation) exist.
- **A Windows run of the suite has not been performed from this session** — this device is WSL/Linux.
  Finding 3's fix is asserted by a CR-byte invariant that runs on every platform, but the first real
  Windows execution is still owed.
- The temporary read/write upload credential from #250 should be revoked now that the read-only path
  is proven.
- Per-file byte sizes are pinned only for the weights file and the bundle total; the other five were
  never measured and are not invented. SHA-256 subsumes a length check, so this costs no strength.

## Blockers

- None for the code. The live run is gated on human setup of the GitHub environment.

memory: none
