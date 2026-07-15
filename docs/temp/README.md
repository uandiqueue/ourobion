---
title: Temp — in-building and promotable docs
summary: TEMP is the staging area for docs still being built; dated briefs live in temp/briefs/ as YYYY-MM-DD-slug.md; lifecycle is draft in temp/ → promote to shared/nao/biotope → move the original to docs/archive/. Index source for the temp lifecycle.
type: process
scope: repo
status: canonical
updated: 2026-07-13
---

# Temp — in-building and promotable docs

`docs/temp/` is the staging area for documents that are still being built and are candidates for promotion
into the durable tree. It is not ground truth: anything canonical lives under `docs/shared`, `docs/nao`, or
`docs/biotope`.

## What goes here

- **Work in progress** — drafts of architecture notes, designs, or plans not yet ready to be canonical.
- **Dated briefs** — plain-language stakeholder briefs go in `temp/briefs/` as `YYYY-MM-DD-slug.md`. Lead
  with the problem and the outcome, keep it to about one page, and link to the technical doc it summarizes.

`temp/briefs/` is currently empty.

## Lifecycle

1. **Draft** in `docs/temp/` (or `docs/temp/briefs/` for a dated brief).
2. **Promote** the durable content into its canonical home under `docs/shared`, `docs/nao`, or
   `docs/biotope`, with proper front-matter and a single canonical owner.
3. **Archive** the original: move it to `docs/archive/` and add the archive banner forward-linking to the
   promoted doc (the archive rules live in `docs/archive/README.md`).

A temp doc is a snapshot on its way to one of those two ends — promoted, then archived. It should never be
the thing another doc treats as the source of truth.
