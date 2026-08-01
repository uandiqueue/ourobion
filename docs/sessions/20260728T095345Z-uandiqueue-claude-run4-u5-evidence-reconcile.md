---
title: Run 4 U5 evidence reconciliation
summary: Reconciled stacked PRs #176 and #190 onto dev-phase2-run4 tip 87a6364 — resolved the synthetic-merge-parent staleness and real merge conflicts (confined to docs/temp/run4 status docs), with zero code changes and the provider-e2e evidence numbers preserved exactly.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U5 evidence reconciliation

Issues: #167 (R4-U5 single-paper authoring), #189 (bounded provider-backed e2e evidence)
PRs reconciled: #176 (`feat/brain/run4-u5-single-paper-authoring`), #190
(`test/brain/run4-provider-e2e`, stacked on #176)
Worktree: `C:\project\ourobion-wt-u5-reconcile`
Branch: `fix/brain/run4-u5-evidence-reconcile` (worktree branch; the two PR branches themselves were
updated and pushed directly — see Decided)

## Attempted

- Diagnosed #176's red "Run 4 release evidence" / "Run 4 Gate" checks before touching any code.
- Diagnosed and resolved #190's real CONFLICTING/DIRTY merge state against the current
  `dev-phase2-run4` tip (`87a6364`, 47 commits ahead of the PRs' shared merge-base `66bfde5`).
- Preserved the exact provider-e2e evidence numbers verbatim through the reconciliation.
- Ran the full verification suite the task required and captured actual output (not assumed-passing).

## Changed

- Merged `origin/dev-phase2-run4` into PR #176's branch (`feat/brain/run4-u5-single-paper-authoring`),
  resolving 10 real conflicts, all confined to `docs/temp/run4/*` status/coordination docs
  (`README.md`, `continuation-status.md`, `decisions-signoff.md`, `human-decisions.md`,
  `next-build-optimizations.md`, `orchestration-log.md`, `orchestrator-prompt.md`,
  `pending-build-register.md`, `run-envelope.json`, `unit-signoff-index.md`). Resolution took the
  `origin/dev-phase2-run4` side in every case: each file's HEAD (176) side was a strictly older draft
  of the same living status doc (pre-#197 gate-base advance, pre-#191/#202/#204-#211 UI landings); the
  origin side is the newer snapshot the docs themselves say supersedes it, and it already carries the
  exact honest #176/#190 evidence facts (verified against `run-envelope.json`'s `localEvidence` /
  `providerException` blocks). **Zero conflicts occurred in `tools/brain-ingest/**`,
  `tools/edge-loader/**`, or `scripts/demo-dryrun-run2.ps1`** — the code itself never conflicted.
- Merged the updated #176 branch into PR #190's branch (`test/brain/run4-provider-e2e`). Two additional
  conflicts surfaced in `README.md` and `human-decisions.md` where #190's own commit had added a
  documents-table row and a "bounded provider-test exception" narrative pointing at its own new file,
  `docs/temp/run4/provider-e2e-status.md`. Hand-merged both: kept the newer origin-derived table/
  structure and folded #190's unique row/pointer back in, rather than mechanically picking one side, so
  nothing #190-specific was lost.
- Added this session log.

## Decided

- **#176 and #190 stay two PRs, #190 stacked on #176, exactly as the task suggested** — the conflicts
  were fully separable (all in shared status docs, zero code overlap), so there was no reason to
  collapse them into one PR.
- **#176's red checks were the synthetic-merge-parent artifact, confirmed, not a code defect.** Before
  this session, #176 and #190 both showed `mergeStateStatus: DIRTY` / `mergeable: CONFLICTING` via
  `gh pr view`, and the base had moved 47 commits since the PRs' merge-base. Merging
  `origin/dev-phase2-run4` into the branch and pushing (which this session did) is the documented fix —
  it fires a fresh PR event with a current base/head pair, which a re-run cannot do (a re-run replays
  the same stale event payload). No source change was needed to make the release-evidence job's base/
  head check pass again.
- Resolution strategy for the docs conflicts (take `origin/dev-phase2-run4`, splice back any
  PR-specific unique content) rather than a mechanical per-hunk merge, because these are explicitly
  living/superseding status docs (each carries language like "supersedes older operational status
  sentences elsewhere") — the newer snapshot is authoritative by the docs' own convention, not just by
  recency.
- Did not touch `.github/workflows/ci.yml`, `tools/run4_release_gate*.mjs`, or the attestation record,
  per the coordination boundary (another agent owns the gate-base advance / attestation).

## Verification (actual output, this session)

- Landing gate, merged #190 tip (`bf04d08`) against the checked-in unit base
  `547280f69fe37fe1c7271ea126002f9ffaadafb9`:
  `node tools/run4_release_gate.mjs landing --base 547280f69fe37fe1c7271ea126002f9ffaadafb9 --head HEAD --max-paths 115 --max-added 8500`
  → `{"base":"547280f69fe37fe1c7271ea126002f9ffaadafb9","head":"bf04d08c1abf164359e0368c1b226e11826b4154","changedPaths":58,"addedLines":5703}`, exit code `0`. Well inside 115 / 8,500 — the cap is
  not a blocker for this reconciliation.
- `cd tools/brain-ingest && npm test` → **364/364 passing**, 0 failed. (Required a root
  `npm install --no-save zod` workaround per the known `shared/brain/relationships.schema.ts` /
  `shared/rules/rule.schema.ts` gap; not committed, per instruction.)
- `node tools/context_sync.mjs --check` → `context_sync --check passed: sessions, memory, decisions,
  index, and couplings are consistent.`
- `node tools/context_sync.mjs --fix-index` run after this log was added (see below); re-ran
  `--check` clean afterward.
- Both branches pushed; see Left for post-push PR check states (checks take time to run after push —
  report what was actually observed, not assumed).

## Provider-e2e evidence — verified unchanged

Diffed `docs/temp/run4/provider-e2e-status.md` (PR #190's own evidence file, untouched by the merge —
it had zero conflicts) against the constraints given for this task. All figures match exactly, verbatim:

- Complete canonical paper extraction: **91,162 characters**.
- OpenAI synthesis prompt: **12 selected evidence passages**, explicitly stated as not the whole paper.
- Anthropic: **one verifier-only role**; verdict **`uncertain`**, confidence 0.95, supporting 0,
  contradicting 0, **retrieved sources 0** (zero independent sources); the one-paper edge
  **correctly remained held** (non-servable, zero paper-derived cards).
- Locally reconstructed spend: **OpenAI ≈ US$0.0502 / SGD 0.0648**; **Anthropic ≈ US$0.1039 /
  SGD 0.1340**; both documents state provider billing is authoritative over these estimates.
- Fixed-edge local harness: **20/20**.
- Explicitly recorded as a **bounded issue-#189 exception**, **not a general O29 unblock**
  (`run-envelope.json`'s `providerException.generalO29Unblocked: false`).

Nothing in this session restated, rounded, or upgraded any of these numbers; the file was carried
through the merge without edits.

## `verifierModel` / `TEST_MODE_LABEL` — exact finding

Checked the actual code path (`tools/brain-ingest/src/verify/verifier.ts`) rather than trusting prose.
Two distinct fields exist and must not be conflated:

- **`TEST_MODE_LABEL`** (`tools/llm-router/src/types.ts:53`) is the exact literal string
  `'scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)'`. It is attached as a
  separate `testMode` field on the router response/report **only when the router config carries a
  `testMode` block** (the repo's checked-in default: single-provider OpenAI, decorrelation
  deliberately OFF). Running `tools/brain-ingest`'s own test suite this session reproduced this live:
  `llm-router TEST-MODE WARNING — decorrelation invariant ... is VIOLATED and deliberately downgraded
  to this warning by config testMode ... Verifier verdicts produced under this posture are NOT
  independently verified and MUST carry the label 'scaffolded + unit-tested (TEST-MODE: single-provider,
  decorrelation OFF)'` — confirming the checked-in default config is still single-provider/testMode-on.
- **`verifierModel`** (`verifier.ts:247`, `:262`) is a *different* field: for a real, non-mocked verify
  call it is set to `response.model || verifierModel` — i.e. the literal model identifier the live
  provider API actually returned, falling back only to the CLI's static sentinel
  `'router:verifier-node'` (`cli.ts:413`) if the response carried no model field. It is never set to
  `TEST_MODE_LABEL`, and tests stamp only `MOCK`-prefixed sentinels into it so a fixture verdict can
  never be mistaken for a real one.
- PR #190's official Anthropic verifier call ran through **an isolated in-memory router config**
  (per `provider-e2e-status.md` and its session log
  `docs/sessions/20260728T020913Z-agentjwork-codex-run4-provider-e2e.md`), specifically because OpenAI
  (synthesis) and Anthropic (verifier) are genuinely different vendor families — real decorrelation,
  no `testMode` downgrade needed for that call. Its evidence doc explicitly leaves the checked-in
  config's single-provider/testMode conflict as an open blocker rather than claiming it resolved — so
  the evidence text does **not** imply this verdict is independently verified when it isn't, nor does
  it hide that the checked-in default is still testMode-on. **No fabricated fix or wording change was
  made either direction.**
- **Caveat honestly reported, not glossed over:** no committed artifact in either PR persists the
  *literal* `verifierModel` string value from that specific live Anthropic call (no raw JSON run output
  was committed — consistent with this being local-only, non-persisted evidence). I can confirm what
  the field mechanically resolves to (the real API's returned model id, not `TEST_MODE_LABEL`, not
  `MOCK`) but cannot quote the exact string from a recorded artifact, and did not invent one.

## Left

- Both branches were pushed (see PR check states below); GitHub's checks need time to run post-push —
  report their state as observed, not assumed.
- Sentence-provenance (`B-PL22`) remains unimplemented, exactly as before this session — not in scope
  here and not touched.
- The single-provider/`testMode` conflict in the checked-in router config (noted above) remains
  unresolved; it is explicitly listed as a blocker in `provider-e2e-status.md` already and this session
  did not attempt to fix it (out of `tools/llm-router` write scope for this task; router was touched
  read-only, for verification only).
- Did not advance `RUN4_UNIT_BASE_SHA`, edit `ci.yml`, `tools/run4_release_gate*.mjs`, or the
  attestation record — that is explicitly another agent's concurrent work per the task's coordination
  note.

## Blockers

- None found that block this reconciliation. The landing cap has ~2,800 lines / 57 paths of headroom
  at the merged tip; brain-ingest tests are fully green; `context_sync --check` is clean.

memory: none
