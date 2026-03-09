# STRUCTURE-CONTEXT.md — Biotope Repository Structure
> **CONSTANT LAYER** — Update only when the repository structure changes.
> Last updated: Initial scaffolding

---

## Directory Layout

This is a monolithic repository containing the frontend mobile application, backend serverless functions, and shared libraries.

```
biotope/
├── .github/                   # GitHub Actions CI/CD workflows
├── docs/                      # General project documentation
│   └── STRUCTURE-CONTEXT.md   # This document
├── scripts/                   # Utility scripts for database seeding, build tools, etc.
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
├── .env.example               # Template for required environment variables
├── ARCHITECTURE-CONTEXT.md    # System architecture and data flow rules
└── PROJECT-CONTEXT.md         # Key project principles, goals, and phases
```

## Folder Conventions

- **`shared/` vs `src/`:** Any logic, types, or constants that must be duplicated across Dart (app) and TypeScript (backend) belong in `shared/`. The frontend codebase should not reference backend specific scripts, and vice versa.
- **Context files:** Constant, architectural constraints are capitalized and suffixed with `-CONTEXT` (e.g. `PROJECT-CONTEXT.md`). Variable context documents (such as module to-do lists/state files) are lowercase and suffixed with `-context` (e.g. `m1-context.md`).
