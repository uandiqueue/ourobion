# Session 20260703T065307Z — agentjwork — claude — nao-corpus-run-plus-controls

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-sonnet-5) · **Branch:** `feat/nao/ingest-control-api` (cut from `dev-phase2`) · **Issue:** —
- **Type:** Feature + fixes. Ran the brain-ingest pipeline for real for the first time, fixed bugs it surfaced, corrected wrong rate-limit assumptions, and added a way to invoke/control ingestion from the nao UI.

## Attempted

Owner asked to explore `tools/brain-ingest` and actually use it. That turned into: running it hard
enough to surface real bugs, fixing them, discovering the CORE rate-limit model was fabricated and
correcting it, adding a host-memory guard after the dev machine hit ~5% free RAM, and — after the owner
pushed back on the first control-plane design — rebuilding it around triggering real runs via GitHub
Actions instead of a local-only CLI.

## Changed

**Live ingestion run (no code, just usage):** grew the R2 corpus from 190 papers (1 topic, 7 fetched) to
1232+ across all 6 seed topics, ~750+ fetched with real full text. Confirmed the pipeline works
end-to-end against live APIs.

**Bug: `extractFromPdf` detached-ArrayBuffer** (`tools/brain-ingest/src/extract.ts`) — `unpdf` takes
ownership of the buffer it's handed and detaches it; `run.ts` reused that same buffer to upload the PDF
right after extracting text, so every arXiv-sourced paper failed with "Cannot perform Construct on a
detached ArrayBuffer". Fixed by extracting from `bytes.slice()`. Regression test added.

**New: `src/retrieval/directOa.ts`** — fetches `record.oa.bestOaUrl` (already resolved for free by
OpenAlex/Unpaywall during OA-location) directly, ahead of CORE, so CORE's quota isn't spent on content
already located. Wired into `run.ts`'s `retrieveRecord()` as step 4 (CORE renumbered to step 5).

**CORE's rate-limit model was fabricated — corrected after live verification.** The design doc and
`limits/budget.ts` modeled CORE as "1000 tokens/day, hard-stop 950" with no real evidence behind that
number. Live header inspection (`X-RateLimit-Limit`/`X-RateLimit-Remaining` on real API calls) showed
the actual constraint is a **~10-request bucket that fully refills ~60s after exhaustion** — confirmed
by driving it to a real 429 and watching `remaining` reset exactly 65s later. Fixes:
- Removed CORE from `limits/budget.ts`'s `BUDGETS` entirely (no daily cap exists to model).
- Corrected `limits/rateLimiter.ts`'s `core` profile from an unverified `~1/s` guess (6x too fast) to
  the real `10/60s`, and added the same live-verification treatment to the rest of the table: arXiv
  (1/3s) and NCBI (3/10 req/s) checked out exactly against current docs; Crossref was found
  conservative (we ran 5/s+concurrency2 against a real 10/s+concurrency3 limit) and corrected to match.
- Added 429-aware retry to `retrieval/core.ts` (`fetchJsonWithRetry`/`fetchBytesWithRetry`, ~61s wait
  matching the confirmed refill window).
- Removed the whole-loop budget hard-stop in `run.ts` that used to `break` the ENTIRE retrieval loop
  once CORE neared its (fictional) cap — it was blocking the free steps (PMC/arXiv/directOa) too, which
  never touched CORE's budget at all. Each metered source now self-guards independently.
- Skip CORE entirely for `retrievability:'paywalled'` records (OA-location already confirmed no OA
  copy; live corpus data showed paywalled/unknown as the single largest category of empty CORE calls).

**New: host-memory guard (`limits/memoryGuard.ts`)** — pauses briefly before a retrieval attempt if the
host machine is critically low on free RAM (default: <10% or <512MB), then proceeds regardless
(soft-fail; ingestion's own footprint is small, never skip real work over ambient system load). Root
cause investigated directly: the dev machine had ~5% free RAM from 13 concurrent Claude Code processes
+ 23 VS Code windows + a 3.4GB WSL VM + a leftover `nao` dev server, unrelated to ingestion itself.
Opt-in via `RunOptions.memoryGuard`; the CLI enables it by default.

**Remote control + invocation from nao.** First design: a `control/ingest-config.json` mailbox in R2
where nao queued a `requestedRun` for some later `--remote-control` CLI invocation to notice. Owner
correctly pushed back: that can't actually invoke a run on demand, only leave a note. Redesigned around
the real constraint (nao is a Cloudflare Worker and cannot run the CLI's long-running work itself,
regardless of how deterministic it is) — owner chose GitHub Actions as the compute:
- `.github/workflows/brain-ingest.yml` — `workflow_dispatch` with `seed`/`limit` inputs, writes `.env`
  from repo secrets, runs `ingest --remote-control` on a GitHub-hosted runner.
- `apps/nao/src/lib/githubDispatch.ts` + `app/(app)/api/ingest-control/trigger/route.ts` — nao's
  "Run now" button dispatches the workflow immediately (inputs passed straight through, no polling).
- Removed the now-redundant `requestedRun` mailbox from both sides — `IngestControlConfig` carries only
  `paused` (checked before both "Run now" and any `--remote-control` CLI run) and the OpenAlex budget
  override.
- `app/(app)/api/ingest-control/route.ts` (settings GET/POST), `app/(app)/ingest/page.tsx` +
  `components/IngestControlPanel.tsx` (pause/resume, Run now, budget override) — gated by the existing
  Supabase middleware, no new auth code.

## Decided

- **CORE's real constraint belongs in the rate limiter, not the budget guard** — a daily-quota
  abstraction doesn't match a per-minute token bucket's shape; better to remove it than keep a
  "corrected" but still-fictional number.
- **Don't silently drop work over ambient system load** — the memory guard always proceeds after its
  wait budget; a busy host machine is not a reason to leave a paper unfetched.
- **A queued-request mailbox is the wrong shape once direct triggering is possible** — `workflow_dispatch`
  accepts inputs directly, so stashing seed/limit in R2 for later pickup became dead weight; removed
  rather than left alongside the new path.
- **Secrets are set by the owner, not pushed by the agent** — both the GitHub Actions repo secrets and
  the `GH_ACTIONS_TOKEN` Worker secret are documented (names + where each value comes from) but
  deliberately not transmitted through this session.

## Left

- **Not live-tested:** an actual GitHub Actions dispatch, or the authenticated nao UI flow — no
  `GH_ACTIONS_TOKEN` or test Supabase login available in this environment. Owner needs to: add the
  GitHub repo secrets (§8.1 in `docs/nao/BRAIN-INGESTION-DESIGN.md` lists them), mint a fine-grained PAT
  for `GH_ACTIONS_TOKEN` (Actions: Read and write, scoped to this repo only), and set `GH_ACTIONS_TOKEN`
  + `GH_REPO` (+ optionally `GH_ACTIONS_REF`) as nao Worker secrets before this can actually dispatch.
- **PR #38** (`feat/nao/ingest-control-api` → `dev-phase2`) is open, pushed, **not merged** per explicit
  instruction — two commits so far (the CORE/rate-limit/memory-guard fixes, then the GitHub Actions
  redesign), this session log is a third.
- This entire session ran directly against `dev-phase2`'s working tree without a dedicated worktree
  until the branch was cut partway through (AGENTS §7 asks for one worktree per session from the start)
  — noted for next time, not fixed retroactively.
- OpenAIRE as a supplementary OA-link source for the ~213 `pdf`-classified-but-still-unresolved records
  (directOa's URL didn't pan out, CORE didn't have it either) — researched, not built.

## Blockers

None currently. All required API keys were present for the live ingestion; the remaining GitHub/Worker
secrets are an owner action item, not a blocker on committed code (everything opt-in, defaults to
today's uncontrolled behavior when unset).
