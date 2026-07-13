# Session — docs consolidation into app-scoped ground truth + hackathon narrative

- **UTC:** 20260713T033718Z
- **Device / agent:** agentjwork / claude
- **Branch:** docs/consolidate-ground-truth-hackathon
- **Issue:** #39

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
