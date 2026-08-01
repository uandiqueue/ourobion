---
title: Citation canonical semantics
summary: Tightened DOI resolution to canonical safe identifiers and made paper links explicit external accessibility links.
type: session
scope: m5b
status: canonical
updated: 2026-07-31
---

# Citation canonical semantics

Issue: #286 · branch: `fix/m5b/citation-canonical-semantics-286` · base: `dev-phase2-run4` @ `b1358df`

## Attempted

- Reconcile the citation resolver and paper-link control with #268's strict canonical DOI and accessibility requirements.
- Preserve the existing external-application launcher and its honest launch-failure state.

## Changed

- Accept only a bare DOI, case-insensitive `doi:` wrapper, exact `https://doi.org/` wrapper, or exact legacy `https://dx.doi.org/` wrapper.
- Reject empty/control-character, HTTP, host lookalike, port, user-info, query, fragment, whitespace-containing, malformed, and dot-segment identifiers before URI construction.
- Emit the sole canonical form `https://doi.org/<lowercase-doi>` without fabricating a link for corpus IDs.
- Give the rendered paper control one isolated semantic node: external wording, `isLink`, canonical destination value, an external icon, and a 48dp minimum target.
- Added model and rendered-semantics regressions while leaving the active #289 citation test files untouched.

## Decided

- A DOI is case-insensitive, so lowercasing makes Biotope agree with ingest normalization and prevents multiple stored spellings from yielding different URLs.
- The semantic wrapper excludes the child button's semantics to avoid duplicate/conflicting nodes, while both the semantic action and visual button call the same existing launcher.

## Left

- After #289 lands, its `citation_link_test.dart` and `provenance_citation_link_widget_test.dart` should tighten their current permissive assertions: reject HTTP rather than upgrading it; require lowercase canonical output; reject `.`/`..` segments; assert `SemanticsData.flagsCollection.isLink`, external wording, canonical value, and a 48dp target.
- Publish/PR/device/cloud work is intentionally left to the orchestrator.

## Blockers

- None. The fresh worktree required a local ignored `.env.public` placeholder for Flutter's asset bundle; it is ignored and not part of the diff or commit.

memory: none
