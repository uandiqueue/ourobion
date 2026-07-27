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

> **Do not paste this until Jayden explicitly starts Run 4.** The preflight will stop on unrecorded
> gates, which is intended behaviour, not a failure.

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

=== HARD CONSTRAINTS ===

- Do not merge anything. Merging is Jayden's decision. Never target main.
- Do not start a unit whose preconditions (P1-P7) are unrecorded. Record the blocker and move to
  the next unblocked unit instead of improvising around it.
- No model training in Run 4. That workstream is docs/temp/model-training/ with its own gates.
- Do not weaken a gate, delete a test, or relax an assertion to make something pass. If a test is
  wrong, fix its reasoning and say so.
- Report what actually ran versus what was only statically checked. Never claim a suite passed
  unless you can cite the exact command, environment and result.
- Interim or mock artifacts carry visible provenance markers and never persist as truth-tier data.

=== FINISHING ===

The run ends at the section 3c exit gate, not at the last unit: both local passes must be green
before anything is promoted to the cloud demo database, and the artifacts promoted must be the
same ones that passed.

Begin with the orchestrator-prompt.md preflight. Report the preflight result and your proposed
unit sequence, then stop for my confirmation before dispatching the first writer.
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

**It stops after preflight.** Run 4's preconditions are mostly human decisions — required status
checks, the second `shared/` reviewer, the base and cap. A prompt that charges past them would
produce work that cannot merge.
