---
session: 20260802T003000Z-agent-j-claude-run4-router-day-cap
agent: agent-j (Claude, orchestrator)
date: 2026-08-02
scope: tools/llm-router/router.config.json
---

# The synthesis node's daily USD cap was too small for the work it was asked to do

## What happened

A 60-paper synthesis batch stopped after 12 papers:

```
llm-router budget: node 'synthesis' would cross the 95% hard stop of its US$1/day cap
(already spent US$0.8863, worst-case call cost US$0.0901). Call denied.
```

The guard behaved correctly. The value was simply wrong for a real batch: at roughly
US$0.04/paper, a US$1/day node cap buys about 22 papers.

## Owner instruction

Verbatim, 2026-08-01: *"Synthesis llm (open ai cap is 20 dollars, not 1 dollar)"*.

## Why 8.0 and not the 20 the owner named

`budget.perDayUsdPerNode` is a **single value applied to every node**, not a per-node table.
Five nodes route to OpenAI — `seeder`, `synthesis`, `phrasing_card`, `report_narrative`,
`extract_assist`. Setting it to 20 would permit up to ~US$100/day across them, against a
US$20 account ceiling.

8.0 covers the remaining batch with margin while keeping any single node well under the real
ceiling. Measured spend after the change was US$1.58 for 40 synthesised papers in one day and
US$1.80 all-time across the project, so 8.0 is roughly 5x headroom on observed usage rather
than a blank cheque.

If a genuine per-node table is wanted later, that is a config-shape change, not a value change.

## Unchanged

`perRunOutputTokens` (60000) — which is what actually stopped the *second* batch, and stopping
there was correct. `hardStopFraction` (0.95). And the acceptance-only enforcement that bounds
the free-priced Agnes verifier, which the USD ledger cannot bound at all.

## Gates

- `context_sync --check` — passed
- `git diff --check` — clean

Config-only. No code, no schema, no provider calls made by this change itself.

memory: `budget.perDayUsdPerNode` is one number shared by every node, so multiplying it by the
number of nodes on a provider is the real exposure — quoting an account-level ceiling into it
over-provisions silently.

Refs #300
