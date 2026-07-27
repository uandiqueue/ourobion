---
title: Reconcile the Run 4 docs with codex, add the local qualification exit gate, and write the launch prompt
summary: My Run 4 rewrite was authored from a stale worktree and would have clobbered codex's canonical docs from PR #153; resolved by taking theirs and re-applying only additive content. Then added Jayden's two-pass exit gate, register row B-PL22, and a paste-ready launch prompt mandating parallel read-only subagents with per-task model and effort selection.
type: session
scope: shared
status: canonical
updated: 2026-07-27
---

# Reconcile Run 4 with codex, add the exit gate, write the launch prompt

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/mt3-zebra` in `C:\project\ourobion-mt3`
Task claim: `mt3-zebra-training` / `claude` / `agentjwork`

Docs only. No implementation code, no training data fetched, no compute run.

## My error, and how it was corrected

I rewrote all three Run 4 planning docs from a worktree cut **before PR #153** ("sign off Run 4
remediation prompt") landed. I checked `test -f pending-build-register.md`, saw it absent *in my
worktree*, and reported it did not exist. Jayden corrected me: it did.

PR #153 had rewritten `README.md`, `next-build-optimizations.md` and `pending-build-register.md` and
added `orchestrator-prompt.md` — 654 insertions my branch would have overwritten.

**Resolved by taking codex's version wholesale** and discarding my three rewrites. Theirs is
`status: canonical`, more current, and corrects me twice:

1. My claim that Supabase deploy *"never reads the lock"* was **unsupported** — it is unproven until
   the pinned CLI bundle path is exercised.
2. The cap should be a **landing-delta from a fresh base**, not a retroactive subtraction of unrelated
   merges from an old baseline. Their P4 is better than mine.

The final diff against the run3 tip is **additive only** — zero deletions to their content.

**Process lesson:** fetch before touching shared planning docs, not just at session start. Three
agents were writing to this branch and my worktree went stale within the hour.

## Changed

- **§3b in `next-build-optimizations.md`** — reconciles Jayden's six product priorities against the
  signed five-unit tranche, which predates the brief and covers priorities 1, 2 and part of 6 only.
  Adds candidate units **R4-U5** (single-paper ingestion with LLM stand-ins), **R4-U6a/b/c** (metrics),
  **R4-U7** (UX revamp). Records that the real Android device and live local nao move `B-UI2`,
  `B-UI5`, `B-UI6`, `B-UI11`, the O28 TalkBack traversal and `B10(access)` from blocked to doable —
  which matters because some of codex's deferrals were justified partly by untestability.
- **§3c — the exit gate.** Jayden's two-pass local qualification, running after every locked unit and
  gating cloud-demo promotion. Pass 1 API integrity via `scripts/demo-dryrun-run2.ps1`; pass 2 a
  real-paper authoring run from `doi:10.1016/j.isci.2026.116224`. Records that pass 2 **is** the
  acceptance form of R4-U5, so they are not scoped as separate work, and that promotion must carry the
  same qualified artifacts rather than a rebuild.
- **`B-PL22`** — new register row: no single production-shaped command connects ingestion to insights.
- **§C.1 in the register** — the target stand-in contract per checkpoint for R4-U5, complementing
  codex's existing "what fills it today" table.
- **`run4-launch-prompt.md`** — paste-ready launch prompt (see below).
- Zebra Z1–Z5 plan corrections from earlier in this session rode along; they did not conflict.

## Decided

- **The exit gate exists because API integrity and end-to-end authoring are different claims.** The
  harness is 21/21 green but runs from four hand-authored relationship fixtures, one fixture claim with
  a live verifier call, and simulated Biotope data. It proves every implemented API works; it proves
  nothing about whether a newly ingested paper becomes a relationship. Conflating the two would let a
  green harness authorise a cloud promotion it does not actually support.
- **Use the existing corpus paper, not the D1 paper.** `doi:10.1016/j.isci.2026.116224` already has
  canonical R2 text and a `gut_comfort_score ↔ mood_score` claim, so it is traceable end to end. The D1
  paper is searchable but unconnected to the demo insight chain.
- **The launch prompt defers rather than duplicates.** It points at codex's signed
  `orchestrator-prompt.md` for preflight, units, caps and safety rather than restating them, because
  two copies would drift. It adds only what was missing: the orchestrator/subagent policy.
- **Read-only subagents parallel, writers strictly serial.** Stated as an absolute in the prompt, not a
  preference — concurrent writers in one worktree corrupt each other.
- **Model and effort are chosen per task, not per run**, with an explicit tiering: cheap for
  inventory and mechanical edits, balanced for ordinary implementation, strong for security
  boundaries, RLS, raw-truth migrations, leakage logic and adversarial review. The prompt requires the
  model and effort used to be recorded per dispatched task.
- **The prompt stops after preflight** and asks for confirmation before the first writer, because Run
  4's preconditions are mostly human decisions and work that charges past them cannot merge.

## Left

- Run 4 remains unauthorised; the prompt is dormant until Jayden starts it.
- Preconditions P1–P7 are unresolved; P1 (required status checks) and P2 (second `shared/` reviewer)
  block over half the tranche.
- Zebra is at S2-complete; S3 onward untouched.
- The combined tranche plus the three added units plausibly exceeds a sane cap — the sizing warning in
  §3b recommends sequencing by demonstrable value and letting the remainder roll to Run 5.

## Blockers

- None for this documentation work. Nothing was merged, no gate bypassed, no unit signed off.

memory: none
