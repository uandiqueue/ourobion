# Session 20260718T061213Z — agentjwork — claude — u28-nit-sweep

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U28) · **Branch:**
  `fix/sweep/copy-gates-engine-nits` (cut from the chain tip `ci/deno-check-migrations-apply`) ·
  **Issue:** #90 · **PR:** #91 (stacked)
- **Type:** audit-fix unit U28 — the **final nit sweep**: findings A8 (low), A9 (nit), A21 (low),
  A22 (nit), A23 (nit) from `docs/temp/phase2-audit/audit-findings-register.md`, plus the
  documentation-only A12 note (D15/B5). A4/A5 were fixed in U19, A7 in U20 — not redone here.
  This closes the U19–U28 audit-fix phase.

## Attempted
- A8: make forbidden-term matching word-boundary-aware in BOTH copy gates (TS + Dart, lockstep).
- A9: remove or implement the dead `getCopyRule` TODO stub.
- A21: make the EDGE_CARD "matching pattern" clause conditional on a gate-passing personal signal.
- A22: explicit 500 in all three edge handlers when the service-role env var is unset.
- A23: thread the snapshot's `window_days`, fail loudly in `relationPhrase`, document
  `windowedBaseline`'s conservative history counting.
- A12: one register note under B5 (doc-only per D15).

## Changed (committed)
- `shared/constants/copy_guidelines.ts` + `copy_guidelines.dart` — **A8**: `validateCopyString`
  matching goes from bare `includes`/`contains` to a word-boundary regex with an optional plural
  suffix: `\b<word>(?:e?s)?\b` (character-identical pattern in both languages). "stillness" /
  "conditioning" / "air-conditioned" / "mistreatment" now pass; standalone "illness" /
  "condition" / "treatment" — and plain plurals "conditions" / "illnesses" / "diseases" /
  "treatments", which bare word boundaries alone would have let through — still fail. Term lists
  unchanged. **A9**: the Dart-only `getCopyRule` TODO stub (returned `''`) is REMOVED — zero
  callers repo-wide (only comment/doc mentions).
- `apps/biotope/test/guards/copy_guidelines_parity_test.dart` — parity guard extended (+2): both
  sources must contain the identical matcher pattern text (TS `${word}` normalised to Dart
  `$word` form), and every forbidden term must be lowercase `\w`-only (else `\b` cannot anchor).
- `tools/rules/tests/copy_guidelines.test.ts` (NEW, +4) and
  `apps/biotope/test/m5b_insight_engine/copy_gate_word_boundary_test.dart` (NEW, +2) — the SAME
  true-negative / true-positive table vectors on both sides of the seam, kept in lockstep by
  comment cross-reference; the TS file also proves the render-time drop fires only on real words
  ("stillness" fill renders ok, "illness" fill drops with `copy-gate`).
- `supabase/functions/generate-insights/render.ts` — **A21**: `EDGE_CARD_TEMPLATE` split into a
  base variant WITHOUT "Your own recent data shows a matching pattern" and
  `EDGE_CARD_TEMPLATE_WITH_PERSONAL` carrying it; `edgeCardTemplate(hasGatePassingPersonal)`
  selects (Deno-free, node-tested). Titles identical, so the `edge:` upsert identity is
  unchanged. **A23(b)**: `relationPhrase` now throws on any non-monotonic relation instead of
  defaulting to "tends to raise" (§1.3 — unreachable by construction; a throw is a bug
  surfacing, not a runtime hazard).
- `supabase/functions/generate-insights/index.ts` — agree-branch edge card renders
  `edgeCardTemplate(classified.personal !== null)` (`classified.personal` is exactly the
  gate-passing row for the top edge's pair, or null). **A23(c)**: `baseline_snapshots` select +
  `BaselineRow` gain `window_days`; the trend/threshold render fill uses `snapshot.window_days`
  instead of the inline `7`. **A22** guard added.
- `supabase/functions/compute-baselines/index.ts`, `evaluate-signals/index.ts` — **A22**: all
  three handlers return 500 (`server misconfiguration: service-role key unavailable`, secret
  never echoed) when `SUPABASE_SERVICE_ROLE_KEY` is unset, BEFORE the Bearer compare — the
  expected header can no longer degenerate to the literal `Bearer undefined`. The now-provably
  non-null key drops its `!` assertions.
- `supabase/functions/generate-insights/evaluators.ts` — **A23(a)**: `windowedBaseline` doc
  comment gains the CONSERVATIVE-HISTORY caveat: history is counted over the supplied (~28-day)
  slice only, so vs S3's all-days-ever semantics a lagged leaf's confidence can only come out
  LOWER, never higher.
- `tools/rules/tests/engine_composer_render.test.ts` — +2: the A21 honesty split (base template
  omits the clause, WITH_PERSONAL carries it, selection function pinned both ways, shared title)
  and A23 `relationPhrase` throw vectors; the representative-values render test now covers both
  edge variants.
- `docs/temp/phase2-run-blocked-register.md` — **A12** note under B5: first real-verifier runs
  must also verify the `local_agent` mailbox/attestation seam (response `model` is
  fulfiller-self-reported; decorrelation is config-deep only until attested); cross-ref A12.
- `docs/temp/phase2-run-orchestration-log.md` — U28 row → done; ledger row (**shared/
  retro-review** flag); recovery section notes the **audit-fix phase is complete** (U19–U28).

## Decided / judgment calls
- **A8 matcher shape — `\b<word>(?:e?s)?\b`, not bare `\b<word>\b`:** strict word boundaries
  alone would have REGRESSED true positives — "conditions", "treatments", "diseases",
  "illnesses" all previously failed the substring gate and would suddenly pass. The optional
  plural suffix keeps them failing while still admitting every benign containing word the
  register names. Nonsense over-matches ("conditiones", "illnesss") are harmless.
  Register-named edge cases verified: "treatment-plan" still fails (hyphen is a boundary —
  standalone word usage); "preconditioning" passes.
- **Parity mechanism:** the guard is text-parsing (no cross-language execution), so behaviour
  lockstep is pinned three ways: identical pattern TEXT in both sources (guard), identical
  table vectors run against each implementation in its own language (new tests), and the
  existing list-equality checks.
- **A9 — removed, not implemented:** zero callers anywhere (`grep getCopyRule` → only the W0
  plan row, `m1-context.md`, and the `m1_core/index.dart` interface comment). Implementing a
  rule-lookup nobody calls would be speculative API. The two m1 doc mentions stay as statements
  of a future M1 interface — noted here rather than edited (outside this unit's blast radius).
- **A21 — two whole templates, not a `{{personal_clause}}` placeholder:** templates stay
  deterministic, whole-sentence, and individually copy-gateable; a fill-in clause would put
  copy inside the values map where it reads as data, not reviewable template text.
- **A23 window_days at line 560 (`stats.windowDays: 7` on coincidence patterns) left as-is:**
  the register pins only the RENDER fill (index.ts:480); the coincidence stats field mixes lag-0
  snapshot windows and `WINDOWED_BASELINE_CONFIG` lagged windows — threading it is a different
  (tiny) refactor, noted under Left.

## Gate results / local proof
- `tools/rules` — **64/64** (+6: 4 copy-gate table/render tests, A21 split, A23 throw);
  `tsc --noEmit` clean.
- `tools/engine-stats` — **36/36** (untouched-green).
- `shared` — `npx tsc --noEmit` clean.
- `flutter analyze` — no issues; `flutter test` — **66/66** (+4: 2 Dart word-boundary tables,
  2 parity-guard additions).
- `node tools/context_sync.mjs --check` — consistent.
- **Live (local stack):** `npx supabase db reset` clean (16 migrations); `functions serve` →
  all three handlers **200** with the service-role key (generate-insights ran the full pass:
  fetches including the new `window_days` column validated by PostgREST, 0 users on a fresh
  reset); `Authorization: Bearer undefined` → **401**.

## Left / follow-ups (not this unit)
- The A22 **500 branch cannot be exercised on the local stack** — the platform always injects
  `SUPABASE_SERVICE_ROLE_KEY` into the edge runtime (exactly why the register rates the finding
  theoretical). The guard is covered by reading + `deno check` in CI (U27); the 401-on-wrong-key
  path is live-proven above.
- `stats.windowDays: 7` on coincidence-pattern payloads (index.ts ~:560) — same-spirit inline
  literal, out of the register's pinned scope; candidate for a later tidy.
- `getCopyRule` mentions in `apps/biotope/lib/modules/m1_core/index.dart` (interface comment)
  and `m1-context.md` remain as future-interface promises with no implementation behind them.
- B8: this PR carries the **shared/ retro-review flag** (copy-gate semantics change in
  `shared/constants/`).

## Blockers
- None.

memory: none
