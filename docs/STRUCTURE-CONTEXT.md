# STRUCTURE-CONTEXT.md — Ourobion Repository Structure
> **CONSTANT LAYER** — Update only when the repository structure changes.

---

## Directory Layout

This is a monolithic repository containing the frontend mobile application, backend serverless functions, and shared libraries.

```
ourobion/
├── AGENTS.md                  # SINGLE SOURCE OF TRUTH for agents + humans (points to everything)
├── CLAUDE.md / GEMINI.md      # Thin pointers to AGENTS.md
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
│   ├── context_sync.mjs       # --session-start briefing / --check enforcement
│   ├── setup_agent_worktree.mjs # create an isolated git worktree + configure hooks
│   └── shared_memory.mjs      # task-claim coordinator (.agents/session-log.json, gitignored)
├── docs/                      # General project documentation
│   ├── AGENT-PROTOCOL.md      # AI agent routing table, non-negotiables, PR review checklist (constant)
│   ├── ARCHITECTURE-CONTEXT.md# System architecture and data flow rules
│   ├── dev-workflow.md        # Full dev cycle — what AI does vs what humans must do
│   ├── PROJECT-CONTEXT.md     # Key project principles, goals, and phases
│   ├── STRUCTURE-CONTEXT.md   # This document
│   ├── PHASE2-PLAN.md         # Current phase plan: goals, workstreams, sequence, gate
│   ├── INSIGHTS-ENGINE-DESIGN.md # Data-driven insights-engine contract (Phase 2 Track B)
│   ├── METRICS-REGISTRY-DESIGN.md # Single-source metric registry (safe metric add/remove)
│   ├── ui-context/            # UI design system (UI-DESIGN-CONTEXT.md + mockups)
│   ├── human-briefs/          # Plain-language stakeholder briefs (dated snapshots)
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
├── src/                       # Frontend application (Flutter codebase)
│   └── lib/
│       └── modules/           # Modularized application code (M1-M7)
│           ├── m1_core/       # Auth, Profile, Compliance (Contains m1-context.md)
│           ├── m2_self_report/# Daily logging UI and normalizers (Contains m2-context.md)
│           └── ...            # Other M* modules
├── supabase/                  # Backend infrastructure
│   ├── functions/             # TypeScript Edge Functions
│   │   ├── compute-baselines/ # M5a backend worker
│   │   └── generate-insights/ # M5b backend worker
│   └── migrations/            # Postgres schema definitions
├── tests/                     # Integration and end-to-end tests outside the app boundary
└── graphify-out/              # graphify's semantic context graph (gitignored, rebuildable projection)
```

> `graphify-out/` and the `..\biotope-toolchain\graphify-venv` that produces it are machine-local and
> uncommitted — rebuild with `scripts/graphify-build.ps1`. See [`graph/README.md`](graph/README.md).

## Environment Files

- `src/.env.public` is local frontend config and is intentionally bundled by Flutter.
  It may contain client-visible values only, such as `SUPABASE_URL` and
  `SUPABASE_ANON_KEY`.
- `src/.env.public.example` is the committed template for frontend config.
- `supabase/.env` is local backend/Supabase config and may contain backend-only values.
  It is never bundled into the Flutter app.
- `supabase/.env.example` is the committed template for Supabase/backend config.

## Dev toolchain is OUTSIDE the repo (Windows-native setup)

On Windows, `scripts/setup.ps1` installs the **entire build toolchain bounded to the project** in a
**sibling folder of the repo** — `..\biotope-toolchain\` (Miniconda env `biotope` = Node + JDK 17,
the Flutter SDK, and the Android SDK + emulator + an AVD). It is **build tooling, not a repo
dependency**: machine-local, not committed, not deployed, and disposable (delete + re-run `setup.ps1`).
`scripts/biotope-env.ps1` activates it per shell (no global PATH changes). The dependencies that
actually ship are declared *in* the repo (`src/pubspec.yaml`, `shared/package.json`,
`supabase/migrations`, `supabase/functions`) and are compiled into the app artifact or deployed to
Supabase — see README "Where dependencies live". CI installs its own toolchain from scratch.

## Folder Conventions

- **`shared/` vs `src/`:** Any logic, types, or constants that must be duplicated across Dart (app) and TypeScript (backend) belong in `shared/`. The frontend codebase should not reference backend specific scripts, and vice versa.
- **Context files:** Constant, architectural constraints are capitalized and suffixed with `-CONTEXT` (e.g. `PROJECT-CONTEXT.md`). Variable context documents (such as module to-do lists/state files) are lowercase and suffixed with `-context` (e.g. `m1-context.md`).
