---
title: Issues 233 and 280 live acceptance prerequisites
summary: Added deterministic evidence classification, authoritative citations, and a fail-closed ordered live-provider acceptance facade.
type: session
scope: brain
status: canonical
updated: 2026-07-31
---

# Issues 233 and 280 live acceptance prerequisites

Issues: #233, #280; related: #240, #246; branch: `feat/brain/issue233-live-acceptance`;
base: exact Run 4 head `5ba4b35ad30e873e26bd1072a794439ffc4aa169`; target:
`dev-phase2-run4`.

## Attempted

- Complete the provider-free implementation prerequisites for the approved #233 acceptance order:
  Anthropic synthesis, OpenAI synthesis, then Agnes verification.
- Subsume #280 as a bounded A5 unit: retain structured PubMed publication types and MeSH headings,
  classify evidence deterministically, preserve uncertainty, and wire the derived tier projection into
  the verifier corpus without changing shared contracts.
- Prove the path with a frozen two-paper bundle and adversarial offline tests. No provider, cloud, R2,
  database, Docker, deployment, or hosted call was made.

## Changed

- Added a pure evidence-tier classifier. Only exact RCT/systematic-review/meta-analysis publication
  types supply tiers 4-5; publication types never supply tiers 1-3. Exact cohort/cross-sectional MeSH
  headings and Animals-without-Humans supply tiers 1-3, curator attestations are explicit, and keyword
  residue is always review-required.
- Unknown or conflicting evidence retains `tier: null`, an explicit review-required tier-2 floor,
  basis, supervision source, and a deterministic input hash. Corpus rows retain the classifier
  inputs, and loading recomputes the classification/hash instead of trusting standalone labels or
  hashes. The verifier corpus is the rebuildable derived projection; source metadata remains truth.
- Retained PubMed publication-type and MeSH UI/name metadata through discovery, deduplication,
  reconciliation, and paper records. Added exact decoy coverage for Randomized Controlled Trials as
  Topic and Animals-plus-Humans.
- Made manifest/corpus title, year, and evidence tier authoritative during synthesis
  post-processing, overwriting model-supplied citation metadata.
- Added the tracked two-paper offline fixture. The cited quote must pass the existing quote gate and
  the verifier must independently retrieve the exact second paper; the manifest records that paper id.
- Added an explicit `live-acceptance --execute --leg ...` facade. Every invocation first reruns the
  offline preflight, requires an exact clean Git revision, advances one ordered leg, uses only the
  repository router, and writes hash-bound state, journal attempts, primary artifacts, and raw response
  sidecars under the one exactly ignored task root. Resumption re-hashes every prior artifact, checks
  exact journal logical-id sets, and requires every reserved/started attempt to have exactly one
  terminal outcome.
- Replaced permanent owner-specific call/spend ceilings with a frozen finite runtime authorization.
  It includes an id, non-empty owner/currency-conversion basis, validity window, and per-provider
  maximum/prior POST starts and reserved USD. Its canonical hash, id, and human-readable basis bind
  the state and every journal event; aggregate accounting includes declared prior use.
- Added deterministic protected-env loading from repo `.env`, optional tool-local `.env`, then
  explicit process environment, with the process environment winning. Secret values are never
  reported by the facade.
- Made every persisted artifact path relative to its authorization-specific task root rather than
  the repository. State/journal overrides and completed artifacts cannot enter a sibling
  authorization root; every parent is resolved canonically and every state, journal, artifact, and
  temporary-state file is required to be an ordinary non-symlink file before reads/writes. Windows
  junctions and dangling link entries fail before provider dispatch.
- Kept Agnes identity provider-attested from POST responses and Agnes acceptance-only. No GET /models
  behavior was added. Synthesis and verification families remain decorrelated.
- Added finite effective price windows and source provenance. Anthropic Sonnet 5 uses the
  official launch price page (anthropic.com/news/claude-sonnet-5), expiring 2026-09-01; GPT-5 uses the
  official model page (developers.openai.com/api/docs/models/gpt-5), conservatively expiring
  2026-08-08. Agnes free pricing is also bounded to a finite owner-confirmed window. Acceptance fails
  closed outside those windows. Owner SGD limits and their conservative SGD-to-USD conversion remain
  runtime authorization inputs, not hardcoded system policy.

## Decided

- Each invocation may execute exactly one leg; there is no combined command that can silently spend
  across all providers.
- The portable checked-in offline bundle intentionally omits `sourceRevision`; an operator must copy
  it to runtime evidence and bind the exact reviewed commit before any live leg can execute.
- #280's acceptance is fully covered by this change and can close when this PR lands. #233, #240, and
  #246 remain open because no live provider or hosted acceptance evidence was produced here.
- No tracked fixture invents or embeds the owner ceilings. A later live operator descriptor must
  explicitly record the owner directive, conservative SGD-to-USD rationale, prior use, finite window,
  and resulting USD/start ceilings before dispatch. Session use: Anthropic 0, OpenAI 0, Agnes 0.

## Verification

- TypeScript: llm-router clean; brain-ingest clean.
- Targeted live-acceptance suite: 11/11. Targeted router acceptance/config suite: 61/61.
- Full suites: llm-router 121/121; brain-ingest 426/426.
- Adversarial coverage includes exact PT/MeSH mappings, uncertainty floors, citation correction,
  independent second-paper retrieval, PT/MeSH dedup/reconciliation/manifest reconstruction,
  revision/dirty/input/state/journal drift, response-without-state crash handling, extra journal ids,
  incomplete retries, raw-sidecar mutation, absolute/cross-drive containment, env precedence, real-Git
  ignored-root cleanliness through leg two, sibling-authorization and Windows-junction rejection,
  final pre-state Git recheck, price/auth expiry, prior-use accounting, and a composed three-leg proof
  through the real `LlmRouter` with mocked HTTP/env/clock and the real hash-chained journal. That proof
  asserts Agnes POST response identity/family/raw hash and that a fourth invocation makes no dispatch.
- `git diff --check` passed. No provider, cloud, R2, database, Docker, deployment, or hosted call
  occurred.
- Independent adversarial re-review: **PASS** after the authorization-task-root containment,
  junction defense, and real-router composed-test blockers were closed. Primary review also passed
  the implementation and security architecture; no reviewer edited the worktree.

## Left

- Local integration remains: commit this exact independently reviewed diff, merge the exact current
  `origin/dev-phase2-run4` without rebasing, and rerun all offline gates. No push or PR is authorized
  in this session.
- After the exact reviewed head is clean and current price windows remain valid, separately execute
  the three owner-approved live legs within the existing journal/call/budget ceilings.
- Reconcile #233/#240/#246 only from the resulting provider-backed evidence; do not infer acceptance
  from these offline tests.

## Blockers

- None for implementation. The Windows Codex sandbox helper remains unavailable; the owner-approved
  isolated ordinary clone and elevated project-bounded tools were used. Every tracked source edit used
  the Codex apply-patch engine; no shell or Python source-write workaround was used.

memory: none
