# Ourobion

**A One Health personal ecological health monitor for the ASEAN market.** Ourobion connects human
physiology, daily behaviour, and environmental context so people can understand patterns in their gut
health, hydration, vector exposure, and ecological wellbeing — in under 30 seconds of logging a day,
and **without ever making a diagnostic claim**.

> This README is the **human front door** — what ourobion is, and how to run it. AI coding agents
> have their own front door: **[`AGENTS.md`](AGENTS.md)**.

**Start here, depending on what you want:**

| | |
|---|---|
| 📖 **What Ourobion is and why it exists** — the problem that produced it, who it is for, what biotope and nao each are and why they are separate, and what the logo encodes | [`docs/project-overview.md`](docs/project-overview.md) |
| 🛠 **How we build** — the development cycle, machine-enforced context, executable cross-language contracts, the two-reviewer rule, and how concurrent AI agents coordinate | [`docs/engineering-practice.md`](docs/engineering-practice.md) |
| 📊 **What actually exists, measured** — tests, schema, corpus and brain-pipeline output, every figure from executed commands | [`docs/implemented/system-truth.md`](docs/implemented/system-truth.md) |

---

## ✨ What it is

Ourobion surfaces *descriptive* patterns and insight cards from a small set of high-yield signals. It
never diagnoses — every user-facing string uses observational language ("your data shows a pattern",
never "you may have X"). Privacy is structural: personal health data is isolated from community data,
consent is granular, and community aggregates only publish above per-region thresholds.

**Two surfaces, one brain:**

| Surface | What it is | Run it |
|---|---|---|
| 🌱 **biotope** | The mobile app (Flutter, iOS + Android) — 30-second daily logging + descriptive insight cards. | [`apps/biotope/README.md`](apps/biotope/README.md) |
| 🧠 **nao** | The web "window into the brain" — a Next.js research/claims operations dashboard built for Cloudflare; production deployment evidence is still pending. | [`apps/nao/README.md`](apps/nao/README.md) |

Product principles in full: [`docs/implemented/project-context.md`](docs/implemented/project-context.md).

---

## 🧬 The brain — an evidence-tiered, verified relationship graph

Ourobion's insights need a *reason*, not just a correlation in one person's data. **The brain** is the
reusable layer of "what relates to what, and how strongly the science backs it": a knowledge graph
whose **nodes are metrics** and whose **edges are relationships** synthesised from the scientific
literature — and it pays its quality cost at ingestion time, by design:

- **Two passes, two records.** A synthesis LLM proposes an edge; a **second, independent LLM**
  re-checks it against **freshly-retrieved** evidence. Separate records, so verification can re-run
  with a better verifier without re-synthesising.
- **Grounded and adversarial — enforced, not just prompted.** A `supported`/`contradicted` verdict
  *requires* the verifier to have done independent retrieval (a schema invariant); with no fresh
  grounding the verdict can only be `uncertain`.
- **Trust is graded, not binary.** A study-design ladder (`evidenceTier` 1–5), a separate venue
  `impactTier`, corroboration counts, and per-failure-mode checks roll into a 0..1 `edgeScore` that
  gates whether and how an edge is served.
- **Rebuildable projection.** The *contract* (`shared/brain/`) is git-tracked truth; the *edges* are a
  rebuildable projection — never hand-edited. To change a verdict you fix the input and re-run.

Design + rationale: [`docs/implemented/nao/brain-synthesis-design.md`](docs/implemented/nao/brain-synthesis-design.md) ·
[`docs/implemented/nao/brain-ingestion-design.md`](docs/implemented/nao/brain-ingestion-design.md). Contract:
[`shared/brain/`](shared/brain/).

---

## 🚪 Where to go next

### 👤 Humans — start here

| You want… | Look in |
|---|---|
| **Run the biotope app** (env, toolchain, Android) | [`apps/biotope/README.md`](apps/biotope/README.md) |
| **Run the nao web dashboard** (env, D1/ETL, deploy) | [`apps/nao/README.md`](apps/nao/README.md) |
| **Product design** — principles, goals, phases | [`docs/implemented/project-context.md`](docs/implemented/project-context.md) · [`docs/development/phase-2-plan.md`](docs/development/phase-2-plan.md) |
| **System architecture & data flows** | [`docs/implemented/biotope/architecture-context.md`](docs/implemented/biotope/architecture-context.md) |
| **Repository layout & structure rules** | [`docs/development/structure-context.md`](docs/development/structure-context.md) |
| **UI design** — tokens, components | [`docs/implemented/biotope/ui-design-context.md`](docs/implemented/biotope/ui-design-context.md) (app) · [`docs/implemented/nao/nao-app-design.md`](docs/implemented/nao/nao-app-design.md) (nao) |
| **The brain** — design + ingestion | [`docs/implemented/nao/brain-synthesis-design.md`](docs/implemented/nao/brain-synthesis-design.md) · [`docs/implemented/nao/brain-ingestion-design.md`](docs/implemented/nao/brain-ingestion-design.md) |
| **Insight-engine architecture** (authoritative, both apps) | [`docs/implemented/insight-engine-architecture.md`](docs/implemented/insight-engine-architecture.md) · ADRs [`docs/development/decisions/`](docs/development/decisions/) · seam [`docs/implemented/biotope-nao-link.md`](docs/implemented/biotope-nao-link.md) |
| **Insights engine (biotope serve) / metrics registry** | [`docs/implemented/biotope/rules-engine-design.md`](docs/implemented/biotope/rules-engine-design.md) · [`docs/implemented/biotope/metrics-registry-design.md`](docs/implemented/biotope/metrics-registry-design.md) |
| **Hackathon** (Launchpad 2026 strategy) | [`docs/hackathon/the_launchpad_challenge/plan/`](docs/hackathon/the_launchpad_challenge/plan/) — direction, narrative, judging self-review |
| **Shared contracts** (TypeScript ↔ Dart) | [`shared/SHARED-CONTEXT.md`](shared/SHARED-CONTEXT.md) |
| **Decisions & rationale** | [`docs/memory/`](docs/memory/) (indexed decisions) · [`docs/development/decisions/`](docs/development/decisions/) (architecture ADRs) · [`docs/sessions/`](docs/sessions/) (per-session logs) |
| **Dev workflow** (Issue → PR → merge) | [`docs/development/dev-workflow.md`](docs/development/dev-workflow.md) · [`docs/development/commit-conventions.md`](docs/development/commit-conventions.md) |

### 🤖 AI agents — start at [`AGENTS.md`](AGENTS.md)

`AGENTS.md` is the **single, tool-agnostic source of truth** for agentic tools: how to build here and
the principles to follow. `CLAUDE.md` / `GEMINI.md` are thin pointers to it, so guidance never drifts
between Claude, Codex, and Gemini. The AI routing table, truth hierarchy, and PR-review checklist live
in [`docs/development/agent-protocol.md`](docs/development/agent-protocol.md).

> **The split:** humans are pointed to *decisions, rationale, and how to run the apps* (this README).
> Agents are pointed to *how to build and the principles to follow* (`AGENTS.md`). Neither duplicates
> the other.

---

## 🏗 How this repo is built — and why

Ourobion is built largely by **AI coding agents** alongside humans — sometimes several on one machine.
Agents start every session blank, so the repo treats **context as a first-class, version-controlled,
machine-enforced artifact**. The durable *why* is here; the agent-facing *how* is `AGENTS.md`.

1. **The repo is the single source of truth** — nothing important lives in a tool's head; one
   authoritative file (`AGENTS.md`), thin per-tool pointers.
2. **Separate stable from in-motion** — a *constant* layer (`docs/*-CONTEXT.md`) apart from a
   *variable* layer (`docs/sessions/`), so docs don't rot.
3. **Two-tier truth** — hand-authored inputs are **truth**; anything a job can recompute (baselines,
   insight cards, the knowledge graph, the nao search index) is a **rebuildable projection**, never
   hand-edited.
4. **Append-only, one file per session** — parallel agents never edit a shared status file.
5. **Executable contracts** — cross-language couplings (TS type ↔ Postgres column ↔ Dart model) are
   pinned by guard tests ([`docs/graph/couplings.yaml`](docs/graph/couplings.yaml)), so drift fails a
   test, not production.
6. **Enforce automatically** — a pre-push hook *and* CI re-run the same checks (session logged, memory
   index resolves, every coupling guard exists).
7. **Isolate concurrent work** — issue + branch + git worktree per session.
8. **Fight context overload** — a semantic knowledge graph (graphify, below) serves agents only the
   relevant slice.

---

## 🧭 Code navigation — graphify

The repo indexes its **own source** into a queryable semantic graph
([graphify](https://github.com/safishamsi/graphify)) so an assistant (or you) can pull a small,
relevant slice instead of grepping the whole tree. It is **dev tooling** — not part of the app —
bounded to the project toolchain. The machine graph lands in gitignored `graphify-out/`; its single
tracked, generated human overview is [`docs/graph/semantic-graph.md`](docs/graph/semantic-graph.md).

```bash
graphify query "<question>"      # the relevant subgraph for a question
graphify path "<A>" "<B>"        # shortest relationship between two symbols
graphify explain "<concept>"     # a node and its neighbours
npm run graph:view:write         # refresh the tracked human view after a direct update
```

Auto-installed by the setup scripts; pre-wired for Claude Code / Codex / Gemini CLI. Full detail
(rebuild, the optional semantic pass, API-key/cost notes):
[`docs/graph/README.md`](docs/graph/README.md).
