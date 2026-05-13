# STRUCTURE-CONTEXT.md — Biotope Repository Structure
> **CONSTANT LAYER** — Update only when the repository structure changes.
> Last updated: 2026-05-13

---

## Directory Layout

This is a monolithic repository containing the frontend mobile application, backend serverless functions, and shared libraries.

```
biotope/
├── .github/                   # GitHub Actions CI/CD workflows
├── docs/                      # General project documentation
│   ├── ARCHITECTURE-CONTEXT.md# System architecture and data flow rules
│   ├── PROJECT-CONTEXT.md     # Key project principles, goals, and phases
│   ├── STRUCTURE-CONTEXT.md   # This document
│   └── workspace-context.md   # Variable layer tracker for team sessions
├── scripts/                   # Local setup and utility scripts
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
└── tests/                     # Integration and end-to-end tests outside the app boundary
```

## Environment Files

- `src/.env.public` is local frontend config and is intentionally bundled by Flutter.
  It may contain client-visible values only, such as `SUPABASE_URL` and
  `SUPABASE_ANON_KEY`.
- `src/.env.public.example` is the committed template for frontend config.
- `supabase/.env` is local backend/Supabase config and may contain backend-only values.
  It is never bundled into the Flutter app.
- `supabase/.env.example` is the committed template for Supabase/backend config.

## Folder Conventions

- **`shared/` vs `src/`:** Any logic, types, or constants that must be duplicated across Dart (app) and TypeScript (backend) belong in `shared/`. The frontend codebase should not reference backend specific scripts, and vice versa.
- **Context files:** Constant, architectural constraints are capitalized and suffixed with `-CONTEXT` (e.g. `PROJECT-CONTEXT.md`). Variable context documents (such as module to-do lists/state files) are lowercase and suffixed with `-context` (e.g. `m1-context.md`).
