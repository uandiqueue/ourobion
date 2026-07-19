# Session 20260719T102011Z — agentjwork — claude — skills-generality-refactor

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build agent) · **Branch:**
  `docs/skills/run-procedures` (PR #97, plain branch off `dev-phase2`) · **Issue:** see PR
- **Type:** docs-only — apply the skills **generality refactor** (from a completed
  read-only review) to `.claude/skills/`: procedures stay timeless with placeholders,
  Phase-2 specifics become clearly-labeled examples, repo-coupling (toolchain, gates,
  container names, session-log format) stays. Also commits the two skills captured by
  other sessions (`record-only-audit/`, `evidence-review-run/`) so the set exists outside
  a working tree.

## Attempted
- Faithful, minimal-diff application of the review's 9 items; grep-verified that no
  `phase2-run-` literal survives in operating text (allowed only in the two
  history/example reference files).

## Changed (committed)
- **`.claude/skills/orchestrate-build-run/references/tracking-docs.md`** — the four doc
  section titles generalized to the naming convention
  `docs/temp/<run-slug>-{orchestration-log,blocked-register,signoff-decisions,config-decisions}.md`
  with `<run-slug>` stated once (e.g. `phase2-run`); the docs/shared→docs/temp move
  (superseding D6) demoted to a "Phase-2 history" note at the bottom; B/D/C entry formats
  and ledger shape kept verbatim.
- **`.claude/skills/orchestrate-build-run/SKILL.md`** — resume path now reads
  `docs/temp/<run-slug>-*.md` (convention in references/tracking-docs.md);
  `<integration-branch>` placeholder introduced ("Phase-2 used `dev-phase2`"); inline
  incident IDs (A15-per-D9, the L6 hold-band card / register B5 INTERIM string, the
  U0–U29 / 15-PR-chain framing) moved out, leaving the timeless principles inline;
  **evidence-review-run** added to the member-skill list (previously referenced by
  nothing) alongside record-only-audit, stacked-pr-chain, windows-toolchain-gotchas.
- **`.claude/skills/orchestrate-build-run/references/phase2-run-example.md`** (NEW) — the
  Phase-2 run as the labeled worked example: what it was, its scale (U0–U29, 15-PR chain,
  AU0–AU9 audit, D1–D20 / C1–C12), and three named incidents with their D/B ids
  (A15-stayed-per-D9; the L6 hold-band card / B5; the reverse-cascade merge / D20,
  pointing at stacked-pr-chain's incident record).
- **`.claude/skills/orchestrate-build-run/references/dispatch-brief-template.md`** —
  SKELETON only: `docs/temp/<run-slug>-orchestration-log.md` + `<integration-branch>`
  placeholders; the labeled "Filled example (U24)" section untouched.
- **`.claude/skills/windows-toolchain-gotchas/SKILL.md`** — hard line number dropped
  ("line ~129" → search for the `\x00` separator); U-unit references generalized
  ("U29's TS2345" → a first-run CI type failure; "U7's session log" → an earlier seeding
  session's log); the dated backend-test-plan path marked "(if still present)".
  File/container names (`supabase_db_ourobion`, `compute-baselines`) kept — legitimate
  repo-coupling. Set-membership pointer already present.
- **`.claude/skills/record-only-audit/`** (NEW — committed; content captured by an
  earlier session, refactored here) — SKILL.md: set-membership pointer line added; unit
  decomposition prefixed "Phase-2's layout was:" (hedge "(adapt to scope)" kept).
  references/finding-hotspots.md: the four lens headings kept as the reusable content;
  specific findings demoted to "Phase-2 examples:" / "Phase-2 example:" parentheticals
  (lens 1 proven-findings list, lens 2 InsightCard/bigint/enum specifics, lens 3
  personal_signals + snooze-clobber, the derived_metrics RLS example).
- **`.claude/skills/evidence-review-run/`** (NEW — committed; content captured by an
  earlier session, refactored here) — set-membership pointer line added; the "Proven
  instance: … RU2–RU7 / C1–C12 / D1–D15 / ADRs 0001–0003" line and the RU7
  refutation-count line given explicit "(example from the Phase-2 run)" framing; the
  n=1-daily-self-tracking product coupling kept (correct coupling).
- **`.claude/skills/stacked-pr-chain/`** — untouched (the review's model of correct
  layering); verified its set-membership pointer line is already present. `graphify/`
  untouched.
- **`docs/temp/phase2-run-orchestration-log.md`** — ledger row for this refactor.
- **`docs/temp/phase2-audit/audit-orchestration-log.md`** — an earlier session's
  uncommitted skill-capture ledger row (documents the record-only-audit capture)
  committed alongside the skill it records.

## Decided
- **The naming convention applies to FUTURE runs only** — this run's shipped
  `docs/temp/phase2-run-*.md` docs keep their filenames; renaming shipped run docs is out
  of scope. Cross-references to them from the two example/history reference files remain
  correct literal paths.
- `phase2-run-` literals are allowed only inside clearly-labeled example/history blocks:
  after the refactor they survive only in `references/phase2-run-example.md` and
  `stacked-pr-chain/references/phase2-reverse-cascade.md` (grep-verified).
- The roles-section D2 waiver reference and the "opened with 4 Explore agents" /
  audit-coverage-gaps parentheticals stay inline — the review enumerated exactly which
  incident IDs move, and these are already labeled Phase-2 asides (minimal diffs).

## Left
- Nothing pending for the set. `docs/temp/phase2-research/` (another session's in-flight
  work) left untouched and uncommitted, as briefed.

## Blockers
- None. Gate: `flutter analyze` clean · `flutter test` 66/66 untouched-green ·
  `node tools/context_sync.mjs --check` pass · all changed/new skill files NUL-free ·
  generated-plugin EOL churn verified content-empty and discarded before commit.

memory: none
