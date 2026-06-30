# Session 20260630T065703Z — agentjwork — claude — apps-monorepo-layout

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** refactor/apps-monorepo-layout (cut from dev-phase2) · **Issue:** #29
- **Type:** Path/reference refactor. Move the Flutter app from repo-root `src/` to `apps/biotope/` so both apps live under `apps/`, and repoint every live reference. No code logic changed — only directory location + path strings.

## Attempted
Owner asked to (1) `git mv src apps/biotope` (history-preserving), (2) seed `apps/nao/.env.example`
from the main checkout so `apps/` holds both apps, (3) find and update EVERY live reference to the
repo-root Flutter `src/` (CI, scripts, couplings guard paths, docs, memory), (4) `git mv` the env
example template along with the dir, and (5) verify Flutter still builds in the new location,
`context_sync --check` passes, and zero repo-root `src/` references remain.

## Changed
- **Move (history-preserving `git mv`):** repo-root `src/` → `apps/biotope/` (the whole Flutter
  package, incl. `lib/`, `test/`, `android/`, `ios/`, `assets/`, `pubspec.*`, and the tracked
  `.env.public.example` which renamed as part of the dir move). Gitignored `build/`, `.dart_tool/`,
  `.env.public`, `android/local.properties` were absent in this fresh worktree (regenerate on
  `flutter pub get`).
- **Seeded `apps/nao/.env.example`** (copied from the main checkout) so both apps live under `apps/`.
- **Reference updates (17 files):**
  - CI (build-critical): `.github/workflows/ci.yml` — all four `working-directory: src` → `apps/biotope`.
  - `.github/ISSUE_TEMPLATE/bug_report.yml` — `src/.env.public` → `apps/biotope/.env.public`.
  - Scripts: `scripts/setup.ps1`, `scripts/setup.sh`, `scripts/biotope-env.ps1` — env-file paths,
    `cd src` / `Push-Location ...\src` / pubspec checks all repointed to `apps/biotope`.
  - `docs/graph/couplings.yaml` — all 8 `guard: src/test/guards/...` → `apps/biotope/test/guards/...`
    and the `to: src/lib/modules/...normaliser.dart` → `apps/biotope/lib/...`. (context_sync resolves all.)
  - `docs/graph/README.md`, `AGENTS.md`, `README.md`, `docs/STRUCTURE-CONTEXT.md`,
    `docs/AGENT-PROTOCOL.md`, `docs/biotope/INSIGHTS-ENGINE-DESIGN.md`,
    `docs/biotope/METRICS-REGISTRY-DESIGN.md`, `docs/biotope/ui-context/UI-DESIGN-CONTEXT.md`,
    `shared/metrics/README.md`, `shared/metrics/registry.ts`,
    `docs/memory/0010-ios-build-needs-mac-and-paid-account.md` — all repo-root `src/...` path strings
    (incl. Windows `src\`, `cd src`, the "`shared/` vs `src/`" rule wording, the directory tree, and
    the Environment Files section) repointed to `apps/biotope/...`.

## Decided
- **Both apps live under `apps/`** (Issue #29): the Flutter app is `apps/biotope/`, the brain-ingestion
  app config is `apps/nao/`. This unifies the monorepo layout (previously the Flutter app sat at
  repo-root `src/`).
- **Hard exclusions left untouched (intentional):**
  - `tools/brain-ingest/**` — its `src/` is the TOOL'S OWN TypeScript source (`src/cli.ts`,
    `src/config.ts`, etc.), unrelated to the Flutter app. All `src/` refs in
    `docs/nao/BRAIN-INGESTION-DESIGN.md` describe that tool, so they stay.
  - `docs/commit-conventions.md` — the `chore` definition's "`src` or `test`" is the generic
    Conventional Commits wording, not a repo path.
  - `.claude/skills/graphify/references/extraction-spec.md` — `src/auth/session.py` etc. are generic
    illustrative examples, not the repo's `src/`.
  - Frozen historical records (`docs/sessions/**`, `docs/human-briefs/**`) and generated Flutter files
    (`.dart_tool/`, `build/`, `flutter_export_environment.sh`, `local.properties`, `.metadata`).

## Left
- Nothing outstanding. Commit + PR is the owner's follow-up (this session did NOT commit).
- The gitignored `apps/biotope/.env.public` was created locally during verification (to confirm a
  clean analyze) — it is gitignored and untracked, so it won't be committed.

## Blockers
- None. (`flutter pub get` emitted a Windows "symlink support / Developer Mode" warning — an
  environment limitation unrelated to the move; deps still resolved and `flutter analyze` is clean.)

## Verify
- **Flutter (from `C:\project\ourobion-wt-apps\apps\biotope`, toolchain activated from main checkout):**
  `flutter pub get` resolved; `flutter analyze` → **No issues found!** (The lone earlier warning was
  `asset_does_not_exist` for the gitignored `.env.public` on a fresh checkout — not a move regression;
  clean once the local `.env.public` is created from the template, exactly as `setup` does.)
- **context_sync:** `node tools/context_sync.mjs --check` from inside the worktree → **passed**
  (sessions, memory, and couplings consistent; all guard paths now resolve under `apps/biotope/`).
- **Residual scan:** zero repo-root Flutter `src/` references remain (excluding `tools/brain-ingest/`,
  `docs/sessions/`, `docs/human-briefs/`, `apps/biotope/` itself, and the generic-wording exclusions).
