---
title: Complete hackathon attribution, sponsor framing, pending usage markers, and GMI constraint record
summary: Added the required attribution and GMI record, rewrote the five-pillar submission, reset owner-governed documents to unverified, and documented the GitHub-centered multi-device orchestrator and token-aware delegation model.
type: session
scope: repo
status: canonical
updated: 2026-08-02
---

# Hackathon attribution, GMI constraint, and submission corrections

Branch: `docs/phase4/stale-updates-328`. Collaborative local session with the owner. Nothing was
pushed, committed, or posted to GitHub.

## Attempted

- Make the Launchpad submission attribution-complete and sponsor-aware without inventing usage.
- Remove unreconciled measured API call/spend claims from current submission-facing documents while
  preserving dated reports as historical records.
- Record the GMI Cloud access attempt exactly as reported by the owner and distinguish it from actions
  performed by the model-training build.
- Keep the owner's private project-origin memory machine-local while retaining one ignored repo-local
  copy.
- Reset owner-governed documentation authority before the joint push, then encode the owner-only
  verification gate and the multi-device main-orchestrator practice.

## Changed

- Added `docs/implemented/README.md` as an unverified, code-backed current-state landing page after a
  repository-wide audit found that several canonical implementation documents mix shipped behavior
  with target architecture.
- Moved the cross-application runtime seam and insight-engine architecture into
  `docs/implemented/shared/`, then corrected active documentation and source-code references.
- Applied Jayden's verification to the Launchpad rules and both local Agnes documentation
  references.
- Applied Jayden's owner-verification stamp to memories 0002, 0003, 0007, 0013, 0019, and 0024,
  and promoted the regenerated memory index to canonical.

- Added root `ATTRIBUTION.md`, crediting OpenAI, Agnes AI, Anthropic, GMI Cloud,
  Microsoft BiomedNLP-BiomedBERT, SciFact, the Yu/Li/Wang corpus, literature sources, Cloudflare,
  Supabase, Flutter, Next.js, fonts, generated assets, and dependency manifests. Zebra is attributed
  to SciFact only; no disproven training source was added. Jayden signed and dated the document on
  2 August 2026.
- Updated `submission/writeup.md`: five required pillar headings retained; body rewritten as a
  780-word judge-facing story rather than an audit report;
  GPT-5, Agnes 2.5 Flash, and GMI named in the body; Agnes framed as an enforced different-vendor
  verification layer; low-level budget, stopwatch, usage-ledger, and implementation figures kept out
  of the narrative. One appendix follows the story's evidence trail rather than restoring the former
  nine-section report dump.
- Removed the specific anecdote from the owner's earlier project after confirming it was private
  explanatory context rather than Launchpad evidence. Kept only Ourobion's own router invariant and
  the general Swiss-cheese reliability framing. Recorded this provenance correction in
  `docs/development/what-we-got-wrong.md`.
- Running the router check also disproved the body’s copied US$1/day/node cap: current config reports
  US$8/day/node. The narrative no longer spends words on that implementation figure; the correction
  is recorded in `what-we-got-wrong.md` and config remains authoritative.
- Updated `plan/demo-runbook.md` and `plan/system-connection-map.md` so all current measured API calls,
  spend, and per-paper API cost use greppable pending markers. Configuration values remain concrete.
- Updated `model-training/human-gates.md` with the owner-recorded facts: sponsor credit redeemed;
  NVIDIA H100 contact-sales form submitted 2026-07-27; no reference, confirmation email, response, or
  entitlement within the challenge window; no GMI container, key, bucket, or training run created.
- Added memory 0018: Ourobion's current team is Jayden, Alton, and Janson. Two-person wording is
  historical origin context only.
- Added an exact `.gitignore` rule for `PROJECT_MEMORY.local.md` and created that single ignored local
  memory copy. No private origin-story text was added to this tracked session record or any issue.
- Audited the current card lifecycle against code, sessions, and GitHub PRs #191/#370: archive and
  reset are reversible user-card status changes and do not alter the stored rule or verified edge.
  Removed archive state from the write-up's pipeline proof.
- Reset every scoped `canonical`/`accepted` document under `docs/memory/`,
  `docs/development/decisions/`, `docs/hackathon/`, and the root of `docs/` to `unverified`, while
  retaining draft, stale, and superseded lifecycle states. Added unverified front-matter to the two
  Agnes reference copies without changing their bodies.
- Updated `AGENTS.md`, `tools/context_sync.mjs`, and `docs/engineering-practice.md` with the owner-only
  verification gate, GitHub issue/comment control plane for multi-device orchestration, and
  token-aware delegation to cheaper bounded subagents.
- Reorganised `docs/engineering-practice.md` around the actual operating flow: authority and truth,
  orchestration and isolated worktrees, executable boundaries, verification, GitHub delivery, and
  correction. Added the explicit one-issue/branch/worktree procedure, dated test-suite counts, and
  the complete skip inventory: 25 deferred PNG size checks, one deferred 1.6× text-scale overflow
  check, and one Windows-only PowerShell parsing check.
- Rebuilt the root `README.md` as a product-first human front door: defined One Health without
  overstating implemented domains; explained Biotope and Nao, their audiences, and why insights
  matter before introducing the brain; showed their evidence-to-insight relationship; retained
  source-run instructions with an explicit no-downloadable-APK status; preserved the repository
  guide route; and added the three team members plus a pending project-contact placeholder.
- Added the owner-supplied shared test credentials to the root README. Both Nao and Biotope access
  are explicitly viewer-only; Biotope opens a preseeded demonstration profile so reviewers can see
  trends and insight cards without entering observations. Marked the account public, its health data
  as demonstration data, and clarified that local Supabase auth is separate.
- Added the owner-defined canonical team roles to the README and memory 0018 while preserving the
  project contact email: Jayden as Project Lead & Systems Architect, Alton as Product Design &
  Submission Lead, and Janson as Development Enablement & Technical Support. They are deliberately
  not duplicated in the final `AGENTS.md` because assignments can change.
- Added Jayden's dated owner sign-off to the root README, then re-signed it after clarifying that the
  shared Biotope account is also view-only.
- Added `docs/repository-guide.md` as the human-facing repository map, with a short judge/reviewer
  reading route, top-level directory guide, system connection overview, document authority guide,
  and run/verification pointers. Linked it prominently from `README.md` and clarified in `AGENTS.md`
  and `structure-context.md` that `AGENTS.md` is the source of truth for AI coding agents only.
- An initial `AGENTS.md` rewrite incorrectly embedded current implementation and project-status
  facts. Jayden rejected that approach because it would make the pointer file stale whenever the
  implementation changed. Replaced it rather than treating the mechanically valid draft as approved.
- Rebuilt the final `AGENTS.md` as a stable routing and invariants document. It now contains only the
  source-routing table, durable product/architecture boundaries, new-vs-continuing session protocol,
  issue/branch/worktree/session isolation, worker/orchestrator/master-orchestrator definitions,
  delegation rules, owner verification, and evidence/handoff requirements. Volatile phase, team,
  model, branch, function, credential, version, command, and test-count facts stay in their owners.
- Corrected the `AGENTS.md` documentation authority routing after the memory refresh: accepted
  records signed/verified by Jayden are trusted within scope; recent `docs/development/` documents
  need no human gate when their date is relevant and no stronger source contradicts them; and
  `docs/implemented/` is explicitly known-stale background rather than current-state authority.
- Audited and rebuilt `docs/memory/` as a durable invariant layer. Removed the dated L6 one-card run
  snapshot; corrected mixed truth, scheduled-call credential separation, rule projection, simulation,
  provider decorrelation, brain persistence, and documentation lifecycle records; compressed the
  Graphify note; and removed prices, counts, temporary blockers, and delivery status from memory.
- Added durable memories for the runtime/storage topology (GitHub Actions, Flutter, Supabase,
  Cloudflare Workers/R2/D1, isolated Python), the five-model non-serving research programme, Nao's
  membership-versus-health-data boundary, owner verification, and the expiry of hosted measurements.
- Jayden reviewed and accepted sixteen memory records. Added his explicit shared-contract review
  exception to memory 0002; expanded memory 0003 so non-diagnostic copy surfaces weak/conflicting
  evidence rather than hiding it; revised memories 0007/0013 around automatic verified-rule
  projection plus durable human revocation; removed fixed-count memory 0014; and clarified in memory
  0019 that GitHub Actions runners are the cross-service automation bridge, not the runtime data path.
- Verification of the rule pipeline found that the intended automatic rule path is not yet complete:
  `brain-pipeline.yml` publishes extracted blueprints to R2 and loads edges into Supabase, but does
  not invoke the rule loader, and the current `rules` schema has no regeneration-safe human-revocation
  overlay. The revised memories label this as required architecture rather than implemented fact.

## Decided

- `docs/implemented/README.md` distinguishes repository implementation from mutable hosted state and
  explicitly lists missing/unwired capabilities; it remains unverified until Jayden reviews it.
- `docs/implemented/shared/` owns architecture that spans biotope and nao; whole-product context and
  measured system truth remain at the `docs/implemented/` root.
- Jayden explicitly verified `hackathon-rules.md`, `agnes-2_5-flash.md`, and `agnes-ai-docs.md` on
  2026-08-02.
- Jayden explicitly verified the remaining revised durable-memory records and the memory index on
  2026-08-02; they no longer carry pending-review status.

- The dated `provider-e2e-status.md`, `submission-verification-audit.md`, and
  `phase2-demo-runbook.md` remain unchanged historical run records. Current submission-facing docs use
  placeholders until provider reconciliation.
- Agnes's submission value is structural, not volumetric: independent vendor/training/weights provide
  the decorrelated verification layer; pending call counts do not weaken that property.
- GMI wording is factual and non-accusatory: requested access did not arrive within the challenge
  window, the available credit did not cover the needed workload, so training moved into a local
  compute envelope.
- `canonical` and the memory/ADR equivalent `accepted` are owner-authority states. Only Jayden may
  promote scoped documents and add `verified_by: Jayden` plus `verified_at:`; changed verified content
  returns to `unverified` first.
- In multi-device runs the human directs only the main orchestrator. Workers report through their
  GitHub issues/PR comments; the orchestrator monitors and unblocks that control plane, delegates
  bounded work to the cheapest capable model, and reviews results before integration.
- Human repository navigation belongs in `README.md` and `docs/repository-guide.md`; operational
  instructions for AI coding agents belong in `AGENTS.md`.
- Phase 2 ends when the hackathon deliverables are submitted. Passing gates, merging a branch, or
  finishing documentation does not independently trigger the transition.
- Master-orchestrator runs may keep one umbrella issue across multiple sessions and stacked work
  units; separate leaf issues are optional when issue/PR records remain unambiguous, but every
  concurrent writer still requires isolated branch/worktree ownership.
- Python's current surface ownership is a project decision to keep in the model-training and
  structure documentation, not a changing inventory to duplicate in `AGENTS.md`.
- A valid Jayden signature or verification stamp is semantic authority within the document's scope.
  Ordinary development documents can still be trusted as recent, non-contradicted working context;
  lack of an owner stamp there is not itself a defect.
- Durable memory records decisions, invariants, security boundaries, and expensive-to-rediscover
  gotchas. Dated counts, spend, deployment state, model-run progress, temporary blockers, and delivery
  milestones belong in session/run evidence or their current measured owner instead.

## Left

- Jayden must replace every `{{PENDING:*}}` value after reconciling machine ledgers with provider
  billing.
- Jayden must review the 30 currently unverified scoped documents and explicitly promote only those
  that are accurate before the joint push.
- Jayden must review and sign the rewritten `AGENTS.md`; it explicitly remains pending owner review.
- Several older delegated process/plan documents, PR-template wording, the worktree helper default,
  the seed helper, and historical cron schedules still need separate reconciliation in their owning
  surfaces. `AGENTS.md` intentionally does not mirror their current values.
- The tracked semantic-graph view still contains the removed memory-0016 and fixed-count memory-0014
  nodes, plus the pre-move paths for the two shared architecture documents. It is a generated
  projection and was not hand-edited. Regenerate it when the project-bounded Graphify executable is
  available on this machine (`graphify-out/graph.json` is also absent here).
- Commit, push, branch reconciliation, issue summary, and PR work are intentionally deferred to the
  later joint closeout.

## Blockers

None for the local documentation work. Definitive API usage numbers remain intentionally pending.

memory: owner-verified all retained records 0001-0013, 0015, 0017-0024 and the canonical memory index; removed volatile 0014 and dated snapshot 0016

## Verification

- Shared-architecture relocation: both files exist under `docs/implemented/shared/`, neither old
  `docs/implemented/` root path remains, all local links inside the moved documents resolve, and no
  maintained source or active document outside the generated semantic graph retains either old path.
- Owner-verification metadata and the regenerated index report `accepted` for `hackathon-rules.md`,
  `agnes-2_5-flash.md`, and `agnes-ai-docs.md`, each stamped `verified_by: Jayden`.
- Semantic-graph refresh was attempted with `npm run graph:view:write`; it could not run because this
  machine has neither the Graphify executable nor `graphify-out/graph.json`. The generated view was
  left untouched as required.
- Write-up body recount: 780 words by the repository-local boundary count; five required headings
  present, followed by one compact paper-to-product evidence appendix as the rules permit.
- Placeholder sweep: no stale US$1.80 / 59-call / 45-call / 10-Agnes-call claims remain in maintained
  submission-facing docs; all pending values are found with one `rg '{{PENDING:'` sweep.
- `git check-ignore -v PROJECT_MEMORY.local.md` resolves to the exact root `.gitignore` rule.
- `npm --prefix tools/llm-router run start -- check-config` — config OK and decorrelation OK
  (`synthesis=openai`, `verifier=agnes`); expected exit 2 because provider keys were intentionally
  absent. The command also caught the stale US$1 cap copied into the earlier body.
- `node tools/context_sync.mjs --check` — passed after index regeneration.
- Human repository-guide link check — every local Markdown target resolves.
- `npm run context:check` — passed after adding the guide and its README/INDEX routing links.
- `git diff --check` — clean after the attribution sign-off and human-navigation changes.
- Re-ran `npm run context:check`, local-link validation, and `git diff --check` after the final
  pointer-only `AGENTS.md` rewrite and documentation-authority correction. Checked that it contains
  no current phase/team assignment, released-model count, Edge-Function inventory, credential name,
  supported runtime version, active integration branch, or aggregate test count.
- Memory durability verification: all local Markdown links inside `docs/memory/` resolve; obsolete
  service-role cron, four-model, fixed Apple price, old docs-tree, L6 interim-verifier, and measured
  usage/count language is absent from active memory; `npm run context:check` and `git diff --check`
  pass after index regeneration.
- `npm --prefix tools/llm-router run start -- check-config` executed successfully through config
  validation and reported decorrelation OK (`synthesis=openai`, `verifier=agnes`). It exited 2 only
  because provider keys are intentionally absent in this session.
- GitHub bridge verification: `tools/brain-ingest/tests/brainPipelineWorkflow.test.ts` passed. The
  Nao `githubDispatch.test.ts` could not execute under this shell's Node 20 because that package's
  TypeScript test command requires its pinned Node 26 runtime; both the direct attempt and a `tsx`
  fallback failed before loading the test (`tsx` is not a Nao dependency). The integration claim was
  therefore also checked directly against `githubDispatch.ts`, `brainPipelineGithub.ts`,
  `brain-ingest.yml`, `brain-pipeline.yml`, and `nao-d1-etl.yml` rather than reported as test-proven.
- Owner-verification inventory: 36 scoped Markdown files = 30 unverified, 1 owner-verified accepted
  memory, 4 draft, and 1 stale; memory 0018 carries Jayden's explicit role verification stamp.
- Test-count remeasurement: Flutter 827 passed / 26 skipped; nao 407 passed / 1 skipped; six Node
  tool packages 993 passed; model-training 300 passed. These reproduce 2,527 active product/training
  passes and 27 skips. The documented 2,605-pass release total remains explicitly bound to
  `main@5a5af7c` and its 78 frozen Run 4 root guards; three branch-bound product-cap fixtures reject
  the later docs branch's changed historical MT4 path state, so that snapshot is not presented as an
  evergreen branch-wide result.
- Test execution did not modify `apps/biotope/pubspec.lock` or other tracked product files.
