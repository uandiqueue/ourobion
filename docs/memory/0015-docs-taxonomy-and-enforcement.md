---
id: "0015"
title: Docs taxonomy and enforcement
summary: The docs tree has a fixed taxonomy (shared/nao/biotope/memory/sessions/graph, temp=in-building, archive=frozen/superseded), a kebab + type-suffix + front-matter naming rule, docs/INDEX.md as the enforced map, and context_sync.mjs --check enforces front-matter, supersede reciprocity, index freshness, and archive-containment.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# 0015 — Docs taxonomy and enforcement

**Decision (adopted 2026-07-13).** The `docs/` tree was reorganised into a single, enforced
information architecture. This file records the shape as a durable fact.

**The taxonomy** — every doc lives in exactly one place by audience/scope:

- `docs/shared/` — cross-app engine, contracts, decisions, hackathon.
- `docs/nao/` and `docs/biotope/` — per-app design/context.
- `docs/memory/` — durable one-fact-per-file records (this directory).
- `docs/sessions/` — chronological work logs.
- `docs/graph/` — curated knowledge-graph truth.
- `docs/temp/` — in-building drafts (work not yet promoted to a canonical home).
- `docs/archive/` — frozen / superseded material, kept only for provenance.

**Naming + front-matter.** Active docs use kebab-case filenames with a type suffix
(`-architecture`, `-design`, `-context`, `-plan`, `-protocol`, `-catalog`/`-rules`) and carry
YAML front-matter (`title`, `summary`, `type`, `scope`, `status`, `updated`). Memory and decision
records use the id/title/summary/type/status/decided/updated schema instead.

**Canonical owners.** Each topic has one owner doc; every other doc points to it rather than
restating it. The insight-engine stages live in
[../shared/insight-engine-architecture.md](../shared/insight-engine-architecture.md); shared
contract types in [../../shared/SHARED-CONTEXT.md](../../shared/SHARED-CONTEXT.md).

**Enforcement.** `docs/INDEX.md` is the authoritative map of the tree, and
`node tools/context_sync.mjs --check` (pre-push hook + CI) now enforces front-matter validity,
supersede reciprocity (`supersedes` ↔ `superseded_by`), index freshness, and **archive-containment**:
no active doc may link into `docs/archive/` — links flow archive → active only.
