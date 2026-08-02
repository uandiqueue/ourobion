---
title: Correct a false "there is no macOS machine" claim carried into the hosted-demo record PR
summary: The orchestrator prompt asserted no macOS machine exists in this project. It does — Alton's box appears as `altonmac` in the session logs, and the demo runbook records the recording host as macOS darwin-arm64, observed 2026-08-01. The Windows guidance is right for the orchestrator's box; the blanket denial was wrong and would have led a future session to delete valid macOS steps as dead.
type: session
scope: run4
status: canonical
updated: 2026-08-02
---

# Correcting the no-macOS claim

Branch `docs/run4/hosted-demo-record` (PR #362).

## Changed

`orchestrator-prompt.md` §6 said, flatly:

> "There is NO macOS machine in this project."

That is false. Two independent pieces of evidence:

- `docs/sessions/20260728T150859Z-altonmac-claude-run4-u1-boundary-secretscan-correction.md` — a
  session run from a machine identified as `altonmac`
- `docs/hackathon/the_launchpad_challenge/plan/demo-runbook.md` records the recording host as
  **macOS 26.5.2, `darwin-arm64`**, labelled "Connected now — local config observed 2026-08-01", and
  plans to record biotope on macOS desktop

The section now says what is actually true: it describes the **orchestrator's** box, which is Windows
(host `UaNdIQueue`); a macOS machine exists and belongs to Alton; macOS instructions are not fiction,
they are simply not for this box, and should not be deleted as dead.

## Decided

- **The Windows content stays.** It was and is correct for the orchestrator's machine, and the traps
  it records (nothing on base PATH, push from an activated PowerShell, the extensionless Supabase
  shim, `curl.exe -X HEAD` hanging) are real.
- **The blanket denial was the error, and I amplified it.** The sentence originated on the
  `chore/hack-mvp-hosted-demo` branch on 2026-07-28. I carried it into PR #362 and described it in
  the PR body as correcting "a fictional macOS device setup for a machine that does not exist". That
  framing was confident and wrong. Inheriting a claim is not the same as verifying it, and a PR
  description that calls something a correction should have been checked first.
- **Why it mattered:** the denial is the kind of statement that licenses deletion. A future session
  cleaning up "dead macOS instructions" would have removed guidance the demo recording depends on.

memory: none — a corrected factual claim in one run document, not a durable architectural fact.

## Verification

- `ls docs/sessions/ | grep -i mac` → one `altonmac` session
- `grep -n macOS` in the demo runbook → six references, all evidence-labelled and current
- `node tools/context_sync.mjs --check` — passed
