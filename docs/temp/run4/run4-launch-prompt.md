---
title: Run 4 — paste-ready launch prompt (orchestrator + parallel subagents)
summary: The prompt to paste into a fresh session to start Run 4. Keeps the main agent as a pure orchestrator, mandates parallel read-only subagents with model and effort chosen per task for speed and token efficiency, and defers all safety, sequencing and unit detail to the signed orchestrator-prompt.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run 4 — paste-ready launch prompt

Paste the block below into a **new session**. It deliberately does not restate the run's safety rules,
unit definitions or gates — those live in [`orchestrator-prompt.md`](./orchestrator-prompt.md), which is
technically signed off, and in the three companion docs. Duplicating them here would let the two drift.

> **Current envelope:** U0 is locally authorized. `dev-phase2-run4` intentionally remains unprotected;
> `Run 4 Gate` is exact-current-SHA CI evidence only. Full-suite and PR-CI evidence remain pending.

---

```text
Start OUROBION RUN 4 in C:\project\ourobion.

Read these first, in order, and treat them as authoritative over anything in this prompt:

  docs/temp/run4/orchestrator-prompt.md      <- governing prompt; signed off. Follow its preflight.
  docs/temp/run4/README.md                   <- cockpit, entry state, exit gate summary
  docs/temp/run4/next-build-optimizations.md <- scope authority: P1-P7, O31-O40, tranche, S3b, S3c
  docs/temp/run4/pending-build-register.md   <- gap superset; original IDs are load-bearing
  docs/temp/run4/run3-audit-findings.md      <- why the preconditions exist
  AGENTS.md                                  <- repo single source of truth

Then follow the repo's session convention: context_sync --session-start, read the latest
docs/sessions/ entries, open a session issue, claim the task, and work in an isolated worktree.

=== YOUR ROLE ===

You are a PURE ORCHESTRATOR AND EVALUATOR. You do not write product code yourself.

- Sequence, decide, evaluate, and keep the tracking docs current.
- Delegate every bounded piece of work to a subagent with a self-contained brief.
- Verify material findings yourself before accepting them. A subagent report is evidence to
  review, not a conclusion. Several defects in earlier runs were found only because a build
  agent's self-report was independently rechecked.
- Keep your own context lean so you can still sequence correctly late in the run.

=== PARALLEL SUBAGENTS: REQUIRED ===

Launch subagents in parallel wherever the work is genuinely independent. Send them in a single
message so they run concurrently rather than in sequence.

  READ-ONLY work fans out freely and should almost always be parallel:
    repository inventory, assessment, triage, diagnosis, gap analysis, licence checks,
    log reading, adversarial review, verification of another agent's claims.

  WRITES ARE SERIALIZED: exactly ONE writer subagent at a time per worktree. Two agents editing
    the same tree will corrupt each other's work. If you need concurrent writes, give each its
    own worktree and its own branch.

Choose model and effort PER TASK, optimising for speed and token efficiency rather than
defaulting high:

  - cheap/fast model, low effort  -> inventory, greps, file listings, mechanical doc edits,
                                     fixture generation, running an existing test suite,
                                     housekeeping, status collection
  - balanced model, medium effort -> ordinary implementation, straightforward refactors,
                                     adapters, wiring, test authoring
  - strong model, high effort     -> security boundaries, RLS and authorization, migrations
                                     touching raw truth, leakage or idempotency logic,
                                     scientific-semantics decisions, adversarial review,
                                     anything where being wrong is expensive or hard to detect

Do not use a strong model where a cheap one meets the acceptance criteria. Do escalate when a
cheap attempt fails verification. Record the model and effort used for every dispatched task in
the run's tracking docs, so cost and quality can be reviewed afterwards.

Every brief must be self-contained — assume the subagent has no memory of this run — and must
state: scope, the exact files it may touch, constraints, how to verify, what "done" means, and
the required report format. Tell writers explicitly not to run git write commands; you own git.

=== AUTONOMOUS OPERATION: JAYDEN IS AFK ===

Do NOT ask for permission and do NOT stop to check in. Run continuously until the work is done or
genuinely blocked.

PRE-AUTHORIZED — proceed without asking, as long as it stays LOCAL:

  - the Android device is UNLOCKED and available: install, run, drive the Biotope app on it,
    including TalkBack and accessibility traversal;
  - run local nao (dev server, its API routes, its UI click-paths);
  - run local Supabase (Docker), migrations against it, seeding, resets;
  - run the full local harness scripts/demo-dryrun-run2.ps1 and anything in
    docs/shared/phase2-demo-runbook.md;
  - flutter analyze / flutter test / node + Deno suites / context_sync;
  - create branches, worktrees, commits, and PRs; install local dev dependencies.

IF SOMETHING NEEDS A HUMAN, SKIP IT AND CONTINUE — never idle waiting:

  - record the exact blocker in the run's blocked register: where it stopped, what is needed,
    what it gates;
  - move immediately to the next unblocked unit;
  - at the end, report every skipped item together so Jayden can clear them in one pass.

Known human-gated items you should expect to skip rather than solve:

  - P2 second `shared/` reviewer -> shared work remains deferred; no waiver
  - anything hosted or cloud: hosted Supabase writes, the cloud demo database, production
    deployment, promotion past the section 3c exit gate
  - provisioning new paid accounts, credentials, or entitlements

Sequential units normally wait on a merge. Since you must not merge, stack the next branch on the
previous one rather than idling — see the stacked-pr-chain skill for the chain mechanics and the
recovery procedure.

=== HARD CONSTRAINTS ===

- Do not merge anything. Merging is Jayden's decision. Never target main.
- Local is authorized; hosted, cloud, and production are not. If an action would write outside
  this machine, skip it and record it.
- Do not start a unit whose applicable preconditions are unrecorded. P1 is already the accepted
  unprotected-branch override; record any other blocker and move to the next unblocked unit.
- No model training in Run 4. That workstream is docs/temp/model-training/ with its own gates.
- Do not weaken a gate, delete a test, or relax an assertion to make something pass. If a test is
  wrong, fix its reasoning and say so.
- Report what actually ran versus what was only statically checked. Never claim a suite passed
  unless you can cite the exact command, environment and result.
- Interim or mock artifacts carry visible provenance markers and never persist as truth-tier data.

=== FINISHING ===

The run ends at the section 3c exit gate, not at the last unit. Both local passes must be green:

  Pass 1 - API integrity: scripts/demo-dryrun-run2.ps1, every endpoint and stage assertion green.
  Pass 2 - real-paper authoring: regenerate a relationship from doi:10.1016/j.isci.2026.116224,
           verify it, load it, generate Biotope health data, confirm the insight and provenance.
           Do NOT use the D1 paper; it is searchable but not connected to the demo insight chain.

Both passes are LOCAL, so both are pre-authorized - run them. Promotion to the cloud demo database
is NOT: stop at the gate, report the result, and leave promotion to Jayden.

Begin with the orchestrator-prompt.md preflight, then keep going without pausing. Record the
preflight result and your unit sequence in the tracking docs rather than waiting on approval.

Final report: what shipped, what actually ran versus what was only statically checked, every
skipped/blocked item with what it needs, and the two exit-gate results.
```

---

## Why the prompt is shaped this way

**It defers rather than duplicates.** Codex's `orchestrator-prompt.md` is signed off and carries the
preflight, unit definitions, caps and safety rules. Restating any of that here would create two
sources that drift apart — the exact failure this repo's two-tier-truth rule exists to prevent.

**Read-only parallel, writes serial.** Fanning out assessment is close to free and shortens the run
materially. Concurrent writers in one worktree corrupt each other, which is why that constraint is
stated as an absolute rather than a preference.

**Model choice is per task, not per run.** The expensive failure mode is a strong model doing greps;
the dangerous one is a cheap model deciding an RLS boundary. The tiering above names which is which
so the orchestrator does not have to re-derive it under time pressure.

**It runs autonomously, and skips rather than waits.** Jayden is AFK, so the prompt no longer stops
for confirmation. Run 4's preconditions are still mostly human decisions — required status checks, the
second `shared/` reviewer, closing PR #144 — but an agent that idles on them achieves nothing. The
resolution is to *record and skip*: build what is buildable, open PRs that cannot yet merge with the
blocker named, and hand back one consolidated list of what needs a human.

**The local/hosted line is the real safety boundary now**, replacing per-action approval. Everything on
this machine is pre-authorized, including the unlocked Android device, local nao and local Supabase.
Anything that writes beyond it — hosted Supabase, the cloud demo database, production, new paid
accounts — is skipped and recorded. That line is checkable by the agent without asking, which is what
makes autonomous operation safe rather than merely fast.

**Merging stays out of scope, so units stack.** Sequential units would normally wait on a merge; with
merging reserved for Jayden, the chain is built by stacking each branch on the last. Without that
instruction an autonomous run would deadlock at the first dependent unit.
