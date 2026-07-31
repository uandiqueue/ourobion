# Frozen inference-input manifests

Public, frozen JSONL inputs for the offline research inference runner
(issue #266). One line per row, strict schema, no product or user data.

| Model | Manifest | Row schema |
|---|---|---|
| `zebra-v1` | `zebra-smoke-v1.jsonl` | `row_id`, `claim_text`, `evidence_text` |
| `viceroy-v0` | `viceroy-smoke-v0.jsonl` | `row_id`, `conclusion_sentence` |

Unknown fields are refused, `row_id` must be unique, and over-long text is
rejected rather than truncated — a prediction over silently trimmed text would
misrepresent what was actually scored. See
`src/ourobion_model_lab/inference/schemas.py`.

## Why these files are individually un-ignored

`.gitignore` ignores `/model-training/**/*.jsonl` so that a downloaded corpus
can never be committed by accident. Each manifest here is un-ignored **by
name**, not by a directory glob: a `inference-manifests/*.jsonl` negation would
mean anyone who dropped a corpus in this folder would commit it, which is
exactly the accident the extension rule exists to prevent.

Adding a manifest therefore takes a deliberate one-line `.gitignore` change,
and anything added must be public/frozen, carry no restrictively-licensed
corpus text, and contain no product or user data.

## Model-native labels

Predictions use each checkpoint's own label space and are **not** mapped onto
`EdgeVerification.verdict`:

- `zebra-v1` → `supported | contradicted | insufficient_evidence`
- `viceroy-v0` → `no_relationship | direct_causal | conditional_causal | correlational`

Viceroy's classes were read from the shipped checkpoint's `config.json`, which
was downloaded and hash-checked against the frozen manifest. Note that it has
**no `mechanistic` class**, despite issue #266 describing one — the issue was
written from the training plan rather than the shipped artifact.

Both checkpoints remain `validated=false`, `serving_ready=false` and
`public_weights_cleared=false`.
