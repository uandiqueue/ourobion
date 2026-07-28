---
title: Run 4 landing-gate unit base advance for U10
summary: Advanced RUN4_UNIT_BASE_SHA to the dev-phase2-run4 tip at push time (chased through three intervening merges while blocked on a wedged Docker daemon), re-recorded the runtime attestation through the generator against a fresh live serve probe, and re-proved the gate fails closed.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 landing-gate unit base advance for U10

Branch: `ci/run4-unit-base-advance-u10`

Prerequisite for the next unit(s) to land. No product behaviour changes.

## Attempted

- Verified the live `dev-phase2-run4` tip independently with `git rev-parse
  origin/dev-phase2-run4` rather than trusting the reported value, at every step.
- Advanced the per-unit base, re-recorded the local-only deploy attestation through
  `record-attestation` against a fresh live `supabase functions serve` probe, and re-ran the
  gate's positive and injected-negative paths.
- Mid-session, Docker Desktop's daemon was found to be wedged (`docker version`/`docker ps` hung
  with no response; `supabase functions serve` hung identically). Isolated exactly which part of
  the attestation needs Docker before stopping: the config/lock/entrypoint/import-map/module-graph
  hashes are pure `deno info --json --frozen` and need no Docker at all (verified by running
  `graph-hashes` standalone); only the live routes/serveProbe evidence needs an actual running
  function. Reported the split and waited rather than fudging or reusing stale route evidence.
- After Docker was restarted, the integration tip had moved twice more while blocked (`#176`/`#190`,
  then `#217`), so the base was re-verified and re-pointed a second and third time before push,
  each time confirming the newly-landed commits didn't touch `supabase/functions/**`,
  `supabase/deno.lock`, or `supabase/config.toml` (so the attestation's graph/hash evidence stayed
  valid across the moves).
- The original worktree directory had disappeared while blocked (its git-worktree registration was
  also gone, though disk still held the branch/commit) — recreated the worktree from the existing
  branch and rebased the one local commit onto the fresh tip before resuming.

## Changed

- `tools/run4_release_gate.mjs` — `RUN4_UNIT_BASE_SHA` advanced from
  `547280f69fe37fe1c7271ea126002f9ffaadafb9` to `2749381a405de882c6d96cdf21a57034e28204ea` (the
  `dev-phase2-run4` tip at push time, after #206/#205/#208/#210/#211/#176/#190/#217 all merged since
  the U9 base). Superseded values retained as provenance, including the U10 candidate
  (`87a6364…`) that was itself superseded before push while this unit was blocked on Docker.
- `.github/workflows/ci.yml` — updated in lockstep.
- `supabase/deploy-attestation.json` — regenerated via `record-attestation`, never hand-edited,
  against a fresh live probe of all four routes (see Verification).

Caps unchanged at 115 paths / 8,500 added lines.

## Decided

- **The U9 base (`547280f`) was spent, not wrong.** Against it the integration branch measured 46
  paths / 4,456 added lines — real, already-merged work (Archive-trends, Scan-motion, hosted
  bootstrap docs, hack-MVP demo fix, Home signal-detail/placeholder-truthfulness) — leaving a
  budget too thin for the largest open units (#184 at 7,902 adds, #180 at 5,394 adds cannot land
  against it at all). `tools/run4_release_gate.mjs:27-39` documents exactly this failure mode.
- **Chased the tip to its value at push time rather than freezing an intermediate one.** The base
  moved three times while this unit was blocked on Docker (candidate `87a6364` → `9004599` after
  #176/#190 → `2749381` after #217). Freezing an earlier value would have reproduced the same
  spent-base problem this unit exists to fix. Re-verified each intervening merge left
  `supabase/functions/**`/`deno.lock`/`config.toml` untouched before trusting the already-recorded
  attestation evidence would still apply once regenerated.
- **Never substituted old route evidence for a real probe.** Even though the function graph was
  provably unchanged across every base move, the routes/serveProbe evidence was obtained from an
  actual fresh `supabase functions serve` invocation once Docker was back — not reused from the
  prior unit's manifest — per explicit instruction not to fudge attestation evidence.
- **Kept the caps at 115 / 8,500.** No unit-specific human decision exists to change them.
- The attestation regeneration reproduced every hash byte-identically and the fresh live probe
  reproduced the same route body hash as prior units (`d089c8a9…`) — independent evidence the
  regeneration is faithful and the function behaviour is unchanged, not a rewrite.

## Verification actually run

Windows, `deno 2.8.1` (installed via the official script, then pinned exactly with
`deno upgrade --version 2.8.1`), repository-local Supabase CLI `2.81.2`
(`node_modules/supabase/bin/supabase.exe` — invoking the npm package's own `.exe` sidestepped a
Windows `execFileSync` `ENOENT`/`EINVAL` failure against the `.cmd` shim in
`node_modules/.bin/`).

- `node --test tools/run4_release_gate.test.mjs` — 9 pass, 0 fail.
- `node tools/run4_release_gate.mjs config` — `run4 config/workflow gate: PASS`.
- `node tools/run4_release_gate.mjs graph-hashes` — reproduced the committed entrypoint, import-map
  and module-graph hashes for all four functions exactly, using deno alone (no Docker).
- Live `supabase functions serve --debug --no-verify-jwt` probe (against the already-running local
  Supabase stack — `supabase start` was not needed, it was already up) of all four routes — each
  reached its handler and returned HTTP 401 `Unauthorized`, sha256
  `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`. A fresh probe, not a replay.
  Stopped the serve process and removed the orphaned `supabase_edge_runtime_ourobion` container
  immediately after to free RAM (the stack was tight, ~1.2-2.1 GB free).
- `node tools/run4_release_gate.mjs record-attestation` against a freshly regenerated graph
  directory and the fresh routes evidence, then `node tools/run4_release_gate.mjs attest` —
  **PASS**. The regenerated manifest differs from the previous commit by exactly one line
  (`provenance.unitBaseSha`).
- Landing positive: `{"base":"2749381…","head":"8e1fa3f…","changedPaths":3,"addedLines":15}` — full
  115/8,500 headroom available against the new base before this unit's own tiny diff.
- Injected negatives, all correctly rejected: stale base (`87a6364…`) →
  `base must equal accepted current unit SHA 2749381…`; `--max-added 999999` →
  `maxAdded must equal accepted cap 8500`; `--max-paths 9999` →
  `maxPaths must equal accepted cap 115`; a real throwaway 9,000-line commit on the new base →
  `landing delta has 9015 added lines; cap is 8500` (deleted via `git reset --hard`, never pushed).
- `node tools/context_sync.mjs --check` — passed.

## Left

- The gate base will need advancing again after the next units integrate. That is the designed
  per-unit convention, not a defect.
- The Windows `execFileSync` `.cmd`-shim failure (workaround: invoke
  `node_modules/supabase/bin/supabase.exe` directly instead of `node_modules/.bin/supabase.cmd`) is
  not fixed in the tool itself — only routed around locally. Worth a small follow-up if more Windows
  sessions hit it, since CI runs on `ubuntu-latest` and never sees this path.

## Blockers

- None remaining. Docker Desktop's daemon was wedged for part of this session (external restart by
  Jayden resolved it) — see Attempted/Decided above for how the deno-only portion of the work
  continued during that window.

memory: none
