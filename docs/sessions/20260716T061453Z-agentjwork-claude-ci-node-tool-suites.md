# Session 20260716T061453Z — agentjwork — claude — ci-node-tool-suites

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U18) · **Branch:**
  `ci/node-tool-suites` (cut from `feat/shared/l6-one-card-slice`) · **Issue:** run chain
  (orchestrator opens PR)
- **Type:** CI wiring — close the standing orchestrator gap ("CI still does not run node
  tool-package tests"): add a `node-tools` matrix job to `.github/workflows/ci.yml` so all six
  tools/* node suites (brain-ingest, llm-router, rules, edge-loader, engine-stats, metric-view)
  plus the DB-free drift guards run as a non-bypassable backstop on every push/PR to
  `main`/`dev-phase2`.

## Attempted
- Surveyed the six tools/* packages (all exist, all have `package-lock.json`, all expose
  `typecheck` + `test` scripts), the root aliases (`rules:test`, `view:test`, `stats:test`,
  `edges:*`, `view:check`, `rules:check`), and the node-setup pattern in `brain-ingest.yml`.
- Audited every `tests/**/*.test.ts` for offline safety (grep for pg.Client / S3Client / fetch /
  http / Docker / env dependence): **zero matches** — no suite touches DB, R2, network, or secrets.
  The only env-var references are llm-router assertions that a *missing* key raises
  `RouterKeyMissingError` (offline-correct by construction).
- Ran every command the new job executes, exactly as written, locally (node v26.3.0, npm 11.16.0).
- Full gate sweep (flutter, context_sync).

## Changed (committed)
- `.github/workflows/ci.yml` — new fourth job `node-tools`:
  - **Matrix design:** one job, `strategy.matrix.package` over the six package dirs with
    `fail-fast: false` (each package reports independently, mirroring six status checks without
    six copy-pasted jobs). `matrix.include` adds `drift_check: true` to `tools/rules` and
    `tools/metric-view` only, gating an extra `npm run check` step.
  - **Steps per package:** checkout → setup-node `'26'` (brain-ingest + llm-router declare
    `engines.node >=26`; the rest accept >=20; matches `brain-ingest.yml`) with npm cache keyed on
    both `<package>/package-lock.json` and `shared/package-lock.json` → `npm ci` in `shared/`
    (the suites import `shared/*.ts` contracts via tsx, which resolve zod & co. from
    `shared/node_modules`) → `npm ci`, `npm run typecheck`, `npm test` in the package →
    conditional `npm run check`.
  - Header comment updated (three jobs → four).

## Local verification matrix (every CI command run locally, exit codes checked)

| package | npm ci | typecheck | test |
| --- | --- | --- | --- |
| tools/brain-ingest | PASS | PASS | PASS (320/320) |
| tools/llm-router | PASS | PASS | PASS (42/42) |
| tools/rules | PASS | PASS | PASS (50/50) |
| tools/edge-loader | PASS | PASS | PASS (21/21) |
| tools/engine-stats | PASS | PASS | PASS (30/30) |
| tools/metric-view | PASS | PASS | PASS (5/5) |

- `shared` `npm ci`: PASS. Drift checks as CI runs them (package-level `npm run check`):
  `tools/rules` PASS (`--check` ≡ `--dry-run`: validate + print, no DB) · `tools/metric-view`
  PASS (renders view SQL from the registry, diffs the committed migration, no DB). Root aliases
  `npm run view:check` / `npm run rules:check` also PASS (same commands).
- Workflow YAML parse: `npx js-yaml .github/workflows/ci.yml` → exit 0.

## Decided
- **Excluded from CI — `edges:check`** (`load_edges.mjs --check`): even in dry-run it requires an
  artifact *source* (`--from-dir` mirror of the R2 `edges/` prefix, or `--from-r2` + R2 secrets);
  the artifact dir (`data/corpus/edges/`) is gitignored, so CI has nothing to point it at. Its
  validation logic is covered by the edge-loader suite (21 tests) instead. Recorded honestly, not
  skipped silently.
- **No test skips/marks needed:** the suites were built offline-first and the audit confirmed it —
  nothing needs Docker, a live DB, R2, or API keys, so the whole matrix runs unconditionally.
- Node `'26'` for the whole matrix rather than a per-package version axis — a single version that
  satisfies every `engines` range keeps the matrix one-dimensional; brain-ingest.yml already
  standardises on 26.
- Seeder/synth/verifier tests are part of the brain-ingest suite (`tests/**/*.test.ts` glob), so
  they are covered by the matrix without separate wiring.

## Left
- The 14-PR review queue can now merge under full protection once branch-protection required
  checks are updated to include the six `Node tools — tools/*` check names (repo-settings change,
  orchestrator/owner action — not a workflow-file concern).
- `edges:check` in CI would become possible if a committed fixture mirror of the edges/ prefix
  ever exists; not warranted now.

## Blockers
- None. Gate: every new CI command PASS locally (table above) · `flutter analyze` clean ·
  `flutter test` **48/48** · `node tools/context_sync.mjs --fix-index` + `--check` pass ·
  flutter generated-plugin churn reverted · YAML parses.

memory: none
