---
title: Temp — in-building and promotable docs
summary: TEMP is the staging area for docs still being built; long-horizon run records are filed per run under temp/run1/, temp/run2/, and temp/run3/; dated briefs live in temp/briefs/ as YYYY-MM-DD-slug.md; lifecycle is draft in temp/ → promote to shared/nao/biotope → move the original to docs/archive/. Index source for the temp lifecycle.
type: process
scope: repo
status: canonical
updated: 2026-07-26
---

# Temp — in-building and promotable docs

`docs/temp/` is the staging area for documents that are still being built and are candidates for promotion
into the durable tree. It is not ground truth: anything canonical lives under `docs/shared`, `docs/nao`, or
`docs/biotope`.

## What goes here

- **Work in progress** — drafts of architecture notes, designs, or plans not yet ready to be canonical.
- **Per-run records** — every long-horizon run keeps its tracking docs in its own `run<N>/` folder
  (see the layout below). One folder per run; do not scatter run docs at the top level.
- **Dated briefs** — plain-language stakeholder briefs go in `temp/briefs/` as `YYYY-MM-DD-slug.md`. Lead
  with the problem and the outcome, keep it to about one page, and link to the technical doc it summarizes.

## Run folders

| Folder | Run | State |
|--------|-----|-------|
| [`run1/`](./run1/README.md) | Phase-2 build run (U1–U28) + its record-only audit, evidence review, and research-fixes remediation | **Build merged** into `dev-phase2`; **sign-off review incomplete** |
| [`run2/`](./run2/README.md) | Phase-2 Run 2.0 — demo-slice build (U0–U13, O9–O20) | **Built, DoD met**; every unit sign-off still `pending` |
| [`run3/`](./run3/README.md) | Phase-2 Run 3.0 — O24–O30 remediation/UI extension plus one GMI NLI pilot | **Planning locked**; build not started |

Both folders use the same file names so the two runs read the same way: `orchestration-log.md`
(build history), `config-decisions.md` / `signoff-decisions.md` (C- and D-entries),
`blocked-register.md` (human-gated B-items), and a unit index.

**Carry-forward rule.** A run folder is closed only when its open items are resolved. Anything Run 1
left open is *not* buried in `run1/` — it is listed in
[`run2/carry-forward-from-run1.md`](./run2/carry-forward-from-run1.md), which points back into `run1/`
for the detail. Run 3's living superset register is
[`run3/pending-build-register.md`](./run3/pending-build-register.md); it carries Run-1 and Run-2 debt
forward rather than burying it in a closed run folder.

## Lifecycle

1. **Draft** in `docs/temp/` (or `docs/temp/briefs/` for a dated brief).
2. **Promote** the durable content into its canonical home under `docs/shared`, `docs/nao`, or
   `docs/biotope`, with proper front-matter and a single canonical owner.
3. **Archive** the original: move it to `docs/archive/` and add the archive banner forward-linking to the
   promoted doc (the archive rules live in `docs/archive/README.md`).

A temp doc is a snapshot on its way to one of those two ends — promoted, then archived. It should never be
the thing another doc treats as the source of truth.
