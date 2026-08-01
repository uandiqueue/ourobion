---
title: nao ingest seeds and brain-pipeline dispatch — pass Supabase to the ingest runner, and make the pipeline dispatch match the workflow it dispatches
summary: `brain-ingest.yml` never gave the runner SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, so the fail-soft `ingestion_seeds` loader degraded to static topics and rejected a real nao seed as an unknown topic; the credentials had to go in the STEP env, not the .env file, because config.ts never writes back into process.env. On the pipeline side the preflight was verified green against live GitHub, so it was never what blocked the button — the dispatch body itself was unsendable (undeclared `pair`, missing required `operation`), a failed cosmetic runs lookup could mark an active workflow undispatchable, and every failure rendered as one opaque sentence with no status.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# nao ingest seeds + brain-pipeline dispatch

Branch: `fix/nao/ingest-seeds-and-pipeline-dispatch`; base and exact head at branch cut: `5d2d39e`
(`origin/main`, equal to `dev-phase2-run4`); device: `agent-j`; agent: `claude` (Opus 5, 1M context).
Isolated git worktree; the main checkout was read but never written (two other agents were working in
`apps/nao`).

Territory: `.github/workflows/brain-ingest.yml`, `tools/brain-ingest/src/{run.ts,cli.ts}`,
`apps/nao/src/lib/{brainPipelineControl.ts,brainPipelineGithub.ts}`,
`apps/nao/src/components/BrainPipelinePanel.tsx`,
`apps/nao/tests/{brainPipelineControl,brainPipelineGithub}.test.ts`, this log.

## Defect 1 — a nao-created seed was rejected as a typo

The diagnosis handed to me was right about the cause and wrong about the fix location.

`seeder/dbSeeds.ts` needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; `brain-ingest.yml` supplied
neither. But the obvious repair — adding two more `printf` lines to the "Write .env from secrets"
step — would not have worked. `fetchDbSeeds` reads `opts.env ?? process.env`, and `config.ts`'s
`readEnv()` builds a **local** merged object from `process.env` + the `.env` file and never writes
back into `process.env`. This is the same trap commit `115dbf9` fixed for the provider keys. The two
values therefore go in the `env:` block of the **Run ingestion** step.

Both secrets exist on the repo: `SUPABASE_URL` (2026-07-28T15:30:51Z) and
`SUPABASE_SERVICE_ROLE_KEY` (2026-08-01T17:56:57Z, set by the owner).

`brain-ingest.yml` is the only workflow that runs the ingest CLI — `ci.yml`, `model-inference.yml`,
`nao-d1-etl.yml`, `run4-u6b-evidence.yml` and `brain-pipeline.yml` invoke no command that reaches
`loadTopicPool`, so none of them shares the omission.

### The fail-soft behaviour itself

The "ONE loud warning" **does** reach the workflow log: `loadTopicPool` passes
`warn: (m) => process.stderr.write(...)`, and the run header prints
`topics: N static + M db (db seeds unavailable — static only)` on stdout. The warning was there in
run `30711328107`; it just was not what the run *failed* on.

The failure message was the problem. `selectSeeds` threw `unknown --seed '<slug>'. Known topics: …`
with no idea that the pool had been silently truncated, so a missing credential presented itself as
an operator typo and sent the reader off to fix a slug that was never wrong. `run()` now takes
`seedPoolDbAvailable` (defaulting to `true`, so programmatic and test callers are unchanged) and the
CLI passes `pool.dbAvailable`. When an explicit `--seed` misses **and** the boundary did not load,
the error now says exactly that and calls it a configuration failure, not an unknown topic.

Nothing about the fail-soft policy was weakened: an unscoped run with no Supabase still proceeds on
static topics, which is the property that keeps the boundary from bricking the pipeline.

## Defect 2 — why the dispatch button was not live

The brief's hypothesis was that the preflight in `brainPipelineGithub.ts` was rejecting. **It is
not.** I ran the real `inspectBrainPipeline()` source against live GitHub with a working token:

```
{ "ok": true, "dispatchability": "active", "defaultBranch": "main", "runs": [] }
```

Everything the preflight depends on checks out, and I ruled out each candidate rather than assuming:

- `X-GitHub-Api-Version: 2026-03-10` is a *real, currently supported* version. GitHub validates this
  header against a list — `bogus-version` and `1999-01-01` both return 400, while `2022-11-28` and
  `2026-03-10` return 200. So the unusual-looking constant is fine.
- `uandiqueue/ourobion` is a **public** repo owned by a **user**, not an org, and all three preflight
  GETs answer 200 unauthenticated. Token scope therefore cannot explain a failure, and there is no
  org PAT-approval gate.
- The deployed Worker (`e9dba60e`, 2026-08-01T17:46:24Z) carries `GH_ACTIONS_TOKEN`,
  `GH_REPO="uandiqueue/ourobion"`, and both `nodejs_compat` flags. `brain-pipeline.yml` registered at
  17:19:17Z with the `#360` merge, before that deploy, so the build does contain both the workflow
  and the panel.

So the preflight is not the guard that was refusing. Three separate things were actually wrong, and
the third is why nobody could tell:

**(a) The dispatch body could never be accepted.** `parseBrainPipelineRequest` built
`workflowInputs` containing `pair`, which `brain-pipeline.yml` does not declare, and omitted
`operation`, which it declares `required: true`. GitHub validates `workflow_dispatch` inputs against
the declared set and 422s on either fault, so every click would have been rejected regardless of the
preflight. `pair` is now dropped from the workflow inputs (it still reaches the control-audit event
detail) and `operation` is sent.

`operation` is pinned to `full` because that is the only operation this form can express: the
`project-only` branch demands exact 64-hex SHA-256 digests for the three R2 edge artifacts, and the
panel collects papers plus an artifact revision instead. `brain-pipeline.yml` is untouched, so
`default: project-only` remains the operation for a manual Actions-tab run and any other dispatcher,
and the `confirm_spend: RUN` gate on the paid path is exactly as it was.

**(b) A cosmetic query could mark an active workflow undispatchable.** After registration was already
settled, a failed `…/runs?event=workflow_dispatch` lookup returned `ok: false,
dispatchability: 'unknown'` and disabled the form. Recent-run history is reporting, not a gate; an
empty list is a valid state the panel already renders, and a workflow that has never run must stay
dispatchable. Failure there now degrades the list only. The fail-closed part — workflow present on
the default branch and `state === 'active'` — is unchanged.

**(c) Every failure was unreadable.** Six distinct outcomes collapsed into two fixed sentences with
no status and no step, and the panel then discarded even those in favour of its own generic string.
A transport failure, a 401, and a 403 were indistinguishable from each other and from a form waiting
on two empty fields. `stepFailure()` now names the step and the numeric status — both locally
composed, never remote content, so the redaction test still holds — the route already returns that
body, and the panel renders it instead of overwriting it.

I also made the form say why it is refusing. `formReady` was unchanged, but `papers` and
`artifactRevision` both default to `''`, so the submit button is disabled on arrival with no stated
cause — which is indistinguishable from a broken page and is the most likely thing the owner was
looking at. A `blockers` list now spells out each unmet requirement under the button. No guard was
relaxed to do this.

## Verification

- `apps/nao`: `npm run typecheck` clean; `npm test` **384/384 pass**; `npm run lint` — no ESLint
  warnings or errors.
- `tools/brain-ingest`: `npm run typecheck` clean; `npm test` **549/549 pass**. (An initial run
  showed failures on a missing `zod` — the worktree had no `shared/node_modules` — not on any change
  here; green after `npm ci` in `shared/`.)
- New coverage: the workflow-input contract is now pinned by a test that parses
  `.github/workflows/brain-pipeline.yml` and asserts every dispatched key is declared there and that
  `operation` is `required: true`; plus inspection tests for the degraded runs list and for the
  step-and-status error text.
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.

## Not verified

I could not confirm the 422 by firing a real dispatch — the sandbox refused the POST, and I did not
work around it. The claim rests on the declared-input contract in `brain-pipeline.yml` plus GitHub's
documented `workflow_dispatch` validation, and is now pinned by a test against that file rather than
by an observed response. A single dry-run dispatch from the panel would settle it; it costs nothing
(`dry_run: true` reaches no provider).

I also could not read the deployed Worker's bundle or its `GH_ACTIONS_TOKEN`, so "the deployed code
equals `main`" rests on the deployment timeline above, not on an inspected artifact.

Unrelated, found while checking secrets: `brain-ingest.yml` references `secrets.S2_API_KEY` and
`secrets.LENS_API_KEY`, and neither exists on the repo. Both are optional sources, so the runner
just writes empty values and those two sources stay disabled. Left alone.

memory: The Cloudflare/GitHub half of nao has a recurring shape — a fail-soft boundary degrades, and
the *next* component reports the degradation as a user error. `brain-ingest.yml` omitted the Supabase
pair and a real nao seed came back as "unknown topic"; `brainPipelineGithub.ts` collapsed six
outcomes into two sentences and an unfillable form read as a dead pipeline. Two concrete traps worth
keeping: (1) `tools/brain-ingest/src/config.ts` `readEnv()` merges `.env` over `process.env` into a
LOCAL object and never writes back, so anything reading `process.env` directly — `dbSeeds.ts`, the
LLM router — must be given step `env:`, not `.env` lines (same lesson as `115dbf9`); (2) nao's
`workflowInputs` must match `brain-pipeline.yml`'s declared inputs exactly, because GitHub 422s a
`workflow_dispatch` carrying an undeclared input or missing a required one — `pair` was undeclared
and required `operation` was absent, so no click could ever have dispatched. Also settled: the
`X-GitHub-Api-Version: 2026-03-10` constant is real and supported (GitHub 400s a version not on its
list, so a bad one is loud, not silent), and the repo is public and user-owned, which rules token
scope out of any GitHub read-path diagnosis here.
