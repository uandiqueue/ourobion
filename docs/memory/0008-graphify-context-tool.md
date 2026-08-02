---
id: "0008"
title: Graphify is optional derived context
summary: Graphify is an optional, rebuildable semantic index for context discovery; it never outranks code, contracts, migrations, curated architecture, or enforced coupling guards.
type: memory
status: unverified
decided: 2026-07-13
updated: 2026-08-02
---

# Graphify is optional derived context

Graphify may index code and documentation to help an agent discover relevant relationships without
loading the whole repository. Its output is machine-generated, probabilistic, and rebuildable.

Graphify never overrides executable code, migrations, shared contracts, curated architecture, or
`couplings.yaml` and its guard tests. If the graph is missing, stale, or unavailable, use ordinary
repository search and inspect the authoritative source directly. Never feed archive material or
Graphify's generated output back into the index.

Setup, commands, generated-file locations, and tool integrations belong in
[`docs/graph/README.md`](../graph/README.md), because those mechanics can change without changing this
boundary.
