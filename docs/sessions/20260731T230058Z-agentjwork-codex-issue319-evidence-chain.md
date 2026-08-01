---
title: Biotope paper evidence-chain rendering
summary: Grouped each research citation with its paper link, exact evidence quote, and optional paper-stated mechanism in the card provenance detail.
type: session
scope: m5b
status: canonical
updated: 2026-07-31
---

# Biotope paper evidence-chain rendering

Issue: #319 ? branch: `feat/m5b/evidence-chain-rendering` ? base:
`dev-phase2-run4` @ `ad1750b8bbf4dc6e24e89a41900bbf3fcd80e518`.

## Attempted

- Implement the evidence-chain rendering routed by #308 after the post-revamp #300 contract landed.
- Keep the change inside Biotope and consume the existing `quoteSpans[].locator` convention without
  changing `shared/brain/**`, synthesis, Nao #275, migrations, or projections.
- Preserve paper text exactly and make missing or malformed nested provenance visibly honest.

## Changed

- Added Dart parity for #300's `mechanism:<section>` locator convention and canonical DOI matching.
- Made nested quote-span/citation parsing tolerant: malformed entries are omitted while valid text is
  retained byte-for-byte, including surrounding whitespace.
- Reworked each cited edge into paper-grouped evidence chains: title/year, safe DOI action, exact
  evidence quote, model-declared section, and a separately labelled paper-stated mechanism.
- Kept unmatched legacy quote spans visible under the existing source-quotes section.
- Added explicit unavailable states when a paper lacks a valid evidence or mechanism span.
- Added focused model/widget regressions for exact offsets, malformed payloads, DOI normalization,
  full evidence-chain rendering, missing mechanisms, and a 390x844 viewport.

## Decided

- The evidence chain remains on the existing provenance detail opened from each card; no second
  backend fetch or duplicated inline card surface was added.
- Mechanism spans are optional because #300 deliberately refuses to pressure synthesis into inventing
  a pathway. Absence is rendered plainly instead of filling it with a summary.
- Evidence and mechanism quotes are never summarized, paraphrased, or trimmed in the app.
- Equivalent bare, `doi:`, and canonical DOI identifiers may join one chain; internal corpus IDs
  still match only exactly and remain unlinkable.
- The semantic graph view was not regenerated because Session C owns `docs/**` outside this log.

## Verification

- Focused #319 suite: 5/5 passed.
- Complete M5b directory: 122/122 passed.
- Explicit non-diagnostic copy + exact-offset quote gates: 8/8 passed.
- `flutter analyze --no-pub`: no issues.
- Full serial `flutter test --no-pub --concurrency=1`: 744 passed, 26 skipped, 0 failed.
- `git diff --check`: passed.
- Committed-head Run 4 product union: 566 paths / 83,528 added lines; recorded, non-gating, and
  over the unchanged 115-path / 8,500-line cap with acceptance still false.

## Left

- Push, exact-head CI, self-merge into `dev-phase2-run4`, and issue closure evidence.
- PR #318 / issue #317 remains separately blocked: Deno 2.8.1 moved two unexpected function graphs in
  addition to `compute-baselines`, so its manifest was not written.

## Blockers

- None for #319.
- The normal patch helper could not launch because `codex-windows-sandbox-setup.exe` is absent;
  reviewed zero-context unified patches were applied with `git apply` inside the isolated worktree.

memory: none
