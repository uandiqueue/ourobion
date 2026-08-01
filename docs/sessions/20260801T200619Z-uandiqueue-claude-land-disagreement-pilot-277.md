---
title: Land the Zebra/Viceroy vs Haiku disagreement pilot as citable evidence, minus its verbatim paper text
summary: The pilot was gitignored by a deliberate licence guard, not by accident. Landed only the derived artifacts — predictions, label keys, our scripts — using the repo's own named-allow convention, and left every file carrying verbatim third-party paper text ignored. row_id values are DOIs, so sources stay referenced rather than redistributed.
type: session
scope: model-training
status: canonical
updated: 2026-08-01
---

# Landing the disagreement pilot as submission evidence

Branch `chore/model-training/land-disagreement-pilot-277`, cut from `main` @ `5a5af7c`.
Phase 0 of the #328 housekeeping run, but the territory is `model-training/`, so it is filed
against **#277** — #328 explicitly owns `docs/**` only.

## Why this needed care

`.gitignore` ignored `/model-training/experiments/` **deliberately**: the comment records that
`git add -A` once swept four files in via PR #311, "caught only as a model-training lint failure,
not as a licence gate". The adjacent rules state the policy — PMIDs/labels/manifests are the
committed artifact, corpus text is never committed.

Inspecting the pilot before committing showed the guard was doing real work. Six files carry
**verbatim third-party paper text**:

- `*-pilot-inputs.jsonl` — full `claim_text` / `evidence_text` / `conclusion_sentence` passages
- `*-pilot-clean.jsonl` — same, post-filtering
- `ADJUDICATE-*.tsv` — adjudication sheets with the sentences inline

Committing those to a **public** repo would redistribute excerpts from third-party papers. Open
access is not blanket redistribution permission, and it is exactly what the guard prevents.

## Changed

Landed **10 derived files**; the 6 text-bearing files stay ignored.

- `README.md` — the analysis (verified: no long verbatim quotes)
- `data/{zebra,viceroy}-pilot-preds.jsonl` — labels, logits, probabilities, `model_identity`, `row_id`. No prose.
- `data/{zebra,viceroy}-key.json` — model/Haiku label pairs
- `data/haiku-labels.tsv`, `data/haiku-zebra-labels.tsv` — label columns
- `scripts/*.py` — our own sampling/survey code

**Reproducibility is preserved without redistribution:** `row_id` values are DOIs
(`nao-doi:10.3390/ijerph230505#000`), so anyone can re-fetch the source and recompute the
disagreement rates from preds + keys.

## Decided

- **Named-allow, not glob.** The first attempt re-excluded text by glob
  (`*-inputs.jsonl` etc). Replaced after reading the #266 convention documented a few lines
  below in the same file: name reviewed fixtures **one by one**, because "a directory-wide
  negation would mean anyone who dropped a downloaded corpus in that folder would commit it".
  The final rule re-includes the data dir (git cannot re-include a file whose parent dir is
  excluded), re-excludes it wholesale with `data/*`, then names the six permitted files.
  Default-deny with an explicit allowlist, matching the house style.
- **Ordering matters.** The negations sit *after* the `/model-training/**/data/` and
  `/model-training/**/*.jsonl|tsv` rules, since last-matching-pattern wins.
- **Filed under #277, not #328.** #328's territory clause is `docs/**` only.

memory: none — this applies an existing documented convention (#266 named-allow) to a new
directory rather than establishing a new architectural fact.

## Verification

- `git add -n` lists exactly the 10 intended files, no more
- all 6 text-bearing files return `git check-ignore -q` true
- canary: a hypothetical `data/some-downloaded-corpus.jsonl` is still ignored, so default-deny holds
- `node tools/context_sync.mjs --check` — passed
