---
title: Phase-2 Run 2.0 — Decisions for Sign-off (D-entries)
summary: Every non-trivial choice the Run-2.0 orchestrator made autonomously — design, schema, contract, config, test-strategy, the OpenAI-only decorrelation override, any ADR/architecture amendment intent. Jayden's retroactive-review queue. shared/- or ADR-touching entries carry the B8 2-reviewer flag. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 — Decisions for sign-off

Format per entry: the choice · alternatives rejected · why · source unit. Amendments append
(`Dn AMENDED`), never rewrite. C-entries (numeric/config values) are folded in here as `C2.x` rows
to keep Run 2.0's review surface in one doc.

## D1 · Run in a dedicated worktree; carry the run inputs onto the run branch — U0

- **Choice:** run in worktree `C:\project\ourobion-run2` on `feat/phase2-run-2/*` off
  `origin/dev-phase2` @ e185cf0; commit the run's input docs (`next-build-optimizations.md` Run-2.0
  version, the adversarial-verdict doc, the orchestrator prompt) plus Jayden's two prep diffs
  (`.gitignore` non-anchored `.open-next/`/`.next/` for graphify; `tools/brain-ingest/.env.example`
  LLM-provider block) in the U0 bootstrap commit.
- **Alternatives rejected:** (a) build in the main checkout — rejected: it sits on `signoff/phase2`
  with Jayden's uncommitted sign-off work (launch prompt says worktree when the checkout is in use);
  (b) leave the input docs uncommitted — rejected: they exist ONLY in the main checkout's working
  tree, so a fresh resume session (PART R) could not reconstruct the run's inputs from the branch.
- **Why:** resumability requires branch + tracking docs to be the complete state; the inputs are part
  of that state. Note the memory that solo runs skip worktrees is superseded here by the launch
  prompt's explicit instruction (checkout in use).

## D2 · OpenAI-only posture = TEST-MODE decorrelation override (ADR amendment intent) — U1 (planned)

- **Choice (per launch prompt PART 3 — Jayden's decision, recorded here for retro-review):** all
  router nodes point at gpt-*/o* ids on `api_worker`; the synthesis↔verifier family-decorrelation
  invariant is overridden behind an explicit, clearly-labelled TEST-MODE flag. Every verifier result
  this cycle is worded "scaffolded + unit-tested", NOT "demonstrated independent verification", in
  demo/UI and logs.
- **ADR amendment intent:** touches the accepted decorrelation invariant (memory 0012 / ADR-0012
  lineage, C6/O7). Accepted ADR bodies are immutable — this entry IS the recorded amendment intent;
  flagged for retro-review. The general O7 fix (family(verifier) !== family(synthesis)) still lands
  with B5, unchanged.
- **B8 flag:** any shared/-touching implementation detail will be listed on the owning unit's entry.

## D3 · nao writes biotope tables for the simulated-data loader (design-contract deviation) — U6 (planned)

- **Choice:** implement O11 as a nao API route + page writing simulated rows into biotope's existing
  storage-primitive tables via Supabase (shared identity), provenance-flagged as simulated, dev-only.
- **Alternatives rejected:** (a) a biotope-side loader screen — rejected: PART 1 step 1 says "via a
  nao UI" (Jayden's demo definition); (b) hand-run SQL — the exact thing O11 exists to remove.
- **Why flagged:** docs/shared/biotope-nao-link.md says the apps share only identity/contracts/the
  verified_edges layer and nao never touches biotope's per-user health tables. O11 is Jayden's locked
  decision and supersedes for the demo, but the deviation is recorded for retro-review (and the link
  doc may need an amendment note next cycle). **B8-adjacent: retro-review.**

## D4 · Unit decomposition + sequencing of the FINAL worklist — U0

- **Choice:** 12 build units as in the orchestration log; contract/backend units (U1–U5) before app
  units (U6–U11); U4 carries the gap_ledger migration used by both O18 and O9; the nao CI job rides
  the first nao code unit (U6); e2e + runbook is its own final unit (U12).
- **Alternatives rejected:** (a) one-unit-per-O-item (15+ PRs, more gate runs, no cohesion — O17+O20
  are one contract-hardening seam; O16+O18 edit the same handler blocks); (b) backend-all-then-UI-all
  (delays integration feedback on the nao seam until late).
- **Why:** matches the dependency spine (O15→feature b; O16→card demo), keeps each PR one review
  surface, and caps loss-on-halt at one unit.

## D5 · evaluate-signals cron gap: fix via the U5 trigger only, not a new cron — U0/U5

- **Choice:** the shipped schedule never runs evaluate-signals (no cron, no config.toml entry). The
  demo path is the U5 on-demand trigger, which runs all three functions in sequence — so the demo
  does not need the cron. Adding the missing cron/schedule is recorded for Jayden (human-decisions
  H3), NOT done autonomously.
- **Why:** production scheduling policy (cadence, cost, pg_cron config prereqs per memory 0005) is a
  product call the backlog does not answer; the run's boundary rule says record, don't resolve.

## D6 · TEST-MODE flag shape + router surface changes — U1

- **Choice:** `testMode: { reason: string }` in router.config.json (non-empty reason mandatory;
  reason text records posture, date, Jayden attribution, revert instruction). With the flag, the two
  decorrelation clauses downgrade to a loud warning; without it, validation hard-fails exactly as
  before (test-proven). Warning sink injectable (`validateConfig(raw, {warn})`, default
  console.warn). `route()` results + `checkConfig` carry testMode state; `decorrelation.ok` widened
  `true` → `boolean` (false only reachable under TEST-MODE; sole consumer updated in-commit).
  Exported label constant: `scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation
  OFF)` — downstream units MUST stamp verifier verdicts/UI/logs with it.
- **Alternatives rejected:** env-var flag (invisible in the committed config = not "clearly
  labelled"); silently removing the invariant (forbidden — O7's general fix still lands with B5).
- **Source:** U1 (PR #124). Anthropic/google provider + price rows kept so re-arming decorrelation
  is config-only.

## C2 · Run-2.0 router config values — U1

| id | value shipped | alternatives | rationale |
|----|---------------|--------------|-----------|
| C2.1 | synthesis + verifier → `gpt-5`; seeder/phrasing_card/extract_assist/report_narrative → `gpt-5-mini`; ALL routes `api_worker` | o4-mini for cheap tier | PART 3 mandates gpt-*/o* on api_worker; gpt-5 for the two quality-critical nodes, mini for volume nodes |
| C2.2 | `perDayUsdPerNode` 1.00 USD; per-run output-token cap 60000; hard-stop 0.95 kept | prior $5/day/200k | 20 SGD run cap ⇒ keep the guardrail well under it (6 nodes × $1 = worst-case $6/day) |
| C2.3 | price row `gpt-5-mini: 0.25/2.0 USD per MTok, provisional: true` | — | OpenAI list price at ship time; provisional pending O8 calibration |

Operational note (U1 smoke): gpt-5-family models spend ~70 reasoning tokens on trivial prompts —
undersized maxOutputTokens yields empty visible text. Size generously in downstream units.

_(Further D-entries appended per unit as the run executes.)_
