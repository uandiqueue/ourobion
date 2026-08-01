---
title: Run 4 — draft a CI workflow to rebuild nao's D1 search index from the R2 manifest
summary: Diagnosed why the live nao showed none of the 5,335-record ingestion — its paper list reads a D1/FTS5 projection that nothing syncs, since there is no wrangler cron, no scheduled() handler and no CI job — then drafted a workflow for Session B to review rather than editing their tree unreviewed.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Run 4 — nao D1 ETL workflow, drafted for Session B (#307)

Issue: #307; branch: `draft/nao-d1-etl-workflow-307`; base: `4b4af75` (the PR #325 merge);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

Drafted at the owner's request ("draft it and let session B review"). `apps/nao/**` and
`.github/workflows/nao-*.yml` are **Session B's territory**, so this is deliberately **not**
self-merged.

## Attempted

- Answer the owner's question: why does live `nao.ourobion.com` show none of the current ingestion?
- Then: is R2→D1 sync automatic, and if not, how should it be automated?

## Changed

- `.github/workflows/nao-d1-etl.yml` — **new, draft.** `workflow_dispatch` (defaulting to a
  measure-only run) plus an interim nightly `schedule`, a fail-closed secrets check, R2 credentials
  projected into `apps/nao/.env`, a **generate-and-measure gate before executing**, the generated SQL
  uploaded as an artifact, and a `concurrency` group that never cancels in progress.

## Decided

- **The live site was not broken; the link is simply not wired.** nao's paper list reads the
  **D1/FTS5** index and says so explicitly — *"Reads the D1/FTS5 index (NEVER R2 per request, NEVER
  full manifest)"* — while `apps/nao/src/lib/r2.ts` marks the manifest as *"ETL reads this
  off-Workers; not used here."* R2 is truth, D1 is a **derived projection** (AGENTS.md §2), and
  `apps/nao/scripts/etl.mjs` is the only thing that advances it.
- **Ruled out the obvious suspects rather than assuming.** Not a bucket mismatch — my
  `R2_BUCKET=ourobion-corpus` equals nao's `CORPUS` binding `bucket_name: "ourobion-corpus"`. Not a
  failed sync — reading the bucket directly showed **5,335 records / 756 fetched**, exactly the local
  manifest. Not Supabase — the run's `boundary not configured` warning only disables reading extra
  seed topics from `ingestion_seeds`, and nao's corpus view never touches Supabase.
- **Nothing is automatic**, checked in all four places it could have been: no `triggers`/`crons` in
  `wrangler.jsonc`, no `scheduled()` handler in `apps/nao/src/`, no CI workflow (the only `etl` hit
  under `.github/workflows/` is the unrelated `model-inference.yml`), and `"etl": "node
  scripts/etl.mjs"` is a manual npm script.
- **A Cloudflare cron cannot run this ETL as written.** The script reads R2 over the **S3 HTTP API**
  and shells out to `wrangler d1 execute` via `spawnSync`; a Worker has neither the CLI nor S3
  credentials, and the script's own header says *"runs LOCALLY or in CI — never inside the Worker."*
  A Worker-native rewrite against the `CORPUS` and D1 bindings would need **zero credentials** and is
  arguably the better end state, but it is a rewrite, and Workers CPU/subrequest limits are a real
  risk for thousands of UPSERTs in one invocation. Recorded as the alternative, not chosen here.
- **A schedule shortens the staleness window; it does not remove the class.** It fires when nothing
  changed and lags when something did. The class disappears only when the D1 rebuild is the **final
  step of whatever writes R2**. There is no CI ingestion job to append to today — ingestion runs
  locally, and `brain-pipeline.yml` is synthesis/verification, `workflow_dispatch`-only, and not yet
  on the default branch. So the draft treats `workflow_dispatch` as the real entry point and flags
  the `schedule` as an interim net to delete once chaining is possible.
- **`etl.mjs` does not chunk, and that is now the load-bearing risk.** It emits one SQL file and
  relies on `wrangler d1 execute --file` applying it as a single batch — its own comment says so.
  That held at ~1,300 rows; the corpus is **5,335** and heading toward ~3,000 more. So the draft runs
  `--sql-only` **first**, reports bytes and statement count, uploads the SQL, and **refuses to
  execute** above a byte guard rather than risking a half-applied index. Measuring before executing
  is the only honest way to use an unchunked writer at unknown scale.
- **Not self-merged, on purpose.** The owner authorised drafting, not landing in another session's
  tree. Shipping mode's self-merge does not extend to territory I do not own.

## Verification

| Gate | Result |
|---|---|
| workflow YAML: no tabs, well-formed | 8,322 bytes, checked |
| `tools/run4_release_gate.test.mjs` | **19/19** — a new workflow file does not disturb the `ci.yml` structure assertions |
| `node tools/context_sync.mjs --check` | passed |
| R2 read-back (`manifest/papers.jsonl`) | **5,335** records, **756** `fetched` |

- **No provider calls.** Spend unchanged at **US$1.118 OpenAI · Anthropic 0 · Agnes 18/50**.
- I did **not** run the ETL. Beyond territory, it would currently surface ~4,000 papers with **no
  full text** — `discovered` but not `fetched` — which is a larger but hollow corpus, not a better one.

## Left

- **Session B to review, adjust and land** the draft, and to decide whether the scheduled run should
  execute (it has no `inputs`, so `inputs.sql_only` is empty there and the execute step *does* run —
  called out inline).
- **Chunking in `etl.mjs`** if the byte guard trips, which the corpus size makes likely.
- Ingestion completion, then a single ETL pass so nao reflects a usable corpus.
- Layer 2 of D2 (verifier-side `mechanismCheck`); A3's full batch.

## Blockers

- None for this unit.

memory: none
