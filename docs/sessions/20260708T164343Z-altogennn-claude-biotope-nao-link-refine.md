# Session 20260708T164343Z — altogennn — claude — biotope-nao-link-refine

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** altogennn · **Agent:** Claude Code (claude-sonnet-5) · **Branch:**
  `docs/biotope-nao-link-plan` (cut from `dev-phase2`) · **Issue:** —
- **Type:** Docs/design. Continuation of the prior `biotope-nao-link-plan` session: localise
  `BIOTOPE-NAO-LINK.md` so it stands alone, then work through owner Q&A that surfaced real gaps in the
  presentation agent's edge-selection logic, the trust-score formula, and AI-disagreement handling.

## Attempted
1. Localised `docs/BIOTOPE-NAO-LINK.md` — removed every cross-reference to `PHASE2-PLAN.md`,
   `NAO-DESIGN.md`, `INSIGHTS-ENGINE-DESIGN.md`, and `BRAIN-DESIGN.md`/`BRAIN-INGESTION-DESIGN.md`,
   folding enough of their content inline that no other design doc needs to be open to follow it.
   Memory-file citations (`0003`, `0006`, `0012`) were kept, per the owner's explicit scope choice.
2. Worked through an extended Q&A with the owner tracing exactly how the presentation agent is supposed
   to pick a relationship to show a user, reading the real implementation
   (`shared/brain/relationships.ts`, `relationships.schema.ts`, `shared/brain/index.ts`'s `edgeScore`/
   `servingBand`) rather than assuming — the owner's questions repeatedly caught real gaps and one
   inconsistency in the doc's own worked example (see Decided/Changed).
3. Drafted, then wrote into the doc: the edge-selection logic, the trust-score grading breakdown, what
   happens when the two verification AIs disagree, and a proposed retry loop so an unresolved relationship
   doesn't just dead-end.

## Changed
- **`docs/BIOTOPE-NAO-LINK.md`** (rewritten; +306/-129 lines; committed `a6946d9`):
  - Fully localised — the intro now defines "biotope's deterministic engine," "the brain," and "the
    presentation agent" inline instead of pointing elsewhere.
  - §3 — fixed the worked example, which had asserted an unverified HRV→illness-risk *direction* as if it
    were settled fact (an inconsistency the owner caught mid-session); added the presentation agent's
    edge-selection logic (drop `no_effect`/`confounds` relation kinds, rank by trust score, keep one edge
    per contributing metric — up to two on a cross-metric card, never the whole retrieved pool); added
    direction-matching (the presentation agent never decides a relationship's direction, only phrases the
    already-verified direction against which way the user's own metric moved); corrected the Cypher query
    and surrounding prose to distinguish the checker's raw `confidence` from the rolled-up `trustScore`;
    softened the fallback section to plain language; documented the cache-invalidation decision (below) at
    its "Trigger" paragraph.
  - §4 — retitled "Who decides a relationship" and rewritten in plain language; added a "why the checker
    can be trusted" breakdown (independent re-retrieval, adversarial default-to-doubt, structural
    can't-fake-it schema invariants, the free quote-check, different-model decorrelation, graded trust not
    a stamp); added the exact trust-score grading formula, sourced from `edgeScore()`
    (60% checker confidence / 25% study-design tier ladder / 15% corroboration count); added "what happens
    when the checker disagrees" (contradicted → suppressed + human review + source re-check flag;
    unsupported → held back with no benefit of the doubt; uncertain → just re-run, no human/new-evidence
    needed); added a proposed retry loop so an "unsupported" edge doesn't dead-end (log the specific stuck
    pairing, retry only when genuinely new relevant evidence appears — never a blind timer — prioritise by
    demand, cap attempts before falling back to human review or accepting it as unprovable).
  - §6 — open items expanded 6 → 9 (direction field on `insight_cards`; confidence-calibration audit gap;
    the new retry loop's undecided specifics). Item 4 (cache invalidation) resolved from open to
    **DECIDED**.

## Decided
- `BIOTOPE-NAO-LINK.md` must stand alone — no reader should need `PHASE2-PLAN.md`, `NAO-DESIGN.md`,
  `INSIGHTS-ENGINE-DESIGN.md`, or `BRAIN-DESIGN.md` open to follow it.
- The presentation agent must narrow the brain's retrieved candidates down to a single edge per
  contributing metric (never the whole retrieved pool) via a deterministic filter + rank — never LLM
  arbitration between candidates.
- **Cache invalidation (was §6 item 4, now decided):** regenerate the presentation agent's cached output
  whenever a card is re-fired (an `(user_id, rule_id)` upsert), rather than persisting until the card's own
  `expires_at`. One lifecycle, no separate cache TTL.
- A stuck ("unsupported") relationship should not be a dead end: log it as a specifically-stuck pairing
  (extending the `insight_needs` pattern) and retry only when new, topically relevant evidence appears —
  never on a blind timer — capped before falling back to human review.

## Left / not touched
- §6 now has 9 open items; only item 4 was resolved this session. Deferred to a future session per the
  owner's explicit choice: evidence-source shape (1), Deno Neo4j driver (2), retrieval cap tuning (3), sync
  job trigger mechanics (5), `insight_needs` shape (6), direction field on `insight_cards` (7),
  confidence-calibration audit (8), and the new retry loop's undecided specifics (9).
- The prior session's app-layer audit gaps (notifications/nudges, derived-metric algorithms, external API
  fetching, screen-by-screen UX flows, permission-rationale UX) — untouched, still open, out of scope here.
- Commit `a6946d9` is **not yet pushed** — the owner chose to stop and continue the remaining open items in
  a future session rather than push now.

## Blockers
- None this session (docs-only; no build/test blockers apply).

memory: none
