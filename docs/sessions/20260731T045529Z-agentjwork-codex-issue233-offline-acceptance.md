---
title: Issue 233 offline acceptance reconciliation
summary: Added a provider-free full-mode acceptance preflight and extended exact-byte hash pinning to R2 no-prune loads.
type: session
scope: brain
status: canonical
updated: 2026-07-31
---

# Issue 233 offline acceptance reconciliation

Issue: #233 · branch: `feat/brain/issue233-offline-acceptance` · base: exact Run 4 head
`3557f75c3565055848c2c2c7427ae680a6a4989d` · target: `dev-phase2-run4`

## Attempted

- Reconcile the bounded offline-first part of #233 against the exact requested Run 4 head after
  reading #233, #240, #246, the current handoff comments, provider evidence, and the semantic graph.
- Add the smallest tracked acceptance command that can prove frozen input identity, A8 post-processing,
  built-in A9 quote checking, mandatory A10 full-mode dry-run retrieval, family separation, and redacted accounting without
  importing a provider transport, R2 store, or database loader.
- Harden incremental R2 projection so `--from-r2 --no-prune` cannot load unpinned mutable bytes.
- Run all affected package checks. No provider, R2, Supabase, Docker, deployment, or hosted write was
  performed.

## Changed

- Added `brain-ingest offline-acceptance --bundle <file> --dry-run`. Its bundle freezes the acceptance
  run id, artifact revision, metric pair, paper ids, corpus, and synthesis response. Relative regular
  files must remain under the bundle directory.
- The command validates the checked-in router config and pairwise synthesis/verifier family separation,
  assembles A8 input, gates the frozen A8 response through the real schema/copy/quote post-processor,
  and passes accepted claims through the real A9/A10 verifier in mandatory dry-run mode.
- Its redacted manifest records only hashes, configured model identity source, attempt/token/cost/latency
  zeros, quote-check results, non-empty full-mode retrieval counts, exact frozen-input hashes, the exact
  staged claims JSONL hash, and artifact staging posture. It stores no prompt text,
  key, endpoint, raw body, or database target.
- Added negative coverage for fabricated quotes, quoteCheck-only triage, attempts to leave dry-run,
  descriptor mutation/replacement races, symlink inputs, exact claims JSONL bytes, and a CLI-level fetch
  trap proving no provider/network path is reached.
- Extended the edge loader's mandatory dual SHA-256 pin from local `--from-dir --no-prune` to
  `--from-r2 --no-prune`, before R2 client construction or database handling.
- Kept workflow Action pinning out of this slice after review; those unrelated workflow edits were reverted.

## Decided

- This first PR is an offline acceptance preflight, not the live two-leg acceptance run. Provider calls
  remain separately gated; production router assignments and Agnes acceptance-only posture are unchanged.
- Raw provider evidence remains staged locally by the existing synthesis/verification sidecars. R2
  publication and database projection are not composed here because no provider-backed artifact was
  produced and no hosted mutation was in scope for this reconciliation.
- Owner order and ceilings were recorded without spending: Anthropic maximum SGD 2, OpenAI maximum SGD
  20, Agnes maximum 20 calls. Calls used by this session: Anthropic 0, OpenAI 0, Agnes 0.
- Agnes identity must continue to come from the `POST /v1/chat/completions` response; no `GET /models`
  criterion was added. Agnes stays acceptance-only and unassigned in production.

## Verification

- Brain-ingest TypeScript check: clean; complete offline suite: 401 passed, 0 failed.
- Edge-loader TypeScript check: clean; complete offline suite: 69 passed, 0 failed.
- Regression coverage proves mandatory non-empty A10 full mode, quoteCheck-only rejection,
  descriptor-bound mutation/replacement detection, symlink rejection, exact staged claims JSONL hashing,
  and R2 hashing of exact downloaded bytes before decoding.
- Repository context check and diff whitespace check passed; the net diff against the exact Run 4 base
  contains no workflow changes.
- No provider call, cloud/R2 write, database mutation, Docker start, or secret output occurred.

## Left

- Review and land this coherent offline first PR into `dev-phase2-run4`.
- Supply/review a real two-paper quote-valid acceptance bundle, then separately execute the approved
  provider legs under the router journal and the owner's ordered ceilings.
- Only after provider-backed artifacts exist: publish claims, verifications, and raw-evidence sidecars
  under reviewed exact R2 keys; stage the exact downloaded bytes locally; run the hash-pinned
  `--from-dir --no-prune` loader; and retain publication/load receipts.
- Complete the hosted 14+7/B-PL15 evidence in #240/#246. Nothing in this session claims that acceptance.

## Blockers

- None for the reviewed offline-first slice. The Windows sandbox helper disappeared after baseline
  testing; final local validation used the approved elevated command path. Source edits were made only through
  the dedicated Codex apply-patch engine; no shell or Python source-write workaround was used.

memory: none
