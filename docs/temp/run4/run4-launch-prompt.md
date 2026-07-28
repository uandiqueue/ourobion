---
title: Run 4 launch prompt — superseded pointer
summary: Historical launch entrypoint retained only to redirect new sessions to the current continuation orchestrator prompt.
type: plan
scope: shared
status: draft
updated: 2026-07-28
---

# Run 4 launch prompt — superseded pointer

The original launch prompt described the pre-U0 state and now conflicts with merged history and the
current reconciliation queue. Do not execute its historical text.

Start or resume Run 4 with exactly:

```text
run docs\temp\run4\orchestrator-prompt.md
```

That prompt reads [`continuation-status.md`](./continuation-status.md), refreshes live GitHub and local
ancestry, distinguishes built from merged work, and resumes gate/U1/U2/U3/U4/U5/UI reconciliation.
The historical launch prompt remains recoverable from Git history if provenance is needed.
