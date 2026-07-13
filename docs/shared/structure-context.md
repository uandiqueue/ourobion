# structure-context.md — Ourobion Repository Structure
> **CONSTANT LAYER** — Update only when the repository structure changes.

---

## Directory Layout

This is a monolithic repository containing the frontend mobile application, backend serverless functions, and shared libraries.

```
ourobion/
├── AGENTS.md                  # SINGLE SOURCE OF TRUTH for agents + humans (points to everything)
├── CLAUDE.md / GEMINI.md      # Thin pointers to AGENTS.md
├── assets/                    # Brand assets (design reference, NOT app-bundled)
│   └── ourobion-brand/        # Logos (PNG/SVG, light/dark), favicon, colors, brand DESIGN.md
├── .githooks/
│   └── pre-push               # Runs `node tools/context_sync.mjs --check` (core.hooksPath=.githooks)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml             # context check + Flutter analyze/test + TypeScript type check
│   │   └── pr-review.yml      # AI prelim PR reviewer (planned)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── tools/                     # Node-stdlib enforcement + multi-agent helpers (no Python)
│   ├── brain-ingest/          # TS paper-corpus ingestion pipeline (see docs/nao/brain-ingestion-design.md)
│   ├── context_sync.mjs       # --session-start briefing / --check enforcement
│   ├── setup_agent_worktree.mjs # create an isolated git worktree + configure hooks
│   └── shared_memory.mjs      # task-claim coordinator (.agents/session-log.json, gitignored)
├── docs/                      # General project documentation
│   ├── shared/                # Cross-app ground truth + process docs
│   │   ├── insight-engine-architecture.md # AUTHORITATIVE end-to-end insight-engine (serve + authoring)
│   │   ├── biotope-nao-link.md        # How biotope & nao connect at runtime (the seam)
│   │   ├── project-context.md         # Key project principles, goals, and phases
│   │   ├── structure-context.md       # This document
│   │   ├── phase-2-plan.md             # Current phase plan: goals, workstreams, sequence, gate
│   │   ├── agent-protocol.md          # AI agent routing table, non-negotiables, PR review checklist
│   │   ├── dev-workflow.md            # Full dev cycle — what AI does vs what humans must do
│   │   ├── commit-conventions.md      # Conventional Commits spec
│   │   ├── decisions/                 # Granular architecture ADRs (citation extraction, anomaly, reliability)
│   │   └── hackathon/                 # Launchpad 2026 strategy (rules, direction, narrative, judging)
│   ├── nao/                   # The brain feature (knowledge graph of metric relationships)
│   │   ├── nao-app-design.md              # nao web app: brain inspection/curation surface
│   │   ├── brain-synthesis-design.md            # Brain design: evidence-tiered edges, second-LLM verification
│   │   ├── brain-ingestion-design.md  # Paper-corpus ingestion → synthesis → verification pipeline
│   │   └── brain-support-models-design.md   # Support-model training design (deferred)
│   ├── biotope/               # The app feature (architecture, insights engine, metrics, UI)
│   │   ├── architecture-context.md    # System architecture and data flow rules
│   │   ├── rules-engine-design.md  # biotope-scoped serve engine (defers to shared/insight-engine-architecture.md)
│   │   ├── metrics-catalog.md         # Candidate-metrics catalog
│   │   ├── metrics-registry-design.md # Single-source metric registry (safe metric add/remove)
│   │   └── ui/                # UI design system (ui-design-context.md + mockups)
│   ├── temp/                  # Temporary research output — NOT ground truth
│   │   └── human-brief/               # Plain-language + research briefs; fable_research/ = archived design pack
│   ├── sessions/              # Append-only one-file-per-session logs (variable layer)
│   ├── memory/                # Durable one-fact-per-file memory + README index
│   └── graph/                 # couplings.yaml (semantic couplings + guard tests) + README (graphify + deferred structural graph)
├── scripts/                   # Local setup and utility scripts
│   ├── setup.sh               # Linux/macOS (+ Git Bash/WSL) env check + dep install
│   ├── setup.ps1              # Windows-native bounded toolchain installer (Miniconda + Flutter + Android SDK)
│   ├── biotope-env.ps1        # Windows: per-shell activation of the bounded toolchain
│   ├── graphify-build.ps1     # Rebuild the graphify semantic context graph (AST-only, local)
│   └── seed-test-data.ps1     # Inject backdated rows + rebuild projections for local testing
├── shared/                    # Code shared across frontend and backend boundaries
│   ├── SHARED-CONTEXT.md      # Shared types and integration contracts
│   ├── types/                 # Shared data models (TypeScript + Dart)
│   └── constants/             # Shared constants (e.g., non-diagnostic copy rules)
├── apps/                      # Application packages (both apps live here)
│   ├── biotope/               # Frontend application (Flutter codebase)
│   │   ├── assets/            # Bundled app assets (declared in apps/biotope/pubspec.yaml)
│   │   │   ├── fonts/         # Manrope font family (Regular → ExtraBold)
│   │   │   └── images/        # App images (e.g. logo.png)
│   │   └── lib/
│   │       └── modules/       # Modularized application code (M1-M7)
│   │           ├── m1_core/       # Auth, Profile, Compliance (Contains m1-context.md)
│   │           ├── m2_self_report/# Daily logging UI and normalizers (Contains m2-context.md)
│   │           └── ...            # Other M* modules
│   └── nao/                   # Brain-inspection web app (Next.js/Cloudflare; see docs/nao/nao-app-design.md)
├── supabase/                  # Backend infrastructure
│   ├── functions/             # TypeScript Edge Functions
│   │   ├── compute-baselines/ # M5a backend worker
│   │   └── generate-insights/ # M5b backend worker
│   └── migrations/            # Postgres schema definitions
├── tests/                     # Integration and end-to-end tests outside the app boundary
└── graphify-out/              # graphify's semantic context graph (gitignored, rebuildable projection)
```

> `graphify-out/` and the `..\biotope-toolchain\graphify-venv` that produces it are machine-local and
> uncommitted — rebuild with `scripts/graphify-build.ps1`. See [`graph/README.md`](../graph/README.md).

## Environment Files

**One convention across every package:** a committed `*.example` template that you copy to a gitignored
real file. Two tiers:

- **Secrets — `.env`** (template `.env.example`): backend/server-only values; never bundled or exposed.
- **Public client config — `.env.public`** (template `.env.public.example`): client-visible values only
  (e.g. a Supabase URL + anon/publishable key).

Per package:

- `apps/biotope/.env.public` (template `.env.public.example`) — Flutter client config, bundled by Flutter;
  client-visible values only (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- `apps/nao/.env.public` (template `.env.public.example`) — nao (Next.js) client config
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; Next.js requires the `NEXT_PUBLIC_` prefix
  to expose a var to the browser). `apps/nao/.env` (template `.env.example`) — nao server secrets.
- `supabase/.env` (template `.env.example`) — backend/Supabase config; never bundled.
- `tools/brain-ingest/.env` (template `.env.example`) — the ingestion tool's backend secrets.

> **nao on Cloudflare Workers:** R2 + D1 are wired as `wrangler.jsonc` **bindings**, not env. Wrangler's
> local-runtime secrets file `.dev.vars` is **generated from `.env`** by a predev step and is gitignored —
> you only ever edit `.env` / `.env.public`, the same as every other package.

## Dev toolchain is OUTSIDE the repo (Windows-native setup)

On Windows, `scripts/setup.ps1` installs the **entire build toolchain bounded to the project** in a
**sibling folder of the repo** — `..\biotope-toolchain\` (Miniconda env `biotope` = Node + JDK 17,
the Flutter SDK, and the Android SDK + emulator + an AVD). It is **build tooling, not a repo
dependency**: machine-local, not committed, not deployed, and disposable (delete + re-run `setup.ps1`).
`scripts/biotope-env.ps1` activates it per shell (no global PATH changes). The dependencies that
actually ship are declared *in* the repo (`apps/biotope/pubspec.yaml`, `shared/package.json`,
`supabase/migrations`, `supabase/functions`) and are compiled into the app artifact or deployed to
Supabase — see README "Where dependencies live". CI installs its own toolchain from scratch.

## Folder Conventions

- **`shared/` vs `apps/biotope/`:** Any logic, types, or constants that must be duplicated across Dart (app) and TypeScript (backend) belong in `shared/`. The frontend codebase should not reference backend specific scripts, and vice versa.
- **Context files:** Constant, architectural constraints are capitalized and suffixed with `-CONTEXT` (e.g. `project-context.md`). Variable context documents (such as module to-do lists/state files) are lowercase and suffixed with `-context` (e.g. `m1-context.md`).
- **Assets:** two distinct locations. `apps/biotope/assets/` holds the app's **bundled** assets — `fonts/` (the Manrope family) and `images/` (e.g. `logo.png`); every file must be declared in `apps/biotope/pubspec.yaml` (`flutter: assets:` / `fonts:`) to be bundled and available at runtime (adding the file alone is not enough). The repo-root `assets/ourobion-brand/` is the **brand kit** (source logos, favicon, colors, brand `DESIGN.md`) — a design reference, **not** shipped in the app; app-facing images are derived from it into `apps/biotope/assets/`.
