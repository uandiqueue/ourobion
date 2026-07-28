---
title: Run 4 UI integration, three device-only defects, and the Home design alignment
summary: Advanced the landing-gate base, integrated the canonical UI, found and fixed three defects that only a physical device exposed, replaced the fake knowledge-base ticker with real counts, and aligned Home with the Claude Design export.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 UI integration, three device-only defects, and the Home design alignment

Issues: #195, #198, #200, #201
PRs: #197 (merged), #191, #202

Branches: `ci/run4-unit-base-advance` (merged), `feat/m1-ui/biomech-botanical-full`,
`feat/m1-ui/design-alignment`

## Attempted

- Reconciled the Run 4 landing gate so the queue could move at all.
- Integrated the canonical full UI onto that reconciled base.
- Ran a real traversal on a physical Samsung SM-A165F rather than trusting green CI.
- Replaced the Home knowledge-base ticker with real data.
- Aligned Home with the Claude Design export.

## Changed

- **PR #197 (merged)** — advanced `RUN4_UNIT_BASE_SHA` `c558c04` → `ff05464`, updated `ci.yml` in
  lockstep, re-recorded the attestation through the generator, renamed the release-evidence step
  off "U0".
- **PR #191** — merged the reconciled base in; fixed two device-only defects; fixed the asset
  bundling; added regression tests.
- **PR #202** — `get_knowledge_base_stats()` migration + real KB row; Home design alignment.

## Decided

- **The cap was never the problem; the stale base was.** PR #191's own diff is 6,334 added lines.
  It measured 13,449 only because the base predated the U2 merge. Nothing was split or trimmed to
  fit, and the caps stayed at 115 / 8,500.
- **Three defects shipped green.** `flutter analyze` was clean and all 176 widget tests passed while
  all three were live. Green CI is not evidence that a UI works.
- **Asset downscaling was reverted, not landed.** The 25 PNGs total ~31MB; downscaling measured
  31MB → 7.9MB with no visible difference at render size. But those blobs are already an ancestor of
  the integration branch, so rewriting them puts **binary rows** in the landing delta and
  `checkLandingDelta` fails closed on exactly that. That guard exists to stop unreviewed binary
  payloads and must not be weakened, so the downscale needs its own change plus a recorded human
  decision. Left as a skipped test group naming the reason.
- **Two deliberate divergences from the design.** Kept `/100 coverage` rather than the design's
  `/100 index` (the number is `log_completeness`; "index" would imply a composite health score the
  app does not compute), and omitted the design's status sentence ("Your biome held steady through
  the weekend") because no real derivation exists for it.

## The three device-only defects

1. **Home signals grid overflowed.** `childAspectRatio: 1.3` derived cell *height* from tile
   *width*, but a `MetricTile`'s content height is fixed — `BOTTOM OVERFLOWED BY 9.5 PIXELS` on all
   four tiles, worse the narrower the screen. Fixed with a pinned `mainAxisExtent` plus a `Flexible`
   visual.
2. **Profile tab could hang on a spinner permanently.** `_load()` had no try/catch; a failed read
   left `_loading` true, and because the tab is kept alive in the shell's `IndexedStack` it could not
   recover **for the whole session** even after the backend came back. Only force-stopping cleared
   it. Added a catch, a `_loadFailed` state with copy, and an explicit retry.
3. **No generated artwork shipped at all.** `pubspec.yaml` declared
   `assets/images/generated/biomech_botanical/`, but a Flutter asset directory entry is **not
   recursive** — it bundles only files directly inside, and that folder holds nothing but
   subdirectories. Zero of the 25 PNGs were packaged. Only `logo.png` shipped, because it sits
   directly in `assets/images/`. Every `Image.asset` fell through to its `errorBuilder`, and the
   hero's fallback is an **invisible** `SizedBox`, so the app looked deliberate while shipping none
   of its design. Fixed by listing each leaf directory, guarded by `asset_bundling_test.dart`.

## Verification actually run

macOS, `deno 2.8.1`, repository-local Supabase CLI `2.81.2`, disposable `postgres:17`.

| Gate | Result |
|---|---|
| `flutter analyze` | `No issues found!` |
| `flutter test` | **276 pass, 26 skipped** (176 at session start) |
| `supabase/tests/authz/run.mjs` | **443/443**, 0 fail |
| `supabase/tests/profile_prefs/run.mjs` | **34/34**, 0 fail |
| `run4_release_gate.mjs attest` (fresh graphs) | PASS |
| `node --test tools/run4_release_gate.test.mjs` | 9 pass |
| Landing gate injected negatives | 4/4 correctly rejected, incl. a real 9,102-line over-cap commit |
| `context_sync.mjs --check` | passed |
| Physical Android traversal | full walk, all five tabs, re-verified after each fix |

## Left

- **#200** — Archive: trend data alongside past insights. Not started.
- **#201** — Scan: scanning-motion restyle. Not started.
- **#191 and #202 are unmerged.** Both green; merging was blocked by the local permission
  classifier and needs a human `gh pr merge`.
- **Two-reviewer signoff** is still unrecorded on #191's `shared/types/index.ts` change.
- **Landing headroom is thin**: #202 measures 57 paths / 7,670 added lines against 115 / 8,500. The
  next unit will need the gate base advanced again once #191 lands.
- Asset weight (~31MB) and the 1.6x text-scale tile overflow, both recorded as skipped tests.
- `tools/rules` cannot run on a clean clone: `shared/rules/rule.schema.ts` imports `zod`, which is
  declared neither in `tools/rules/package.json` nor at the repo root.

## Blockers

- `gh pr merge` is refused by the local permission classifier; a human must merge.

memory: none
