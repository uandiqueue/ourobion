---
title: Run 4 — compute the product union instead of pinning it
summary: Replaced a hardcoded product-union snapshot that was refreshed nine times in one day without ever carrying information — and was a correctness risk because resolving its merge conflicts requires re-measuring while looking like a trivial one-line pick — with computed invariant assertions plus a report artifact, and a test proving the denial beside it survived.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Run 4 — remove the product-union pin (#307 A5)

Issue: #307; branch: `ci/run4/remove-product-pin-307`; base: `72416a9` (the PR #324 merge);
device: `agent-j`; agent: `claude` (Opus 5, 1M context). Owner-authorised as option 1 on #307.

## Attempted

- #307 A5: stop pinning the measured product union in source; assert only the load-bearing
  invariants and record the number to an artifact.

## Changed

`tools/run4_release_gate.test.mjs`:

- Removed `assert.deepEqual({ changedPaths, addedLines }, { changedPaths: N, addedLines: M })`.
- Kept and strengthened the invariants: the measured union **exceeds both caps**, `withinCap` is
  `false`, MT4 exclusions are exactly **28**, allowlisted binary paths are exactly **15**.
- The enforcement `throws` regex no longer pins the count (`/has \d+ paths; cap is 115/`).
- Writes the measured numbers to `run4-product-union.json` under `RUNNER_TEMP` (falling back to
  `tmpdir()`), so CI can upload it as an artifact and nothing lands in source.
- **New test** `#307 A5: removing the pin does NOT let product-cap acceptance be claimed`.

**Untouched, deliberately:** the caps (`115` / `8,500`), the per-unit **landing** delta gate (that one
is real and binding — it is what blocked #289), `productCapAcceptanceClaimed`, and the MT4
exclusion / binary-allowlist logic.

## Decided

- **Nine refreshes in one day, none carrying information.** 533 → 535 → 536 → 544 → 545 → 546 → 558
  → 559 → 560. Across all nine the caps never moved and the assertions that the delta *exceeds* them
  never changed. A test that fires nine times without once telling us something true is not
  protecting anything.
- **It was a correctness risk, not merely friction** — the reason option 2 (isolate the pin in its own
  file) was rejected. With several sessions merging into one line the pin conflicts on **every**
  landing, and resolving that conflict correctly requires **re-measuring**; but it presents as a
  trivial one-line pick between two numbers. Isolating it would make a conflict that needs a
  measurement look even more like a trivial pick. A stale value that happened to survive CI would be
  a **false recorded measurement** in the one file whose entire purpose is recording measurements
  accurately.
- **Two properties made the pin quietly treacherous**, both learned the hard way earlier in this
  session: it counts the very commits that refresh it, so it must be the last edit before every push;
  and `productLandingDelta()` reads **committed HEAD, not the working tree**, so measuring with an
  uncommitted edit returns the *pre-edit* number and looks like convergence when it is not.
- **Removing a recorded measurement must not remove the denial beside it.** The pin sat next to the
  non-acceptance posture, so the new test asserts enforcement still throws on the real union, still
  refuses a moving base, still refuses a widened cap in **both** dimensions, and that the shipped
  attestation still declares `productCapAcceptanceClaimed: false`. Without that, this change could
  have deleted a guard while looking like tidying.
- **The generalisable lesson, recorded because it outlives this file:** *a recording mechanism whose
  maintenance cost is a per-merge manual edit will eventually record something false.* The nine-value
  sequence is the evidence, and it is in the test's own comment so the next reader sees it.
- **This is the last time anyone does the refresh dance.** The pin conflicted four times in this
  session alone; after this it disappears.

## Verification

| Gate | Result |
|---|---|
| `tools/run4_release_gate.test.mjs` | **19/19** |
| measured union still exceeds both caps | asserted |
| `withinCap` | `false` |
| MT4 exclusions / binary paths | **28** / **15** |
| `productCapAcceptanceClaimed` in the shipped attestation | **false** |
| `node tools/context_sync.mjs --check` | passed |

- The report artifact is read back and re-asserted in the same test, so a write that silently failed
  would fail the test rather than pass quietly.
- **No provider calls.** Spend unchanged at **US$1.118 OpenAI · Anthropic 0 · Agnes 18/50**.

## Left

- Layer 2 of D2 — the verifier-side `mechanismCheck`. Specified on #307, not implemented.
- Post-ingestion: corpus growth, per-family coverage measured rather than assumed, and the
  re-screened candidate count (which decides whether A3's ~US$6–10 estimate holds).
- `arxiv` HTTP 429s on essentially every query and is skipped; other adapters carry discovery, so it
  is not blocking, but it contributes ~nothing at this scale and wants a backoff.

## Blockers

- None.

memory: none
