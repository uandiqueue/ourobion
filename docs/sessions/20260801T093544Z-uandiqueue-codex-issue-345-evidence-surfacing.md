# Issue 345 evidence caveat and card source chain

memory: none

## Attempted

- Read issues #345, #300, #342, and the live #344 coordination thread, then claimed issue #345 and created an isolated worktree from `origin/dev-phase2-run4`.
- Traced verifier caveat text through the database projection, insight composition, provenance RPC, Dart model, and Flutter presentation before changing the chain.
- Evaluated the requested Nao synthesis and phrasing work. The phrasing route was reported blocked because Nao has no callable budgeted router seam; the orchestrator then cancelled B3. A briefly attempted synthesis-link change was fully reverted before commit.

## Changed

- Appended the exact verification caveat to `verified_edges`, preserved it in composed `edge_refs`, and returned it from `get_insight_provenance`, including a verification-row fallback for cards composed before this migration.
- Added nullable, backwards-compatible caveat parsing to the Biotope provenance model and rendered non-empty text in a visually separate `EVIDENCE QUALIFICATION` panel.
- Replaced the deck card's internal edge-id/date disclosure with an async provenance-backed paper evidence chain: paper title and year, the paper's full verbatim evidence sentence, an external DOI source action when resolvable, and the paper-stated mechanism only when present.
- Added focused Deno and Flutter regressions for verbatim caveat preservation, pre-caveat compatibility, source selection, unavailable states, optional mechanism absence, non-disclosure of internal edge ids, and narrow-screen layout.

## Decided

- Caveats are evidence qualifications, not warnings and not card-body prose; the UI uses no warning icon and does not paraphrase verifier text.
- Composition-time caveat text remains pinned in `edge_refs`; the provenance RPC falls back to the matching verification only for older cards that lack the new field.
- The on-card evidence chain reads the existing provenance RPC rather than duplicating quote data into another contract or making any per-render model call.
- Citation, evidence quote, and optional mechanism are matched by canonical paper id. Missing or malformed provenance yields an honest unavailable state rather than leaking an internal edge id or guessing a source.

## Left

- Replace the temporary long-form caveat fixture with the first real Agnes caveat from issue #344 and rerun the narrow-layout regression when Session A posts it; the production surface already renders arbitrary non-empty caveat text dynamically.
- Apply the migration through CI shadow-apply; no local Docker validation was attempted by instruction.
- B3 remains cancelled by the orchestrator. Deterministic card phrasing remains the documented fallback until an authorized router-backed presentation seam is designed.

## Blockers

- Issue #344 had not posted a real Agnes caveat string at close-out, so exact real-string fixture validation remains pending on Session A's result.
- No blocker remains for merging the backwards-compatible B1 and B2 implementation.

## Verification

- `deno check` passed for `generate-insights/index.ts` and its new composer regression.
- Focused Deno caveat tests passed 2/2; existing rules composer, trust, orientation, and copy regressions passed.
- Focused Flutter provenance tests passed 19/19; the deck/provenance/copy/archive regression set passed 18/18, including a 390-pixel-wide layout.
- `flutter analyze --no-pub` passed with no issues; the complete Flutter suite passed 761 tests with 26 documented skips; `git diff --check` passed.
- No Docker, hosted migration, database mutation, or provider call was used.
