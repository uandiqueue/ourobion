# AGENTS.md — Ourobion

> **This is the durable, cross-tool instruction and routing file for AI agents in this repository.**
> `CLAUDE.md` and `GEMINI.md` point here. Humans start with [`README.md`](README.md) and
> [`docs/repository-guide.md`](docs/repository-guide.md).

This file deliberately contains only stable instructions, boundaries, role definitions, and pointers.
It must not become a snapshot of current implementation or project status. Phase status, team
assignments, active branches/PRs, released models, function inventories, credentials, tool versions,
test totals, and other fast-changing facts belong in their owning documents, code, configuration, or
GitHub record—not here.

## 1. How an agent finds current truth

Do not rely on model memory or assume that a linked document is current merely because it exists.

1. Run `node tools/context_sync.mjs --session-start`.
2. Determine whether this is a continuation of an existing issue/session/worktree. If it is, continue
   those artifacts; a restarted agent process or compacted conversation is not a new session.
3. Read the active issue/PR and the latest relevant files in `docs/sessions/`.
4. Use the routing table below to find the owning document.
5. For implementation claims, inspect the current code, contracts, migrations, tests, and CI
   configuration before acting.

Use this authority order:

1. Explicit current direction from Jayden.
2. A document carrying Jayden's valid signature or `verified_by: Jayden` stamp in its applicable
   verified state—including an accepted memory record. Trust it within its stated scope. If
   implementation differs, report drift rather than silently discarding the owner-verified source.
3. Executable artifacts—contracts, migrations, current code, tests, and CI—for implemented behaviour.
4. A recent `docs/development/` document whose `updated` date is relevant to the work and whose claims
   do not contradict owner direction, verified records, executable evidence, or the active GitHub
   record. Ordinary development docs do not need a human-verification stamp to be useful working
   context.
5. Active issue/PR evidence and recent session logs for in-flight state.

`docs/memory/` is maintained again; its verification state determines authority. `docs/implemented/`
is currently stale. Use it only as older design/context material and verify every claim elsewhere
before acting. `docs/archive/` is frozen history and is never an implementation source. Report
material contradictions instead of silently selecting one source.

## 2. Repository routing table

AGENTS.md points; the owning sources carry detail.

| Need | Start here |
|---|---|
| Product identity, current human orientation, demo/run entry | [`README.md`](README.md) |
| Human repository navigation | [`docs/repository-guide.md`](docs/repository-guide.md) |
| Full documentation map and lifecycle state | [`docs/INDEX.md`](docs/INDEX.md) |
| Product principles and owner-approved orientation | Signed [`README.md`](README.md) and accepted [`docs/memory/`](docs/memory/) records |
| Durable cross-session facts and gotchas | [`docs/memory/README.md`](docs/memory/README.md), then the relevant accepted, Jayden-verified record |
| Implemented behaviour and measured state | Current contracts, migrations, code, tests, CI, and dated evidence |
| Repository layout and environment-file ownership | [`docs/development/structure-context.md`](docs/development/structure-context.md) |
| Shared cross-language contracts | [`shared/SHARED-CONTEXT.md`](shared/SHARED-CONTEXT.md) and `shared/` |
| Module boundaries and change blast radius | Public façades, `couplings.yaml`, guard tests, and current contracts |
| Recent plans, process, design work, and next work | Recently updated [`docs/development/`](docs/development/) documents with no contradiction, plus active issues and PRs |
| Detailed agent routing/review protocol | [`docs/development/agent-protocol.md`](docs/development/agent-protocol.md) |
| Human development workflow | [`docs/development/dev-workflow.md`](docs/development/dev-workflow.md) |
| Engineering and orchestration practice | [`docs/engineering-practice.md`](docs/engineering-practice.md) |
| Commit format | [`docs/development/commit-conventions.md`](docs/development/commit-conventions.md) |
| Model-training rules and current roster | [`docs/development/model-training/README.md`](docs/development/model-training/README.md) |
| Commands and supported versions | nearest `README.md`, package manifest, setup script, and [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| Older authored design narrative | [`docs/implemented/`](docs/implemented/) — known stale; background only until refreshed |

If routed sources conflict, apply the authority order above. A conflict with an owner-verified source
may be implementation drift; a conflict in a lower-authority source may be documentation staleness.
Resolve it in the owning surface and do not copy the volatile correction here unless it changes a
durable invariant.

## 3. Durable product and architecture invariants

These rules remain here because every agent must carry them across tools and sessions:

- **Non-diagnostic by construction.** User-facing language is observational. Do not claim diagnosis,
  treatment, prevention, or causation from an association. The executable copy constraints live in
  `shared/constants/copy_guidelines.{ts,dart}`.
- **Privacy and isolation are product boundaries.** Preserve consent, RLS/data isolation, PDPA-aware
  handling, and privacy-safe community/operations surfaces. Never put personal health data or secrets
  in source, logs, issues, fixtures, or shared demonstration accounts.
- **Raw truth is preserved; projections are rebuilt.** Fix a projection through its source data or
  generating logic, then regenerate it. Do not hand-edit rebuildable analytical output as though it
  were source truth. Preserve user-authored state when regenerating mixed records.
- **Graceful degradation.** Missing optional data must reduce confidence or capability honestly, not
  fabricate completeness or break the core logging experience.
- **Module boundaries are public interfaces.** A module must not import another module's `/impl`; use
  its public façade.
- **`shared/` is the cross-language seam.** Anything that must agree across Dart, TypeScript, and SQL
  belongs in a shared contract or an explicitly guarded boundary. Product surfaces do not import one
  another's implementation code.
- **Shared-contract changes require two human reviewers.** Add fields compatibly, normally
  optional-with-default. Removal or renaming requires a migration plan.
- **Evidence is not serving permission.** A verified relationship, trained artifact, or generated
  rule does not automatically become user-facing behaviour. Serving requires the applicable product,
  safety, provenance, contract, and review gates.

## 4. Agent work protocol

### Continue before creating

First determine whether the requested work already belongs to an active issue, branch, worktree, or
session log. Continue existing artifacts when they exist. Do not open duplicates merely because a new
agent instance joined the work.

### New leaf session

For a genuinely new independent work unit:

1. Open or claim one bounded GitHub issue.
2. Create one short-lived branch in one isolated worktree.
3. Resolve the branch base and PR target from the active run/protocol; do not infer them from an old
   session log. Pass the chosen base explicitly to the setup tool.
4. Keep concurrent writers in separate worktrees with non-overlapping ownership.
5. Write exactly one session record for that leaf session.

```bash
gh issue create --title "<work-unit goal>"
node tools/setup_agent_worktree.mjs \
  --branch <type>/<area>/<slug> \
  --base <current-integration-base> \
  --path <absolute-path-outside-repo>
```

Use `gh` for GitHub issues, PRs, reviews, comments, and checks. Use `git` for local history,
worktrees, commits, and branch transport. Preserve unrelated dirty-worktree changes; they belong to
the user or another active work unit unless proven otherwise.

### Session record

Each leaf session owns one append-only file:

```text
docs/sessions/<UTC-timestamp>-<device>-<agent>-<slug>.md
```

Record `Attempted / Changed / Decided / Left / Blockers` and a `memory:` line. Use `memory: none`
unless the session actually adds, changes, or supersedes a durable memory record. Update the same file
throughout the session; do not create a second log after context compaction or agent restart.

Before PR handoff, post the outcome, evidence, and blockers to the issue/PR control plane. Link the
issue from the PR and request the required reviewers.

### Same-device coordination

Use the repository coordinator when work could overlap:

```bash
node tools/shared_memory.mjs list
node tools/shared_memory.mjs claim --task "<name>" --agent "<agent>" --device "<device>"
node tools/shared_memory.mjs release --task "<name>"
```

The coordinator prevents duplicate work; it is not durable project history. GitHub and session logs
remain the durable record.

## 5. Agent roles

These terms describe responsibility, not a particular model or vendor.

### Worker agent

A worker owns a bounded artifact or investigation. It stays inside the assigned scope, validates its
result, records evidence and blockers, and does not make integration decisions outside that scope.

### Orchestrator

An orchestrator coordinates a bounded task graph or run. It:

- decomposes the goal into non-overlapping units;
- assigns scope, expected artifact, validation rule, dependencies, and stop condition;
- selects worker capability by task shape;
- monitors progress and resolves or escalates blockers;
- reviews evidence and diffs rather than accepting status reports as proof;
- controls sequencing and recommends integration, while leaving owner-only approval to the owner.

An orchestrator may also implement a small, tightly coupled, or safety-critical part directly, but it
must not let direct editing displace coordination and independent review.

### Master orchestrator

A master orchestrator is the **single human-facing coordinator** for a multi-session, multi-agent, or
multi-device effort. It has the orchestrator duties above plus responsibility for the global
dependency graph, issue/PR stack, cross-device ownership, integration order, and final synthesis.

The human communicates run direction to the master orchestrator. Workers and subordinate
orchestrators report through GitHub issue/PR comments so the run does not depend on private side
channels. The master continuously monitors that control plane, answers or reassigns blockers, and
reviews every result before recommending integration.

A master-orchestrated run may use one umbrella issue across multiple sessions and stacked work units.
That does not relax write isolation: every concurrent writer still needs a distinct branch/worktree,
clear ownership, and leaf-level verification evidence. Separate leaf issues are optional only when
the umbrella issue and PR records remain unambiguous.

## 6. Delegation invariants

Delegate by task shape, not prestige. Use the smallest capable worker for bounded inventory,
mechanical edits, routine tests, and device checks; use stronger reasoning for architecture,
adversarial review, dependency resolution, and final synthesis.

Every delegated task states:

- bounded scope and ownership;
- expected artifact;
- validation rule;
- dependencies and permitted writes;
- stop condition and blocker-reporting route.

Parallel work is appropriate only when units are genuinely independent or isolated. The delegating
agent must inspect material findings and changes before accepting them. Model names and tier mappings
belong to tool/session configuration, not this durable repository file.

## 7. Documentation and owner verification

Repository documentation has distinct roles:

- `docs/implemented/` is currently stale older design/context material, not present-state authority.
- `docs/development/` contains plans, process, ADRs, and in-flight material. Ordinary development
  docs have no human-verification gate: a recent `updated` date plus absence of contradiction makes
  them usable working context.
- `docs/sessions/` records what happened and why.
- `docs/memory/` is the maintained durable-fact/gotcha layer. Trust accepted records carrying
  Jayden's verification stamp within their scope; treat unverified records as leads pending review.
- `docs/hackathon/` contains submission material.
- `docs/archive/` is frozen history and is never an active implementation source.

Where a document class uses the owner-verification gate, material agent edits return it to
`status: unverified` and remove stale `verified_by`/`verified_at` values. Only Jayden may apply his
signature or verification stamp and promote a governed record to its verified state. A valid Jayden
stamp is semantic authority, not merely formatting. Memory and decision records use their defined
lifecycle; accepted ADR bodies are immutable and must be superseded rather than rewritten.

After changing indexed documents or record front matter, run:

```bash
node tools/context_sync.mjs --fix-index
npm run context:check
```

The context gate checks repository consistency; it does not prove that prose is factually current.

## 8. Change awareness and verification

Before changing code, inspect the relevant public contracts, `couplings.yaml`, migrations, and guard
tests. Use Graphify when its local projection is installed and current; otherwise use `rg` and the
owning sources. Generated graph output is a rebuildable aid, never authority and never hand-edited.

Choose verification based on the changed surface. Obtain exact commands and supported versions from
the owning package, setup scripts, and current CI workflow rather than copying them into this file.
Report the revision, platform, commands, result, skips, and known gaps. A test count or workflow job
without its revision and branch conditions is not reusable evidence.

Before handoff:

1. Confirm the diff matches the claimed scope and preserves unrelated work.
2. Run the relevant product, contract, migration, security, and documentation checks.
3. Run `git diff --check` and `npm run context:check` when applicable.
4. Update the existing session log and GitHub control-plane record.
5. Leave owner-only verification, approval, and merge decisions to the owner.

## Owner verification

Pending Jayden's review and signature.
