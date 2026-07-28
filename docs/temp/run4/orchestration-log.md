---
title: Run 4 Orchestration Log
summary: Current resume pointer, verified branch/GitHub snapshot, reconciliation queue, and evidence boundaries; historical preflight detail remains in session logs and Git history.
type: plan
scope: run4
status: canonical
updated: 2026-07-28
---

# Run 4 Orchestration Log

## Resume pointer

Run [`orchestrator-prompt.md`](./orchestrator-prompt.md). It reads the authoritative
[`continuation-status.md`](./continuation-status.md), refreshes live GitHub/ancestry, and resumes the
queue without rebuilding merged units.

## Verified snapshot — 2026-07-28

- Primary VS Code checkout fast-forwarded cleanly to `dev-phase2-run4` tip
  `ad8ef178053c7e6514283f19ee7a4f3f0829dc0c` before issue #193.
- U0 #161, base-convention #172, and U2 #177 are merged.
- U1 #170/#180, U2 corrections #185/#186, U3 #184, U5 #176, provider evidence #190, and UI
  #175/#191 are open/unmerged.
- The checked-in machine unit base is `c558c04f1b661a59c8987c96770768eeea46e0cc`, behind merged U2.
- #176/#184/#185/#186/#190/#191 fail release evidence + aggregate gate. #180 also fails secret scan.
- U4 is startable with Jayden and Alton named as reviewers.
- #191 contains #175; #180 contains #170's original U1 head; #190 is stacked on #176.
- Issue #171 remains open despite PR #172's close text.
- No PR newer than #191 existed at refresh.

## Active queue

1. Reconcile exact gate base, CI and generated attestation; resolve issue #171 state.
2. Reconcile U1 through #180, fix the secret-scan failure, and retain one canonical PR.
3. Combine U2 corrections #185/#186 and rerun the full authorization regression.
4. Finish U3 #184 including LoaderPanel target and the local HTTP 14 + 7-day walk.
5. Implement U4 scientific semantics/trust with Jayden + Alton review.
6. Rebase/finish U5 #176, then integrate accurate provider evidence #190.
7. Rebase/integrate canonical UI #191 only; supersede/close #175 after equivalence is verified.
8. Run the final full suite and both local exit passes; stop before cloud promotion.

## Evidence boundaries

- The provider run performed full local extraction but OpenAI saw 12 selected passages, not the full
  canonical text. Anthropic was verifier-only and held the edge for zero independent sources.
- The fixed-edge harness passed 20/20 with 21 simulated days and rendered on physical Android.
- This provider/E2E evidence is still on open PR #190 and is not integrated branch truth.
- Built/open branches are not complete. `done` requires merge, current green checks, independent review,
  applicable human review, executed acceptance, and reconciled tracking.

## Historical record

Original preflight, Run 3 lineage, model-training inheritance, U0/U2 delivery, and provider-test details
remain in append-only `docs/sessions/`, Git history, PRs #156/#161/#163/#165/#172/#177/#190, and the
historical envelope fields in `run-envelope.json`. They are provenance, not current operating state.

## Current documentation session

- Issue: #193
- Task claim: `run4-cockpit-fresh-gh` / `codex` / `agentjwork`
- Branch: `docs/run4-cockpit-refresh`
- Writer: primary orchestrator only
- Read-only audits: live PR/check/ancestry audit; Run 4 document consistency audit
- Provider calls, hosted writes, deployments, model execution/training: none
