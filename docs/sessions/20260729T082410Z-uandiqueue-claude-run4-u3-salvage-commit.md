---
title: R4-U3 trust plumbing — salvage commit
summary: A previous writer agent on this branch died silently mid-unit, leaving substantial uncommitted work in the tree. This session verified it (no re-implementation), ran the gates for real under Node 26, found tasks 1-3 complete and green, and committed + pushed it as-is. Task 4 (attestation regeneration) remains out of scope, as briefed.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# R4-U3 trust plumbing — salvage commit

Branch: `feat/brain/run4-u3-trust-plumbing`. **This was a salvage task, not new work.** A prior
writer agent working this unit died silently mid-unit, leaving its uncommitted diff sitting in the
tree (per the run's `git status` at hand-off). My job was to verify what was actually there, run
the real gates, make only trivially-necessary repairs if something was broken mid-edit, and commit
+ push it honestly labelled — explicitly **not** to extend, redesign, or finish anything half-built.

## Assessed (no code changed by me beyond the commit)

The uncommitted diff covered exactly three of the four intended R4-U3 tasks; the fourth was
known-blocked and correctly left untouched.

- **Task 1 — replace the hardcoded `verifierFamily === 'anthropic'` rejection with a genuine
  pairwise decorrelation check: COMPLETE.** `tools/llm-router/src/config.ts` now enforces
  `family(nodes.verifier.model) !== family(nodes.synthesis.model)` unconditionally
  (`decorrelationFamilyOrFail`, fail-closed on an unresolvable family), with **no** override path —
  the `testMode` downgrade and its `TestModeConfig`/`ValidateOptions` types are deleted, and a
  config that still carries a `testMode` key is refused outright rather than ignored. Confirmed by
  `tools/llm-router/tests/decorrelation.test.ts` (new, 12 tests): every same-family pairing refused
  regardless of vendor, every cross-family pairing loads including the one the old blacklist used
  to reject (openai synthesis + anthropic verifier), fail-closed on an unmapped model id, and the
  testMode escape hatch is gone in both directions.
- **Task 2 — remove `testMode`, verifier → `claude-sonnet-5`, all other nodes → OpenAI with
  matching `prices[]`: COMPLETE.** `tools/llm-router/router.config.json`:
  `nodes.verifier.model = "claude-sonnet-5"`; `seeder`/`phrasing_card`/`report_narrative`/
  `extract_assist` = `gpt-5-mini`; `synthesis` = `gpt-5`. All four in-use models
  (`claude-sonnet-5`, `gpt-5`, `gpt-5-mini`) have `prices[]` rows; `claude-haiku-4-5` also has one
  (unused, harmless). `testMode` block removed. `router.ts`, `cli.ts`, `publish.ts`,
  `publish-status.ts`, `types.ts`, `index.ts` all had every `testMode`/`TestModeState`/
  `TEST_MODE_LABEL`-production-path reference removed consistently (`TEST_MODE_LABEL` itself is
  kept, deliberately, as a rejection sentinel the trust gate still recognises in historical Run 2.0
  artifacts — see `types.ts` doc comment). Documented in the new
  `docs/temp/run4/config-decisions.md` C13/C14 entries.
- **Task 3 — retain the raw provider response end-to-end: COMPLETE, with one deliberate deviation
  from the literal brief text.** The brief said "into `<edges-dir>/verifications.jsonl`"; the
  shipped implementation instead writes it to a **side artifact**
  `<edges-dir>/verification-raw.jsonl`, joined to `verifications.jsonl` on the loader's
  `(edgeId, verifiedAt)` identity, rather than as a field of the ingested record. This is
  documented and reasoned, not an oversight: `verifications.jsonl` is what `tools/edge-loader`
  ingests into `edge_verifications`, which the serving path reads to compose user-facing cards;
  putting unreviewed provider text there would push it into the exact table that feeds product
  surface. I judged this the correct call and did not "fix" it back to the literal instruction.
  End-to-end wiring confirmed: `llm-router/src/raw.ts` (`captureRawBody`, byte-cap default 256 KiB,
  truncation always recorded, sha256 always over the full untruncated body) →
  `routes/apiWorker.ts` (`rawBody` on `LlmResponse`, defaulted ON, both Anthropic and OpenAI
  adapters) → `router.ts` (passthrough) → brain-ingest `verify/attest.ts` (`buildRawRecord`) →
  `verify/artifact.ts` (`appendRawVerificationsToDir`, same append-only + dedupe semantics) →
  `verify/verifier.ts` (`verify()` collects `rawRecords` in the same loop as `records`, writes both
  unconditionally). Confirmed by `tools/llm-router/tests/rawBody.test.ts` (new, 9 tests: capture
  primitive, both adapters retain by default, byte-vs-char cap safety, opt-out, router facade
  passthrough, no raw body on the mailbox route) and
  `tools/brain-ingest/tests/rawRetention.test.ts` (new, 6 tests, local-stub router only: round-trip
  to disk, raw body confirmed absent from the record the loader ingests, truncation recorded,
  dedupe, no side artifact when there's nothing to retain).
- **Task 4 — regenerate `supabase/deploy-attestation.json`: correctly NOT attempted.** Known-blocked
  (needs a live `supabase functions serve` probe; Docker unavailable here). No file under
  `supabase/`, `.github/workflows/ci.yml`, `tools/run4_release_gate*.mjs`, or `RUN4_UNIT_BASE_SHA`
  was touched by the prior agent or by me.

## Repaired

**Nothing.** The tree was not mid-edit-broken — every file in the diff was internally consistent,
`tsc --noEmit` was clean in both packages before I touched anything, and every test (including the
newly-added ones) passed on first run. The only anomaly was operational, not code: `git diff`
initially reported `tools/brain-ingest/src/verify/artifact.ts` as a binary file. Investigated —
it's a deliberate `\0` separator in a template literal (`verificationDedupeKey`) used as an
unambiguous join-key delimiter, not corruption; `git diff --text` renders it fine. No code was
changed to work around this; it's just how git's binary heuristic reacts to an embedded NUL byte.

## Gates run for real (Node v26.5.0, confirmed via `nvm use 26`)

- `node tools/context_sync.mjs --check` → **passed**: "sessions, memory, decisions, index, and
  couplings are consistent." (session-coverage: "nothing to push" — expected, this log wasn't
  committed yet at check time.)
- `tsc --noEmit` in `tools/llm-router` → **clean, no output.**
- `tsc --noEmit` in `tools/brain-ingest` → **clean, no output.**
- `npm test` in `tools/llm-router` (`node --import tsx --test "tests/**/*.test.ts"`) →
  **88 pass, 0 fail, 0 skipped** (tests 88 / suites 0 / pass 88 / fail 0 / cancelled 0 / skipped 0
  / todo 0, duration_ms 583.87).
- `npm test` in `tools/brain-ingest` (same runner) → **386 pass, 0 fail, 0 skipped**
  (tests 386 / suites 0 / pass 386 / fail 0 / cancelled 0 / skipped 0 / todo 0,
  duration_ms 1553.61).
- Did **not** run `edge-loader` / `rules` suites, `deno check`, or `tools/run4_release_gate.mjs` —
  none were in scope for this salvage brief (which named only `context_sync --check`, `tsc`, and
  `npm test` in the two touched packages), and the release gate script's own usage line rejects a
  no-subcommand invocation, so a bare run was not a meaningful check anyway.
- Confirmed the brain-ingest `verify.cli.integration.test.ts` acceptance test stubs
  `globalThis.fetch` (saved/restored) with dummy `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` values — no
  real network call, consistent with the hard constraint that this unit must spend no provider
  keys.

Everything above was actually executed in this session, not statically inferred.

## Committed and pushed

- Staged **exactly** the files named in the salvage brief (25 paths: 18 modified, 5 new, 1 deleted,
  1 doc addition), individually by name — no `git add -A`/`git add .`. `.claude/worktrees/`
  (untracked) was left alone.
- Commit `c7111d2` on `feat/brain/run4-u3-trust-plumbing`:
  `feat(brain/llm-router): R4-U3 pairwise decorrelation, Anthropic verifier, raw-body retention`.
  Labelled as a normal feature commit, not `wip`, because tasks 1-3 are genuinely complete and
  every gate is green — the honest label here is "done", with task 4 explicitly out of scope in
  the body.
- Pushed to `origin/feat/brain/run4-u3-trust-plumbing`. No PR opened, no merge, `main` untouched.

## Left for the orchestrator

- Task 4 (attestation regeneration) still needs a machine with Docker / a live
  `supabase functions serve` to run `node tools/run4_release_gate.mjs record-attestation`. Until
  then, if CI's `run4-release` attest step compares against code this unit's sibling
  (R4-U4-follow-on, already on this branch as commit `44f9db8`) changed, it may still disagree —
  this session did not check that interaction and was barred from touching the attestation file or
  the gate script either way.
- `docs/temp/run4/config-decisions.md` (new) documents C13 (provider posture) and C14 (raw-body
  cap) — worth folding into the run's canonical decision log at the next docs pass if this unit's
  C13/C14 numbering needs to reconcile with any parallel unit's own C-entries.

memory: R4-U3 (feat/brain/run4-u3-trust-plumbing) salvage-committed as c7111d2 — the originating
writer agent died silently mid-unit but left the tree in a genuinely complete, gate-green state
(no repair needed): pairwise `family(verifier) !== family(synthesis)` decorrelation replacing the
old anthropic-blacklist, verifier = claude-sonnet-5 against an all-OpenAI rest of the roster, and
raw provider-body retention to a side artifact `<edges-dir>/verification-raw.jsonl` (not folded
into `verifications.jsonl` itself, by design, to keep unreviewed provider text out of the table the
serving path reads). Attestation regeneration (task 4) remains blocked on Docker/live-supabase and
was correctly left untouched.
