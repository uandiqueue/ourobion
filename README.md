# Ourobion

**A One Health personal ecological health monitor for the ASEAN market.** Ourobion connects human
physiology, daily behaviour, and environmental context so people can understand patterns in their gut
health, hydration, vector exposure, and ecological wellbeing — in under 30 seconds of logging a day,
and **without ever making a diagnostic claim**.

> This README is the **human front door** — what ourobion is, and where to find how to run it, the
> decisions behind it, and the design. AI coding agents have their own front door:
> **[`AGENTS.md`](AGENTS.md)**.

---

## ✨ What it is

Ourobion surfaces *descriptive* patterns and insight cards from a small set of high-yield signals. It
never diagnoses — every user-facing string uses observational language ("your data shows a pattern",
never "you may have X"). Privacy is structural: personal health data is isolated from community data,
consent is granular, and community aggregates only publish above per-region thresholds.

**Two surfaces, one brain:**

| Surface | What it is | Run it |
|---|---|---|
| 🌱 **biotope** | The mobile app (Flutter, iOS + Android) — 30-second daily logging + descriptive insight cards. | Build from source — [Launch it](#-launch-it) |
| 🧠 **nao** | The web "window into the brain" — a Next.js research/claims operations dashboard on Cloudflare. | **Live at [nao.ourobion.com](https://nao.ourobion.com)** |

Product principles in full: [`docs/shared/project-context.md`](docs/shared/project-context.md).

---

## 🚀 Launch it

### 🧠 nao — live, nothing to install

**[https://nao.ourobion.com](https://nao.ourobion.com)** — sign in and it works. This is the fastest
way to see the brain: the paper corpus, relationship claims, verification verdicts, and the loader.

### 🌱 biotope — build and run locally

biotope is a Flutter app and is **not** hosted, so it has to be built from this repo. Hosting it as a
web app is deliberately deferred ([#283](https://github.com/uandiqueue/ourobion/issues/283)).

```bash
# 1 · one-time toolchain setup
#     Windows:        .\scripts\setup.ps1     then, in EVERY new shell:  . .\scripts\biotope-env.ps1
#     macOS / Linux:  see apps/biotope/README.md

# 2 · point the app at a backend (see below), then:
cd apps/biotope
flutter pub get
flutter run
```

Full environment, toolchain and Android/emulator detail — including the Windows build-memory
envelope — is in **[`apps/biotope/README.md`](apps/biotope/README.md)**.

**Which backend?** Copy [`apps/biotope/.env.public.example`](apps/biotope/.env.public.example) to
`apps/biotope/.env.public` and fill it in:

| Goal | `SUPABASE_URL` |
|---|---|
| **Use the seeded demo account below** | the hosted demo project — `https://bewwvcksgpxoomyjavjp.supabase.co` |
| Develop against your own stack | `http://10.0.2.2:54321` (Android emulator) or your PC's LAN IP (physical phone) |

`SUPABASE_ANON_KEY` is the matching project's publishable anon key (never a service-role key — that
would be a backend secret).

---

## 👀 Trying it as a viewer

**Make your own biotope account.** Sign up in the app — it takes seconds, gives you a clean slate,
and you can log freely without affecting anyone else. This is the recommended path.

**Or use the pre-seeded account,** if you want to see the app already populated with history rather
than starting empty:

```
email     test@ourobion.com
password  test123
```

This same account signs in to **[nao.ourobion.com](https://nao.ourobion.com)**, where it is
**view-only** — you can read the corpus, claims and verdicts, but not trigger runs or spend budget.

> ⚠️ **In biotope this account is not read-only — it can write.** It is shared, so anything logged
> against it is visible to everyone else using it, and it is easy to spoil for the next person.
> **Please don't abuse it.** If you want to actually log data, make your own account instead.

The demo project holds **simulated, backdated data for one demo user**. It is not real personal
health data, and it is not a production environment.

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

Design + rationale: [`docs/nao/brain-synthesis-design.md`](docs/nao/brain-synthesis-design.md) ·
[`docs/nao/brain-ingestion-design.md`](docs/nao/brain-ingestion-design.md). Contract:
[`shared/brain/`](shared/brain/).

---

## 🚪 Where to go next

### 👤 Humans — start here

| You want… | Look in |
|---|---|
| **Launch either app / demo credentials** | [Launch it](#-launch-it) · [Trying it as a viewer](#-trying-it-as-a-viewer) |
| **Run the biotope app** (env, toolchain, Android) | [`apps/biotope/README.md`](apps/biotope/README.md) |
| **Run the nao web dashboard** (env, D1/ETL, deploy) | [`apps/nao/README.md`](apps/nao/README.md) |
| **Product design** — principles, goals, phases | [`docs/shared/project-context.md`](docs/shared/project-context.md) · [`docs/shared/phase-2-plan.md`](docs/shared/phase-2-plan.md) |
| **System architecture & data flows** | [`docs/biotope/architecture-context.md`](docs/biotope/architecture-context.md) |
| **Repository layout & structure rules** | [`docs/shared/structure-context.md`](docs/shared/structure-context.md) |
| **UI design** — tokens, components | [`docs/biotope/ui/ui-design-context.md`](docs/biotope/ui/ui-design-context.md) (app) · [`docs/nao/nao-app-design.md`](docs/nao/nao-app-design.md) (nao) |
| **The brain** — design + ingestion | [`docs/nao/brain-synthesis-design.md`](docs/nao/brain-synthesis-design.md) · [`docs/nao/brain-ingestion-design.md`](docs/nao/brain-ingestion-design.md) |
| **Insight-engine architecture** (authoritative, both apps) | [`docs/shared/insight-engine-architecture.md`](docs/shared/insight-engine-architecture.md) · ADRs [`docs/shared/decisions/`](docs/shared/decisions/) · seam [`docs/shared/biotope-nao-link.md`](docs/shared/biotope-nao-link.md) |
| **Insights engine (biotope serve) / metrics registry** | [`docs/biotope/rules-engine-design.md`](docs/biotope/rules-engine-design.md) · [`docs/biotope/metrics-registry-design.md`](docs/biotope/metrics-registry-design.md) |
| **Hackathon** (Launchpad 2026 strategy) | [`docs/shared/hackathon/`](docs/shared/hackathon/) — direction, narrative, judging self-review |
| **Shared contracts** (TypeScript ↔ Dart) | [`shared/SHARED-CONTEXT.md`](shared/SHARED-CONTEXT.md) |
| **Decisions & rationale** | [`docs/memory/`](docs/memory/) (indexed decisions) · [`docs/shared/decisions/`](docs/shared/decisions/) (architecture ADRs) · [`docs/sessions/`](docs/sessions/) (per-session logs) |
| **Dev workflow** (Issue → PR → merge) | [`docs/shared/dev-workflow.md`](docs/shared/dev-workflow.md) · [`docs/shared/commit-conventions.md`](docs/shared/commit-conventions.md) |

### 🤖 AI agents — start at [`AGENTS.md`](AGENTS.md)

`AGENTS.md` is the **single, tool-agnostic source of truth** for agentic tools: how to build here and
the principles to follow. `CLAUDE.md` / `GEMINI.md` are thin pointers to it, so guidance never drifts
between Claude, Codex, and Gemini. The AI routing table, truth hierarchy, and PR-review checklist live
in [`docs/shared/agent-protocol.md`](docs/shared/agent-protocol.md).

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
