---
title: Phase 4 stale updates — correct my own "user-visible card" overclaim and qualify the runbook's card count
summary: The earlier staleness audit was itself wrong about two Phase 4 targets, which were already fixed on main. The real finding was a contradiction between the runbook's "0 cards with producer=edge" and my measured 1 — resolved by timestamp: the card exists but is archived, so the runbook was right about the active deck and my system-truth doc was overclaiming with "user-visible".
type: session
scope: repo
status: canonical
updated: 2026-08-02
---

# Phase 4 — stale updates

Branch `docs/phase4/stale-updates-328`, stacked on `docs/phase3/new-docs-328`.

## The planned targets were mostly already done

Phase 4's target list came from a subagent staleness audit run in Phase 1. Two of its headline items
were wrong:

- **`demo-runbook.md` R0** was reported as claiming decorrelation is switched off. It does not. Line
  648 records R0 as `~~struck through~~ **CLEARED 2026-08-01**`, with the `check-config` output
  quoted. The audit had read the risk statement and missed the resolution.
- **`system-connection-map.md`** was reported as labelling the decorrelated verifier
  "Planned/research-only; not serving". It now reads "Implemented and locally proven (ran); **produced
  11 servable verdicts**", with the full band and verdict breakdown.

`origin/main` had not moved (`git rev-list --count 5a5af7c..origin/main` = 0), so both had been
correct on main all along. **Another instance of unverified agent inspection being wrong** — the same
failure mode this run keeps finding.

## The real finding

The runbook states in seven places that **0 cards have `producer='edge'`**, claiming re-measurement on
2026-08-02. My own measurement the same day found **1**. Rather than assume either was stale, I pulled
the card's timestamp and status:

```
rule_id      : edge:gut_comfort_score|correlates|mood_score
title        : "Research-linked pattern: Gut comfort and Mood moved together"
generated_at : 2026-08-01T16:52:32Z
status       : archived
```

Both were right about different things, and **my document was the one overclaiming.**

- The runbook counts what a user sees in the active insights deck. There, the count is genuinely 0.
- `system-truth.md` said "the only **user-visible** card cited to a verified edge". An archived card
  is not in the active deck. That wording would have let a reviewer conclude the demo shows a
  research-backed card in the normal flow. It does not.

## Changed

- **`system-truth.md`** — the claim now states the card exists, quotes its `rule_id`, title,
  `generated_at` and `archived` status, and says plainly that a user opening the app to their current
  insights sees no paper-derived card. The closing sentence was narrowed to match.
- **`demo-runbook.md`** — the evidence-chain row now reads "0 **ACTIVE** cards" and records the one
  archived card with its identifiers and the instruction not to narrate it as what a user normally
  sees. The bare "0 cards" was correct but imprecise enough to be re-derived wrongly later.

## Decided

- **Precision on this specific claim is worth the words.** "0 cards" and "1 card" were both true under
  different readings, and the difference is exactly the kind of thing that becomes a false statement
  on camera. Both documents now carry the qualifier.
- **The audit's target list is not evidence.** Two of the three Phase 4 items evaporated on
  inspection. Remaining genuine items — front-matter `updated:` drift and draft/superseded triage —
  are lower value than they looked and are left for a follow-up rather than bundled here.

memory: none — a corrected measurement and two document wordings, not a durable architectural fact.

## Verification

- card re-queried twice against the hosted project as `test@ourobion.com`; producer counts
  `personal 53 / rules 2 / edge 1`, `edge_refs` on exactly 1, statuses `active 54 / dismissed 1 /
  archived 1`
- `git rev-list --count 5a5af7c..origin/main` = 0, confirming main had not advanced
- `node tools/context_sync.mjs --check` — passed
