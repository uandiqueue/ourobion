---
title: Run 4 live provider acceptance and 226 backend membership unblock
summary: Executed the ordered Anthropic/OpenAI/Agnes live acceptance at exact head, implemented the 233 cloud pipeline, granted the bounded nao curator membership that unblocked 226, and recorded honest results for 246, 240 and 179.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 live provider acceptance and 226 backend membership unblock

Issues: #233, #226, #246, #240, #179; branch: `feat/brain/run4-233-live-legs`;
base and exact head: `c6a2ca64298998205a09451f78a6bfc63afa1a03` (`dev-phase2-run4` tip, = PR #291
merge commit); device: `uandiqueue-wsl`.

## Attempted

- Act as nao system/backend owner for the five assigned Run 4 items, producing exact-head evidence and
  honest PASS / FAIL / BLOCKED for each rather than partial claims.
- Execute the owner-approved ordered live provider acceptance for #233 under a finite runtime
  authorization: Anthropic first (max SGD 2), OpenAI second (max SGD 20), Agnes last (max 20 testing
  calls, acceptance-only).
- Apply the minimum bounded backend change needed to unblock the #226 browser acceptance.

## Changed

- **Hosted (bounded test data, not schema):** inserted exactly **one** row into `public.nao_members` in
  the approved demo project `bewwvcksgpxoomyjavjp` — `user_id
  bf88b88e-73b7-4564-be44-70bd2b6d1502`, `role 'curator'`, `status 'active'`, `revoked_at null`,
  applied `2026-07-31T12:18:44.188938+00`. Guarded by `where exists` on `auth.users`, `on conflict do
  nothing`, and an explicit literal id. The table held **0** rows beforehand, so no existing member was
  displaced. This is row-level test data and correctly produces **no** migration diff.
- **#233 §D (added after the owner authorized it mid-session):**
  - `tools/brain-ingest/src/verify/verifier.ts` — `verify()` gained `pushR2` (+ an injectable
    `r2Store` test seam) and returns `r2: { key, written, skipped }`. It calls the **already
    existing but never-invoked** `appendVerificationsToR2`. The push happens **after** the local
    mirror write, so an R2 failure degrades to "not yet published", never "verdict lost".
  - `tools/brain-ingest/src/cli.ts` — `verify --push-r2`, symmetric with `synthesize --push-r2`,
    plus usage text.
  - `.github/workflows/brain-pipeline.yml` — **new** `workflow_dispatch` pipeline running
    synthesis → quoteCheck → decorrelated verification → R2 artifact write → `edge-loader
    --from-r2` projection. nao's role is unchanged: it dispatches, it never holds a provider key.
  - `tools/brain-ingest/tests/verify.test.ts` — 4 new regression tests.
- Live-acceptance runtime artifacts were written to the gitignored
  `data/brain-ingest/live-acceptance/run4-233-live-2026-07-31/` inside the isolated worktree only.

## Decided

- **The #226 grant target is not the root `.env` account.** The handover named `DEMO_USER_EMAIL`, but
  `last_sign_in_at` evidence shows that account (`d9b5bc39…`) last authenticated 2026-07-30 16:12Z and
  took no part in the browser run, while `bf88b88e…` signed in at 2026-07-31 10:49:29Z — nine minutes
  before the #226 matrix comment reporting auth-success-then-role-denial. Granting the `.env` account
  would have left #226 blocked. Owner confirmed the corrected target before any write.
- **`GET /models` was deliberately not called**, departing from #233 §A's proposed health check per the
  owner directive. Agnes identity is established solely from POST response bodies.
- **Agnes pricing was not invented.** `maxReservedUsd: 0` derives solely from the owner-confirmed free
  plan already recorded in `router.config.json`, so any future non-zero Agnes reservation fails closed.
- SGD→USD used a deliberately conservative **1.40 SGD/USD** (repo working assumption is 1.29). A higher
  divisor buys fewer USD per SGD ceiling, so the USD caps cannot exceed the owner's SGD ceilings.
  Prior #189 use was **declared and counted** in aggregate (Anthropic 3 starts / US$0.103893; OpenAI
  2 starts / US$0.05023125).
- Did **not** port the Windows 14+7 runner to Linux. A port is a different artifact and could not serve
  as acceptance evidence for the merged runner. **#246 ownership was transferred to the Windows session
  by the owner mid-session** and handed over on the issue.
- **#233 §D was authorized by the owner mid-session and is implemented, but deliberately not executed.**
  The workflow is `workflow_dispatch`-only and fail-closed: `dry_run: true` by default, a live run
  additionally requires `confirm_spend: RUN`, and a live run with no `--corpus` is refused outright
  because it would spend verifier tokens for a structurally forced `uncertain`. A `concurrency` group
  serialises runs, since stages 1/3 read-modify-write the same shared R2 objects and stage 5 rebuilds a
  projection from them.
- **`SUPABASE_SECRET_KEYS` cannot drive the projection.** `load_edges.mjs` connects with `pg` and needs
  a PostgreSQL connection string (`SUPABASE_DB_URL` / `--db-url`); it uses no Supabase API key. #233 §E
  asserts otherwise and is wrong on this point. The workflow therefore validates the artifacts and then
  **fails loudly** rather than reporting a projection that never happened. One new repository secret,
  `SUPABASE_DB_URL`, is the last thing standing between §D and a complete run — an owner action.

## Verification

- Both typechecks clean; **brain-ingest 426/426**, **llm-router 121/121** at exact head on Node 26.5.0
  — this is the pre-§D baseline taken before the live legs ran; §D later takes brain-ingest to 430.
- Offline preflight passed twice (checked-in fixture, then runtime bundle): quote gate 1/1,
  independent second-paper retrieval, `families.separated: true`, exit 0.
- **All three live legs PASS**, each from an isolated worktree at exact head with
  `git status --porcelain --untracked-files=all` **empty before and after**:

  | Leg | Model | Identity | Attested | Accepted | HTTP |
  |---|---|---|---|---|---|
  | anthropic-synthesis | `claude-sonnet-5` | provider-response | true | 1 claim | 200 |
  | openai-synthesis | `gpt-5-2025-08-07` | provider-response | true | 1 claim | 200 |
  | agnes-verification | `agnes-2.5-flash` | provider-response | true | 1 record | 200 ×2 |

  Leg 2's recorded identity is the concrete snapshot OpenAI returned, distinct from the configured
  `gpt-5` — a genuine attestation, not a config echo. Agnes recorded
  `decorrelatedFromSynthesis: true`.
- **Spend (actual, from ledger + hash-chained journal):** Anthropic 1 start / 1,279 in / 405 out /
  **US$0.006608**; OpenAI 1 start / 798 in / 1,060 out / **US$0.0115975**; Agnes **2 of 20** starts /
  2,048 in / 820 out / **US$0** (free plan). Total **4 POSTs, US$0.0182055 (~SGD 0.023)**. Anthropic
  used ~0.47% of SGD 2; OpenAI ~0.08% of SGD 20. No cap approached.
- Journal: 12 events (4 × reserved/started/response), **hash chain verified intact**, all four statuses
  200. A **4th** invocation was attempted and correctly refused with **no dispatch**; journal unchanged.
- Verification verdict is `uncertain` (0.3) with `supporting: 0` because independent retrieval returned
  a `mentions`-stance source — the designed fail-closed grounding. The edge is correctly held; **no
  servable edge is claimed**.
- #226 membership verified post-change: full table shows exactly the one row, and effective-role
  resolution under `nao_role()`'s own predicate returns `curator` / rank 20 / `satisfies_curator: true`.
- #246: merged runner parse-checks clean on the real target interpreter (Windows PowerShell
  **5.1.26100.8875**) for `demo-dryrun-run2.ps1`, `native-process.ps1`, `native-process.tests.ps1`.
- #179: PR #184 confirmed **merged**; the original dual-upsert defect is fixed — the route now issues a
  single `nao_loader_apply_simulated_days` RPC.
- **§D gates:** brain-ingest typecheck clean and **430/430** (426 pre-existing + 4 new `--push-r2`
  tests: publishes under the exact `edges/verifications.jsonl` basename; opt-in so a plain run never
  writes the shared truth tier; a second push dedupes instead of duplicating; and an R2 outage leaves
  the local verdict intact). llm-router **121/121**, typecheck clean. Both workflow YAMLs parse.
  The gate's decision table was exercised directly — all six cases behave fail-closed:

  | dry_run | confirm_spend | corpus | result |
  |---|---|---|---|
  | true | — | — | dry run, no call |
  | false | *(empty)* | present | REFUSE |
  | false | `yes` | present | REFUSE |
  | false | `RUN` | *(empty)* | REFUSE |
  | false | `RUN` | missing file | REFUSE |
  | false | `RUN` | present | authorised |

## Left

- **#233** §D is implemented but **never executed**. To complete it: add the `SUPABASE_DB_URL`
  repository secret, dispatch once with `dry_run: true` to validate the wiring with no spend, then
  dispatch with `dry_run: false` + `confirm_spend: RUN` + a real corpus. §A/§B/§C/§E are done.
- **#246** transferred to the Windows session. Handover posted; nothing in flight, no branch, no
  partial run. It still needs a Windows-filesystem checkout, `..\biotope-toolchain`, an owned isolated
  `ourobion` Supabase stack, and deno 2.8.1.
- **#240** requirements 1–3 done; 4 needs a corpus with a genuinely *supporting* independent source
  (the frozen two-paper control cannot produce one by construction); 5 waits on #246.
- **#179** implementation merged; open on acceptance evidence alone, gated by #246 and #240 req 4.
- **#226** backend half complete; browser/UI owner still owes the authenticated matrix re-run and the
  four UI defect fixes.
- Cleanup owed: revoke or delete the `nao_members` row when #226 closes or the disposable account is
  retired.

## Blockers

- #246/#240/#179 acceptance cannot proceed on this WSL2 Linux device (see #246 comment for the five
  independent blockers). No substitute was run and no acceptance was claimed.

memory: none

## Continuation — §D local validation, three defects, and the zero-claim diagnosis

This entry supersedes the "§D is implemented but never executed" bullet above only in detail; §D
still has never run as a workflow.

### Attempted

- Dispatch the §D pipeline as a CI dry run. **Refused by GitHub:** `HTTP 404: workflow
  brain-pipeline.yml not found on the default branch`. A `workflow_dispatch` trigger is only
  registered once the file exists on the default branch (`main`), so it cannot be dispatched
  against a feature branch first. `main` is out of scope, so no CI run was performed.
- Validated the pipeline's stages locally against real R2 instead.

### Changed — three defects found by that local validation, all fixed

1. **The dry run could never have gone green.** Stage 5 ran `load_edges --from-r2 --check`, but a
   dry run deliberately never pushes and the demo bucket holds **zero `edges/` objects**, so the
   check failed on a technicality every time. The absent-artifact case is now reported as the
   expected empty state while still proving R2 credentials and connectivity; every other loader
   failure still fails.
2. **Stage 1 would have failed on every runner.** `synthesize` resolves citation metadata through
   `Manifest.open(corpusDir)` — the **local** cache — while ingestion populates **R2** from a
   separate workflow on a different runner. Exported the pre-existing but never-invoked
   `hydrateManifestFromR2`, exposed it as a `hydrate-manifest` verb, and added it as a workflow
   step before synthesis.
3. **Provider keys must be in `process.env`, not only `.env`.** `LlmRouter` resolves keys from
   `opts.env ?? process.env` (`router.ts:415`) and the synthesize/verify paths construct it without
   an explicit env, so they never read `tools/brain-ingest/.env` — only `live-acceptance` merges it
   via `loadProtectedEnv`. Writing `.env` in CI, as #233 §E prescribes, would have failed with
   `requires env var OPENAI_API_KEY`. The workflow now passes keys via step-level `env:`.

### Decided — two corrections to this session's own earlier findings

- **`METRIC_TERMS` does not exist.** It appears only in two comments in `synth/passages.ts`
  describing deferred A6 work. What runs is `defaultTermsForKeys()`, which splits the snake_case
  metric key and drops a stoplist: `gut_comfort_score → ["gut","comfort"]`, `mood_score → ["mood"]`.
  The metric registry has a `ui.label` but no alias field.
- **The zero-claim result was mis-attributed to the corpus alone.** Measured on
  `doi:10.3390/nu18091412`: `comfort` occurs **0** times and `mood` 13, while `depress` occurs
  **45** and `anxi` **30**. The prefilter never showed the model the ~75 sentences that mattered.
  The corpus gap is real for the *gut* side (`abdominal`/`bloat`/`discomfort`/`bowel` all 0) but not
  for the *mood* side. Both causes are genuine; the prefilter is the cheaper one and was ranked
  second in error.
- **The paper's own mechanism is never captured.** `claimKind` can be `'mechanistic'`, but no field
  holds the mechanism; `derivation` is our extraction justification, not the paper's biology.

### Verification

- Two live `gpt-5` synthesis runs over two well-matched papers each returned
  **`0 accepted, 0 rejected`** — zero claims emitted, so nothing was filtered.
- `hydrate-manifest` against real R2: **0 → 1,298** records; `synthesize --dry-run` then assembles
  its prompt and exits 0.
- brain-ingest **430/430** (426 pre-existing + 4 new `--push-r2` tests), llm-router **121/121**,
  both typechecks clean. Both workflow YAMLs parse. The gate's six-case decision table was
  exercised directly and is fail-closed in every row.
- Session provider total: **8 calls, US$0.044** (synthesis US$0.0437 / verifier US$0.0008), against
  SGD 2 / SGD 20 / 20-call ceilings. `SUPABASE_DB_URL` was set as a repository secret (pooler,
  transaction mode). The hosted Postgres is unreachable from this WSL2 host — TCP connects, the
  handshake times out, and there is no IPv6 route — so stage 5's write remains unverified locally.

### Left

- #233 §D still needs: PR #292 merged, the workflow on `main`, then a `dry_run: true` dispatch,
  then a live dispatch. The pooler is transaction-mode (port 6543); if the loader misbehaves on
  prepared statements, session mode (5432) is the fix. Only a live run will surface that.
- Issues **#297** (seed coverage) and **#300** (synthesis revamp, incl. the two hackathon MVP goals
  and scope G) were opened from these findings. #240, #179 and #246 are all blocked on #300 —
  they are one problem with three trackers: synthesis emits no claims at all.

## Amendment 2026-08-01 · the `/model-training/experiments/` ignore rule I promised on #311

The read-only audit in **#334 (finding B3)** checked this against the branch and found the rule
absent. Correct, and it was my miss: on **#311** I wrote that `/model-training/experiments/` was a
gap #312 did not cover and that I would "land it separately once the merge queue is clear." The
queue cleared several times over; I never came back to it. Landed here.

Why a wholesale directory ignore rather than another extension rule: the licence risk in that
directory is **the `.py` itself**, not a dataset sitting beside it. Those scripts are written
against licence-restricted corpora (SciFact is CC BY-NC) and quote them in fixtures and
docstrings, so the source file carries the problem alone. The existing patterns are
`*.py[cod]`-shaped and match no bare `.py` — which is exactly how `git add -A` swept four such
files into PR #311. CI caught that only as a `model-training — lint / format / type-check`
failure, i.e. by accident of style rather than by any licence gate.

Verified after the change: `git check-ignore -v model-training/experiments/foo.py` resolves to
`.gitignore:158`, and `git ls-files model-training/experiments/` is empty, so no tracked file is
untracked by this and nothing already committed changes state.

### Other #334 findings that land on issues I own

- **B4 (verified).** #233 acceptance criterion 3 says the verifier family must differ from "every
  other node in the suite"; `tools/llm-router/src/config.ts` enforces exactly one pairwise
  comparison, `family(verifier) !== family(synthesis)`. The narrow rule is the right one and its
  reasoning is sound in-code, but the criterion was never amended and reads DONE against a rule
  that is not enforced. Today it passes only incidentally — verifier is agnes, every other node is
  openai.
- **B1.** #246's hard requirement was recorded as met on a `verifications.jsonl` produced with no
  `--corpus` (zero retrieved sources), on a different edge than the runner asserts, while hosted
  `edge_verifications` is 0. #246 reads unblocked when it is not.
- **A3.** #240 authorized 2 calls; 4 POSTs executed (Anthropic 1, OpenAI 1, Agnes 2). The OpenAI
  leg was authorized in the orchestrator brief's ordered ladder, not in #240's thread — a
  record-keeping gap, not unauthorized spend, and the itemisation (US$0.0182055) is complete.

memory: none
