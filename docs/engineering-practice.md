---
title: How Ourobion is built — development cycle and engineering practice
summary: The working method behind Ourobion — owner-verified context, isolated worktrees, orchestrated agents, executable boundaries, measured tests, and evidence-led correction.
type: reference
scope: repo
status: accepted
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:41:06Z
---

# How Ourobion is Built

Ourobion is built by three human teammates working with AI agents across tools, sessions, and
devices. No agent is assumed to remember yesterday, and no confident sentence is treated as true
because an agent wrote it. The method is therefore simple at its core: keep context with the code,
isolate concurrent work, make boundaries executable, and measure claims before publishing them.

## 1. Establish Authority Before Work Begins

### Context travels with the repository

Durable context lives in version control rather than in one model's memory:

- **`AGENTS.md`** is the cross-tool authority for architecture, commands, conventions, and operating
  rules. `CLAUDE.md` and `GEMINI.md` are thin pointers to it, so guidance changes once.
- **`docs/implemented/`** describes the system that exists.
- **`docs/development/`** holds plans, process, in-flight work, and architecture decisions.
- **`docs/sessions/`** is an append-only ledger: one timestamped, device-tagged file per session,
  recording Attempted / Changed / Decided / Left / Blockers.
- **`docs/memory/`** stores one durable fact or gotcha per numbered file.
- **`docs/archive/`** preserves history but is never used as an implementation source.

The diff shows *what* changed; the session record preserves *why*. That distinction matters when a
future agent must decide whether an odd-looking constraint is obsolete or the result of a production
failure that should not be repeated.

### Documentation has an owner-verification gate

Structural consistency is not the same as truth. Files in `docs/memory/`,
`docs/development/decisions/`, `docs/hackathon/`, and the root of `docs/` begin or return to
`status: unverified` when created or materially changed. Only Jayden can promote them to `canonical`
or, for memories and decisions, `accepted`; the front matter then records `verified_by: Jayden` and
`verified_at:`.

Agents may gather evidence and prepare the wording, but they cannot award or preserve that stamp on
content they changed. Draft, stale, and superseded remain distinct lifecycle states. This keeps a
well-formatted agent claim from quietly becoming project truth.

### Truth and projections are treated differently

Ourobion separates unreconstructable truth from rebuildable projections.

| Truth | Derived projection |
|---|---|
| Supabase migrations | `baseline_snapshots` |
| User-entered raw rows | `insight_cards` |
| Shared contracts | Brain relationship instances |
| Curated graph rules | Generated semantic-graph output |

To correct a projection, we change its input or generating logic and rerun it. We do not hand-edit
the result. This is both a product-data rule and an engineering rule: provenance remains visible,
and regeneration cannot silently erase a manual fix.

## 2. Orchestrate the Work, Isolate the Writes

### One human-facing orchestrator

For a multi-agent or multi-device run, one main orchestrator is the human's coordination surface.
The human sets direction, resolves product choices, and retains approval and merge authority. The
orchestrator decomposes the goal, assigns bounded ownership, records dependencies, monitors GitHub
issues and PR comments, unblocks workers, and reviews their evidence before integration.

GitHub is the live control plane. A worker posts progress, test output, decisions, and blockers on
its issue or PR; the orchestrator can resume the run from that record even if a device or process
disappears. Workers do not depend on a private chat transcript to understand shared state.

### One issue, branch, and worktree per session

Every work session gets three linked identities:

1. A GitHub issue defining the bounded task.
2. A short-lived branch cut from `main`, named for the work (`feat/...`, `fix/...`, `docs/...`).
3. A separate git worktree at an explicit path outside the primary checkout.

The standard setup is:

```bash
gh issue create --title "<session goal>"
node tools/setup_agent_worktree.mjs \
  --branch docs/<area>/<slug> \
  --base main \
  --path <absolute-path-outside-repo>
cd <worktree-path>
```

All session edits, tests, commits, and its single `docs/sessions/` entry happen in that worktree. The
branch is renamed only before its first push, targets `main`, and is removed after its PR merges.
The primary checkout is not a shared scratchpad.

Parallel readers are safe. Parallel writers are safe only in separate worktrees with non-overlapping
ownership; writers sharing one worktree run serially. Before touching a shared planning document, an
agent refreshes its view of GitHub and the integration branch rather than relying on what was true at
session start.

This rule came from a concrete failure: three agents wrote through one branch, and one worktree was
stale within an hour. It then reported that a file did not exist when another agent had already
created it. Isolation turns that class of race into an integration question instead of silent loss.

### Delegate by task shape, not prestige

The orchestrator reserves its strongest reasoning for decomposition, architecture, adversarial
review, dependency resolution, synthesis, and final quality control. Bounded inventory, mechanical
edits, routine tests, and device checks go to cheaper agents when appropriate.

Every delegation names its scope, artifact, validation rule, and stop condition. Context is passed
narrowly, and the orchestrator inspects the result rather than accepting a worker's report as fact.
Model tier rises when validation rejects the cheaper attempt or the task truly needs deeper
reasoning. Token efficiency comes from assigning the smallest capable worker, not lowering the bar.

## 3. Make Boundaries Executable

### Cross-language contracts

The product crosses Flutter/Dart, TypeScript, and Postgres. Anything that must agree across those
surfaces lives in `shared/`: API and data types, brain relationship contracts, metric definitions,
and copy rules.

A shared-contract change requires two human reviewers. Fields are added as optional-with-default;
removal or renaming needs a migration plan. Guard tests compare Dart models, TypeScript contracts,
registry entries, SQL columns, and non-diagnostic copy rules. Drift therefore reaches a failing test
instead of a user.

The rule has stopped real work: PR #199 changed nine shared files and could not proceed until Jayden
and Alton were recorded as reviewers. Passing tests did not substitute for human review of a shared
boundary.

### Semantic and structural awareness

`graphify` builds a queryable semantic graph so an agent can retrieve the relevant subgraph rather
than load the whole repository. Its machine output is gitignored and rebuildable; a compact Markdown
view travels in `docs/graph/semantic-graph.md` for fresh clones and human review.

A single generated structural graph is intentionally deferred because Dart, TypeScript, and SQL need
different parsers. Today, curated module rules plus architecture guard tests enforce the boundaries
that matter. Any future generated structural graph will remain a projection, never hand-edited
truth.

## 4. Verify Before Integration

### Context is a machine gate

`node tools/context_sync.mjs --check` runs in the pre-push hook and again in CI. It checks session
coverage, the required `memory:` declaration, memory and decision front matter, supersession chains,
generated-index freshness, coupling-guard paths, active-document coverage, archive containment,
updated dates, decision immutability, and Jayden's verification stamp on canonical material.

A local hook can be skipped; the CI copy is the non-bypassable backstop. Documentation rot is a
failed check, not a cleanup task deferred to the next person.

### Test counts are dated evidence

Test totals change whenever code or coverage changes, so every number needs a date and revision. The
consolidated release snapshot recorded on **2026-08-02 against `main` at `5a5af7c`** was:

| Executed suite | Passed | Skipped |
|---|---:|---:|
| biotope / Flutter | 827 | 26 |
| nao / Node 26 | 407 | 1 |
| Node tools: brain-ingest | 549 | 0 |
| Node tools: llm-router | 121 | 0 |
| Node tools: rules | 179 | 0 |
| Node tools: edge-loader | 75 | 0 |
| Node tools: engine-stats | 49 | 0 |
| Node tools: metric-view | 20 | 0 |
| Root release and guard suites | 78 | 0 |
| model-training / Python | 300 | 0 |
| **Total** | **2,605** | **27** |

The active product and training suites were rerun during this documentation update and reproduced
**2,527 passing and 27 skipped** tests: Flutter 827/26, nao 407/1, Node tools 993/0, and model
training 300/0. The remaining 78 are frozen Run 4 release/guard evidence. They are deliberately
branch-bound: from this later documentation branch, three product-cap fixtures reject the changed
historical MT4 path status. The recorded 2,605 is therefore a release snapshot, not an evergreen
claim about every future branch.

**Do not cite these totals as current state.** They were correct when measured, at the revision
named above, and nowhere else. Anything that needs a live number must re-run the suites and record
its own date and revision — that is the whole point of dating them.

The **27 skipped tests are individually accounted for**:

- **25 Flutter asset-size tests** — one for each generated biomechanical-botanical PNG. The files
  total roughly 31 MB and are larger than needed for their rendered phone sizes. A measured
  downscale produced roughly 7.9 MB without a visible difference at render size, but replacing the
  binary assets trips the Run 4 binary-diff guard. The tests remain skipped until the assets land in
  a separate human-reviewed binary change; this is known performance/package-size debt, not a
  platform limitation.
- **1 Flutter accessibility test** — `MetricTile` overflows at 1.6× text scaling: approximately
  17 px horizontally and 15 px vertically in the test fixture. The fix requires scale-aware tile
  typography and remains explicitly deferred as O28 accessibility work.
- **1 nao platform test** — parses the changed PowerShell operator scripts without executing them.
  It runs only on Windows and is skipped by condition on Linux/macOS; this is platform-conditional
  coverage, not known failing behaviour.

Counts describe breadth, not confidence by themselves. They also exclude non-test verification such
as `flutter analyze`, TypeScript type-checks, four frozen Deno handler checks, SQL migration shadow
application, Python lint/format/type-check, graph drift checks, architecture enforcement, and secret
scanning. Those gates can fail a PR even when every counted test passes.

### CI reflects the repository as it is

The workflow defines nine core jobs for `main`: context and graph-view checks; Flutter analysis and
tests; shared TypeScript checking; a six-package Node-tools matrix; nao checking and tests; a
four-function Deno matrix; migration shadow application on Postgres 17; model-training core tests;
and model-training lint/type checks.

Four further jobs are scoped to the historical Run 4 integration branch: release evidence, its
aggregate gate, architecture-boundary enforcement, and the full secret/client-surface scan. Describing
them as conditional matters; a workflow file containing a check does not mean that check runs on
every branch.

## 5. Close the Loop Through GitHub

The complete development cycle is:

1. Open and claim a GitHub issue.
2. Cut a session branch from `main` in its own worktree.
3. Read the routed context, then implement only the claimed scope.
4. Run the relevant tests and checks; preserve command output as evidence.
5. Write one append-only session log and post the outcome on the issue.
6. Commit with Conventional Commits and push through the context gate.
7. Open a PR to `main`; obtain two human reviews when shared contracts changed.
8. Let CI reproduce the evidence, resolve review, and merge.
9. Regenerate indexes/semantic context where required and remove the short-lived worktree.

The issue says what was requested, the diff says what changed, the tests say what was exercised, and
the session log says why. No single artifact is asked to tell the whole story.

## 6. Keep a Record of Being Wrong

The process is useful only if it changes decisions. The running record is
**[What we got wrong, and what caught it](development/what-we-got-wrong.md)**, organised by the layer
that exposed each error and linked to its session evidence.

One early rate-limit design claimed the CORE API allowed 1,000 tokens per day with a hard stop at
950. A live request showed a roughly ten-request bucket refilling after sixty seconds. The confident
document and matching implementation were both wrong; measurement corrected them.

In another case, an approximate xDF effective-sample-size implementation would have produced
plausible statistics without verified scientific footing. The code threw deliberately instead. A
visible refusal was more reliable than an unsupported result.

These are the point of the system: repository context, independent review, executable contracts,
live verification, and human authority catch different errors. None is sufficient alone.

## 7. Scale Without Losing the Thread

As of 2026-08-02 the repository contains **268 session records**: 32 from June, 194 from July, and 42
from the first two days of August. They span multiple agents and devices, yet each can be traced to a
bounded attempt, decision, result, and handoff.

The aim is not more process. It is a development environment where additional agents increase
throughput without multiplying hidden state: context travels, writes are isolated, evidence is
reproducible, and the human owner can see what became truth.

---

**Craft is in the constraints.** The rules exist because memory-free agents made their absence
costly. Together they let the next human or agent resume without guessing.
