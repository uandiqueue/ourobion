---
title: Run 4 — advance the per-unit release-gate base to the PR #306 merge, and close the test-credential gitignore gap
summary: Advanced RUN4_UNIT_BASE_SHA from d880ed04 to abcba95f atomically across all four pinned sites with a regenerated (never hand-edited) attestation, restoring the full 115/8500 per-unit budget that was blocking Session B's PR #289; and committed the test_credential.md ignore rule, which was NOT present at the integration head.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 — advance the per-unit release-gate base (#307 task 1)

Issue: #307; branch: `ci/run4/advance-unit-base-307`; base and exact head:
`abcba95f8386d31c49f62f20f4b623de180e29c0` (`dev-phase2-run4` tip, = PR #306 merge commit);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

Territory: `tools/**`, `shared/brain/**`, `shared/rules/**`, `data/rules/**`,
`.github/workflows/brain-*.yml`, `supabase/**`. Session B owns `apps/**` + `shared/metrics/**`.

## Attempted

- #307 task 1: unblock Session B's PR #289 by advancing the per-unit landing base, which is my
  constant and was charging #289 for already-accepted integration history.
- Land the `test_credential.md` ignore rule the owner asked for on #307.

## Changed

### The per-unit base, advanced atomically across all four pinned sites

`d880ed04091f8aa920294eb70db4a20263ddae4e` → `abcba95f8386d31c49f62f20f4b623de180e29c0`:

| Site | What |
|---|---|
| `tools/run4_release_gate.mjs` | `RUN4_UNIT_BASE_SHA` constant + the provenance comment retaining the superseded value and the reason it went stale |
| `tools/run4_release_gate.test.mjs` | the equality assertion, and its test name (now "the accepted PR #306 integration merge") |
| `.github/workflows/ci.yml` | the `RUN4_UNIT_BASE_SHA` env |
| `supabase/deploy-attestation.json` | `provenance.unitBaseSha` — **regenerated, not hand-edited** |

Caps stay **115 / 8,500** and still fail closed. `productCapAcceptanceClaimed` stays `false`,
`hostedDeployParityClaimed` stays `false`, `scope` stays `local-only`. Only the mutable per-unit
base moved; the immutable product base, the 28 MT4 exclusions and the binary allowances are
untouched.

### `.gitignore` — the test-credential rule was NOT already landed

Added `test_credential.md` **and** `test_credentials.md`, deliberately **unanchored** so a copy in
any subdirectory is covered too (the owner's suggested `/test_credential.md` would protect only the
repo root).

## Decided

- **The issue's premise was correct and my first measurement was wrong.** I initially read the four
  pinned sites from the main checkout `C:\project\ourobion`, which is parked on the stale local
  commit `d880ed0`, and concluded the constant was already `42ae771c` with the head 162 paths over
  cap. That reading was an artifact of the stale checkout. Measured properly in a worktree at
  `abcba95`, all four sites read `d880ed04` and the delta reproduces the issue's numbers exactly:
  **73 paths / 7,720 added lines** against 115 / 8,500, leaving **42 paths / 780 lines**. PR #289
  failed with `landing delta has 9581 added lines; cap is 8500` — 9,581 − 7,720 = **1,861 lines of
  its own against 780 remaining**. Consistent. After the advance the delta is **0 / 0**, restoring
  the whole budget.
- **Route evidence was carried forward unre-probed, and the justification turned out to be much
  stronger than expected.** Docker Desktop is unavailable on this device, so no local
  `functions serve` could run and the four 401-unauthenticated route probes could not be repeated.
  The owner pre-authorised reuse on the reasoning that `generate-insights` imports `shared/brain`,
  which #306 changed, so its `moduleGraphSha256` would legitimately move while handler
  authorisation behaviour would not. **Measured, nothing moved at all:** recomputing with
  deno 2.8.1 returned **byte-identical** values for all four `moduleGraphSha256`, all four
  `entrypointSha256`, all four `importMapSha256`, plus `configSha256` and `lockSha256`. The
  attestation at `abcba95` already reflected the post-#306 graphs — an earlier PR on this line had
  regenerated it — so #306's `shared/brain` change was already absorbed. The regenerated manifest
  therefore differs from the committed one in **exactly one line**, `provenance.unitBaseSha`. With
  the entire code-identity surface unchanged there is no mechanism by which the handlers' 401
  behaviour could have moved since it was probed. **Had any graph hash differed, this reuse would
  have needed a real re-probe and I would have left #289 blocked instead.**
- **Hand-editing the attestation is not possible even in principle**, which is why regeneration was
  the only route: `buildLocalAttestation` reads `RUN4_UNIT_BASE_SHA` directly
  (`run4_release_gate.mjs:967`) and `checkDeployAttestation` fails when
  `provenance.unitBaseSha !== RUN4_UNIT_BASE_SHA`.
- **`record-attestation` needs no Docker.** It takes route evidence as an argument
  (`--routes-json` / `--routes-base64`) and does not spawn a serve; only *producing* fresh route
  evidence needs the local stack. `graph-hashes` is deterministic and Docker-free.
- **The credential ignore rule was genuinely missing, not merely mis-reported.** `git check-ignore`
  from the main checkout returned `.gitignore:13:test_credential.md`, which looked like another
  session had already landed it. It had not: that checkout carries an **uncommitted local edit**
  (`git status --porcelain .gitignore` → ` M`), and `git show abcba95:.gitignore` has no
  `credential` line at all. So on the integration line a root credentials file was untracked **and
  committable**, protected only by one machine's uncommitted working-tree change. The file exists on
  this device. Nothing matching `*credential*` is tracked or appears anywhere in history.

## Verification

All at exact head on the toolchain Node (`v26.3.0`), deno **2.8.1**, Supabase CLI **2.81.2**:

| Gate | Result |
|---|---|
| `run4_release_gate.mjs attest` (recomputes graphs from scratch, as CI does) | **PASS** |
| `tools/run4_release_gate.test.mjs` | **18/18** |
| `landing --base abcba95f… --head origin/dev-phase2-run4` | **0 paths / 0 added lines** |
| `landing` before the advance (`d880ed04` base) | 73 paths / 7,720 lines — the history #289 was charged for |
| attestation diff vs committed | **exactly 1 line** (`unitBaseSha`) |
| `git check-ignore` on `test_credential.md`, `test_credentials.md`, `sub/dir/test_credential.md` | all **IGNORED** |
| `git ls-files \| grep -i credential` / `git log --all -- '*credential*'` | nothing tracked, nothing in history |
| `node tools/context_sync.mjs --check` | passed |
| `git diff --check` | clean |

- Two Windows-specific execution notes, recorded because they cost time: `spawnSync` cannot exec a
  `.cmd` shim on Node 26 (`EINVAL`), so `--deno`/`--supabase-cli` must point at the real
  `.exe`; and because `graph-hashes` runs `deno info` with cwd set inside each function directory,
  those paths must be **absolute** or they resolve to nothing (`ENOENT`).
- **No provider calls this session.** Spend unchanged at **US$0.044**.

## Left

- **PR #289 (Session B) and PR #305 (Session C) must both re-run CI after this lands.** The advance
  fixes #289's cap failure. Both will also need the product-snapshot line refreshed, because
  `run4_release_gate.test.mjs` pins the product union measured at HEAD and every landing on this
  line invalidates every other open branch.
- #307 task 2 (#240 req 4 — a genuinely attested monotonic verification, and the
  `data/corpus/demo-edges/` artifact set #246 hard-requires), the full post-#300 flow test, and
  task 3 (the two MVP goals) are not started in this entry.
- The router verifier is still `claude-sonnet-5`; with Anthropic off-limits and synthesis on OpenAI,
  the decorrelation invariant leaves `agnes-2.5-flash` as the only legal verifier. Must be flipped
  before any live run.

## Blockers

- None for this unit.

memory: none
