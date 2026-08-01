---
title: Run 4 — exclude app-measuring metrics from scientific discovery
summary: An aborted ingestion run exposed that buildCandidates derives discovery pairs mechanically from registry derivedFrom[], so log_completeness became a scientific-discovery subject automatically — seven of the eight derivedFrom candidates were log_completeness pairs; the exclusion now lives in code because every artifact regeneration reproduced it.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Run 4 — exclude app-measuring metrics from discovery (#307)

Issue: #307; branch: `fix/brain/exclude-app-metrics-307`; base: `5b9655b` (the PR #323 merge);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

## Attempted

- Run the owner-approved bounded ingestion for MVP goal 1, and fix what it surfaced.

## Changed

- `tools/brain-ingest/src/seeder/candidates.ts` — `NON_SCIENTIFIC_METRIC_KEYS`
  (`log_completeness`, `notes`), applied to **both** candidate sources: `derivedFrom` (the derived
  metric itself *and* either side of a pair) and `rule_blueprint`.
- `tools/brain-ingest/tests/seeder.test.ts` — the fixture slot that used `log_completeness` to
  exercise multi-input `derivedFrom` is now `gut_comfort_score`, a real health metric with two
  derivation inputs, so the ordering/direction test still tests what it is for; the real-registry
  count assertion updated `8 → 1`; a dedicated exclusion test added.

## Decided

- **The exclusion belongs in code, not in an artifact.** `buildCandidates` derives pairs
  **mechanically** from registry `derivedFrom[]`, so any metric other metrics derive from becomes a
  discovery subject automatically. Deleting or regenerating `seed-queries.json` would have produced
  the same `log_completeness__*` candidates again. This is why the first instinct — "regenerate the
  stale artifact" — was insufficient.
- **The old assertion of 8 derivedFrom candidates was pinning the defect.** Seven of the eight were
  `log_completeness__*`; the single survivor is `df:stool_variability__stool_form`. So the test had to
  change rather than the exclusion being softened to satisfy it. The drop from 8 to 1 **is** the
  finding, and the test now says so.
- **The fixture was swapped rather than weakened.** Three tests used `log_completeness` deliberately,
  as the only fixture metric with two `derivedFrom` inputs. Substituting `gut_comfort_score` keeps
  them exercising multi-input ordering and direction; deleting the cases would have removed real
  coverage to make the suite pass.
- **A completeness-gated rule stays a valid rule.** Only its *discovery pair* is dropped. These
  metrics remain in the registry and remain derivable — they are excluded from being asked **about**,
  not from existing.
- **The gap ledger corroborates the shape independently**: 15 of its 29 rows pair something against
  `log_completeness`, which is why it is not a selection input either. Two mechanisms produced the
  same wrong subject from the same root cause.

## Verification

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck / tests | clean / **465/465** |
| `derivedFrom` candidates, real registry | **8 → 1** |
| candidates naming `log_completeness` / `notes` | **0** |

**The aborted run stored nothing** — verified rather than assumed: local manifest unchanged at 1,298
records, zero records tagged `log_completeness`, 23 `discover[...]` lines and **zero**
fetch/store/upsert/manifest-sync lines. Discovery only reads external APIs; R2 writes need the store
stage, which never ran.

**The re-run, after three prerequisite checks**, is healthy: `topics: 33 static + 0 db`, plain topic
slugs rather than `df:`/`rb:` pairs, 107 discovery calls, **0** `log_completeness` occurrences, with a
watchdog that kills the run if that string ever appears.

**No provider calls.** Spend unchanged at **US$1.118 OpenAI · Anthropic 0 · Agnes 18/50**.

## Left

- Ingestion is still running; corpus growth, per-family coverage (measured, not assumed) and the
  re-screened candidate count all still to report. The last decides whether A3's ~US$6–10 estimate
  holds.
- Layer 2 of D2 — the verifier-side `mechanismCheck`. Specified on #307, not implemented.
- A5 — the product-snapshot pin removal (owner-authorised, option 1).
- `arxiv` returns **HTTP 429** on essentially every query and is skipped each time. Harmless (other
  adapters carry discovery) but it means arxiv contributes ~nothing at this scale and wants a backoff
  before anyone counts on it.

## Blockers

- None.

memory: none
