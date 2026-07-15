# Session 20260610T093356Z — uandiqueue — claude — graphify-dart-probe

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-fable-5[1m]) · **Branch:** docs/graphify-dart-finding (from dev-phase2)
- **Type:** Docs/memory — record an empirical tooling probe result; no app/backend code.

## Attempted
Answer "will graphify handle our Dart half?" empirically **before** installing (step A of
`docs/NEXT-PHASE-PLAN.md` is design-only). Probed graphifyy 0.1.14 in a disposable venv inside the
project-bounded toolchain (`..\biotope-toolchain`, since deleted) against copies of
`auth_service.dart`, `baseline_service.dart`, and `compute-baselines/index.ts` as a TS control, using
the AST-only path (`graphify update --no-cluster`, local, no LLM). No `graphify <platform> install`
was ever run — no skill registration, no hooks, no CLAUDE.md edits.

## Changed
- **`docs/memory/0008-graphify-context-tool.md`** — added a "Dart coverage — verified empirically"
  paragraph: Dart **structure** extracts fine (classes, fields, methods incl. private, imports;
  `baseline_service.dart` → 23 nodes) despite `tree-sitter-dart` not being a declared dependency, but
  **no `calls` edges for Dart** (TS got them) and **no raw cross-language Dart↔TS linking** (shared
  refs like `SupabaseClient` stay duplicate nodes; merging presumably needs the semantic-LLM pass,
  untested — needs an API key).

## Decided
- Dart coverage is **adequate for the context-substrate role** memory 0008 assigns graphify, and the
  probe **confirms** graphify does NOT substitute for the deferred structural import-graph on the
  Dart side (consistent with 0008's "complementary, not replacement" framing).
- The "design-only, do not install yet" decision stands unchanged; probe artifacts were fully removed.

## Left
- When graphify is actually installed (post-Phase 0), re-test the semantic-LLM pass for Dart↔TS
  concept merging, and re-check whether a newer graphifyy adds `tree-sitter-dart` (call edges).

## Blockers
- None.
