# Session — docs consolidation into app-scoped ground truth + hackathon narrative

- **UTC:** 20260713T033718Z
- **Device / agent:** agentjwork / claude
- **Branch:** docs/consolidate-ground-truth-hackathon
- **Issue:** #39

memory: added 0015 (docs taxonomy + enforcement)

## Attempted
Consolidate `docs/` into clear app-scoped ground truth and prepare for the Launchpad 2026 hackathon:
reorganise the folder tree, promote the fable_research architecture (doc 12) to ground truth, author
the granular decisions doc-12 left open, research a winning hackathon narrative, refresh all
references, and run a graphify pass.

## Changed
- **Reorg (`docs/`):** new top-level buckets — `shared/` (cross-app ground truth + process),
  `temp/human-brief/` (research output, incl. `fable_research/`), and `shared/hackathon/`. `nao/`,
  `biotope/`, `sessions/`, `memory/`, `graph/` unchanged. Moved: PROJECT-CONTEXT, STRUCTURE-CONTEXT,
  PHASE2-PLAN, AGENT-PROTOCOL, dev-workflow, commit-conventions → `shared/`; HACKATHON*.md →
  `shared/hackathon/`; `human-briefs/` → `temp/human-brief/`.
- **References:** fixed every `docs/` reference broken by the moves — from-root refs in AGENTS.md,
  README.md, apps/*, .github/ via targeted replace; relative-depth links inside docs via a link-checker
  loop (0 broken at close). `docs/sessions/` left untouched (immutable history).
- **Ground truth promoted:** new authoritative [`docs/shared/INSIGHT-ENGINE-ARCHITECTURE.md`] (doc-12
  promoted, ~900 lines, all 23 stages + invariants + model/hyperparameter tables, "Fable research"/
  P-number scaffolding removed). Corrected [`docs/shared/BIOTOPE-NAO-LINK.md`] brought into the tree
  (Neo4j → relational `verified_edges` 1-hop). App design docs (biotope INSIGHTS-ENGINE-DESIGN, nao
  BRAIN-DESIGN/BRAIN-INGESTION-DESIGN/NAO-DESIGN) get an "authoritative architecture" banner and the
  **dropped Neo4j** model purged (served graph is relational, no graph DB).
- **Granular ADRs:** [`docs/shared/decisions/`] — citation-extraction, anomaly-definition,
  paper-reliability, each researched online with verified citations and adversarially checked.
- **Hackathon:** [`docs/shared/hackathon/HACKATHON_NARRATIVE.md`] — research-backed recommendation
  (lead with the adversarial verifier as a modest-claim-proven; "living apps" as a schema-checkable
  trajectory close, not the headline; prior-art positioning; sources).
- **Cleanup:** STRUCTURE-CONTEXT repo tree updated; pre-existing stale ref in `scripts/seed-test-data.ps1`
  fixed (0007→0009); temp/fable_research READMEs banner-marked as archived/promoted.

## Decided
- `/shared` is the single home for cross-app ground truth + process docs (user call).
- `memory/`, `graph/`, `sessions/` stay at `docs/` root — they are machine-enforced infra
  (`context_sync.mjs`); moving them would break the push gate for no ground-truth gain (user call).
- Superseded material is **rewritten in place + archived to `/temp`**, not deleted — no stale content
  left in a ground-truth path (user call).
- `docs/shared/INSIGHT-ENGINE-ARCHITECTURE.md` is the authoritative integrated design; the app docs are
  app-scoped views that defer to it.
- Neo4j is dropped everywhere in ground truth (relational `verified_edges` 1-hop + client force-graph),
  matching the architecture doc; memory 0013 carries a dated update note.

## Left
- Graphify pass (`graphify update .`) + `context_sync --check` before push.
- Optional: fuller rewrites of the app design docs (currently banner + contradiction-purge, not a
  from-scratch rewrite) if desired.
- Hackathon narrative is a recommendation for Jayden to confirm (it argues against leading with the
  "Living Apps" framing he floated).

## Blockers
- None. (Windows dir-rename hit a transient lock during the reorg; used copy+remove fallback.)

---

## Update — full taxonomy reorg (Fable-planned, same session)

Went deeper on hygiene per user follow-up. Fable produced the taxonomy/naming/enforcement plan
(inventory + online best-practice research → synthesis); executed it:

- **Naming:** every doc renamed to lowercase kebab-case with a type suffix
  (`-architecture`/`-design`/`-context`/`-plan`/`-protocol`/`-catalog`); status + dates moved into
  **YAML front-matter** (added to every active doc), not filenames; `NNNN-` numbering kept only in
  `memory/` and `decisions/`. `SHARED-CONTEXT.md` kept as the one declared sentinel.
- **Archive vs temp split:** `docs/archive/` = frozen/superseded (fable research pack, dated briefs,
  criteria-judge + narrative research) — every file banner + forward-link, excluded from agent crawl
  via a new root `.aiignore`; `docs/temp/` = WIP/promotable (lifecycle README + empty `briefs/`).
- **De-duplication (canonical owner):** the architecture doc owns all stage definitions; app docs got
  a Scope header + pointers; deleted the stale v1 MetricDefinition table (→ shared/metrics) and the
  contract enumeration in architecture-context (→ SHARED-CONTEXT); merged the hackathon narrative into
  hackathon-direction; deleted the doc-12 twin.
- **`docs/memory` robustness (enforced):** `context_sync.mjs` gained `--fix-index` (generates the
  `docs/INDEX.md` + memory + decisions indexes from front-matter) and checks **d–j** — front-matter
  validity, supersede reciprocity, index freshness, `updated:` bump on edits, accepted-decision
  immutability, session `memory:` line, INDEX coverage, archive-containment. Each was **deliberately
  tripped to confirm it fires**. Added [`docs/INDEX.md`] (the doc map) + memory record 0015.
- **Verification:** retired-name sweep = 0 in active docs; link-check = 0 broken active links;
  `--check` green except session-coverage (this log).
- **`.github` / `.githooks` refresh:** issue-template module dropdowns updated (added M3/M4/M7 +
  `nao` + `brain`; feature phase options → Phase-2 Track A/B / Phase 3+); PR template gained the
  `memory:` line + `--fix-index` checklist items; pre-push + CI labels updated to the fuller check
  scope; **CI branch triggers `dev-alton` → `dev-phase2`** (the abolished personal line).

## Decided (reorg)
- Kebab + type-suffix + front-matter naming; status/dates in metadata, never filenames.
- Two buckets: `temp/` (promotable) vs `archive/` (frozen); active docs never link into archive.
- Memory is enforced, not trust-based: front-matter + generated indexes + push-gate checks d–j.
- The insight-engine architecture doc is the sole owner of stage definitions; app docs point to it.

---

## Update — branch consolidation into this branch (2026-07-15)

Consolidated all outstanding work onto this branch (the renewed structure) ahead of a dev-phase2 update:
- **UI assets:** committed the biotope-ui-ux worktree's uncommitted work as AI-generated UI starter
  assets (biomech-botanical images + `BiotopeGeneratedAssets` + logo/brand kit + the ai-assets
  generation subsystem), merged it in, and relocated `ai-assets` to `docs/biotope/ui/ai-assets/`
  (fixing a `git mv` double-nest). Exempted `ai-assets/` from the doc-index enforcement (asset
  working files, not prose).
- **m2 standing-water audit:** cherry-picked Alton's feature (weekly prompt over the existing
  `standing_water_present` column; out of DQS) + its session log.
- **biotope-nao-link:** ported the edge-selection + trust-grading substance from the superseded
  `docs/biotope-nao-link-plan` branch into `docs/shared/biotope-nao-link.md` (adapted to the
  relational, no-Neo4j model); kept its session log. The branch is now redundant.
- **next-steps:** added `docs/shared/next-steps.md` (roadmap) + pointers in AGENTS.md and phase-2-plan;
  marked the W0 standing-water item done.
- Verified: `context_sync --check` green, 0 broken active links, retired-name sweep clean.

## Left (after this)
- Merge this branch → `dev-phase2` (most-updated), then delete stale branches + the biotope-ui-ux worktree.
- **Immediate next step (NOT done here, needs go): fold `dev-phase2` → `main`** to register
  `brain-ingest.yml`'s workflow_dispatch on the default branch and unblock nao ingestion. See next-steps.md.

memory: none

---

## Update — finalize (items 1/2/4, 2026-07-15)

- **apps/nao deploy config committed** (D1 id, nao.ourobion.com route, GH_REPO var + env types,
  User-Agent header, etl D1-transaction fix) — was the preserved WIP; now on dev-phase2.
- **Removed the empty repo-root `tests/` placeholder** (YAGNI; per-package tests are the convention —
  `apps/biotope/test/`, `tools/brain-ingest/tests/`); updated AGENTS §4 + structure-context.
- **Folded `dev-phase2` → `main`** to register `brain-ingest.yml`'s workflow_dispatch on the default
  branch and unblock nao ingestion.

memory: none

- Fixed check (h) to exempt pre-convention session logs (full-history main fold flagged legacy logs).
