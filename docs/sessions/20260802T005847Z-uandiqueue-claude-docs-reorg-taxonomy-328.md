---
title: Reorganise docs into implemented / development / hackathon / archive, and move the enforcement with it
summary: Moved 220 files into the owner-approved taxonomy via git mv, retargeted 235 broken links and 100 bare path references mechanically from git's own rename map, split the hackathon folder so submission/ holds only the write-up being submitted, archived run3, and relocated 51 MB of AI image prompts out of docs/ into assets/. context_sync.mjs, .aiignore and the secret-scan allowlist were updated in the same commit so the gate never sees a broken intermediate state.
type: session
scope: repo
status: canonical
updated: 2026-08-01
---

# Docs reorganisation — Phase 2 of the #328 housekeeping run

Branch `docs/reorg/taxonomy-328`, cut from `main` @ `5a5af7c`. One atomic commit: the moves and the
tooling that enforces them cannot land separately without leaving the gate red in between.

## Changed

### The taxonomy

```
docs/
├── implemented/        what exists and works (+ biotope/, nao/)
├── development/        roadmap, process, decisions/, run4/, model-training/
├── hackathon/the_launchpad_challenge/{submission/, plan/}
├── archive/            + runs/run3/ (newly archived)
├── sessions/ memory/ graph/   UNCHANGED — tooling-enforced paths
└── INDEX.md            regenerated
assets/ui-generation/   51 MB of AI image prompts, moved OUT of docs/
```

`submission/` holds **only `writeup.md`** — the artifact actually being submitted. `demo-runbook.md`,
`system-connection-map.md`, `hackathon-direction.md` and `hackathon-rules.md` are working material
and went to `plan/`.

### Enforcement moved with the docs

- `tools/context_sync.mjs` — `GROUND_TRUTH_RELDIRS` is now
  `["docs/implemented", "docs/development", "docs/hackathon"]`; `DECISIONS_DIR` follows to
  `docs/development/decisions`.
- `.aiignore` — added `assets/ui-generation/` so 94 image-prompt files stay out of the agent crawl.
- `docs/INDEX.md`, `docs/memory/README.md`, `docs/development/decisions/README.md` regenerated via
  `--fix-index` (never hand-edited).

### Links retargeted mechanically, not by hand

227 markdown links broke. Rather than hand-editing 44 files, links were resolved **from each file's
old location** using git's own rename detection, then re-relativised to the new location — 224
rewritten automatically, 3 left, of which 2 were **pre-existing** dead references (targets that never
existed on `main`) and 1 was a directory move fixed separately. Then ~100 bare (non-link) path
mentions were retargeted across 87 files.

## Decided

- **Archive containment surfaced pre-existing violations.** Moving `docs/temp/` into
  `docs/development/` brought ~111 previously-unchecked files under `GROUND_TRUTH_RELDIRS` for the
  first time, and the archive-containment rule immediately flagged 11 links into `docs/archive/`.
  The rule permits *mentioning* archive, not linking into it, so those 11 became plain
  `` `docs/archive/...`, archived `` references. Two of them were violations that predated this
  change and had simply never been checked.
- **A historical secret-scan fingerprint could not be satisfied.** `allowlist.json` entry[4] is a
  git-mode fingerprint (`1a69650…:docs/nao/nao-app-design.md:…`) pinned to a commit. The guard
  requires `entry.path === parsed.file` **and** that `entry.path` be currently tracked — after the
  move those are mutually unsatisfiable, because at commit `1a69650` the file genuinely lived at
  `docs/nao/`. Both fields were aligned to the new path. **This is fail-visible, not fail-silent:**
  if gitleaks' history scan still emits the old path, the finding goes *unsuppressed* and the
  secret-scan job goes red — it cannot silently allow a real secret. gitleaks is not installed
  locally (CI installs a pinned build), so **CI is the authoritative check on this one entry.**
- **`AGENTS.md` left untouched, per the owner's standing instruction** — it now carries **61 dead
  doc-path references**. This is a direct consequence of the move and needs a follow-up decision;
  the path fixes are mechanical and independent of the `dev-phase2-run4` branch-model staleness the
  owner deferred separately.
- **`docs/graph/semantic-graph.md` is stale (186 old paths).** It is generated; `npm run
  graph:view:write` needs `graphify-out/graph.json`, which is machine-local and absent here.
  Regenerate on a machine that has built the graph.

memory: none — this rearranges where documentation lives and updates the tooling that enforces it;
it establishes no new architectural fact about the system itself.

## Verification

- `node tools/context_sync.mjs --check` — passed
- `node --test tools/secret_scan_guard.test.mjs` — 112 pass, 0 fail
- `node --test tools/check_arch_boundaries.test.mjs` — 50 pass, 0 fail
- 220 renames detected by git (history preserved)
- link sweep: 0 broken links remain except the 2 pre-existing dead references
