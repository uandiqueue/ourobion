---
title: Run 4 continuation status
summary: Authoritative resume snapshot for the current integration branch, live PRs, built-versus-merged units, reconciliation queue, and remaining local exit gates.
type: status
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 continuation status

This is the first file a resumed Run 4 orchestrator reads after `AGENTS.md` and `docs/INDEX.md`.
It supersedes older operational status sentences elsewhere in `docs/temp/run4/`; those remain useful
as historical design and evidence. Always refresh GitHub and local refs before acting.

## Snapshot authority

- GitHub refreshed: 2026-07-28.
- Integration branch: `dev-phase2-run4`.
- Verified integration tip before this documentation session: `ad8ef178053c7e6514283f19ee7a4f3f0829dc0c`
  (merge of PR #177 / R4-U2).
- Checked-in gate base: `c558c04f1b661a59c8987c96770768eeea46e0cc` in both
  `tools/run4_release_gate.mjs` and `.github/workflows/ci.yml`.
- Gate-base drift: the integration branch has advanced beyond that base, so some composite landing
  deltas include already-integrated work. It contributes to the cap failures on #180, #184, #186,
  #190, and #191, but it is not the only red-check cause. Use each Actions log below as the immediate
  failure authority. Reconcile the unit base deliberately; never weaken or bypass the gate.

## Status vocabulary

| State | Meaning |
|---|---|
| `built` | Implementation exists on a branch; it is not on the integration branch. |
| `merged` | The delivery commit is an ancestor of `dev-phase2-run4`. |
| `open-unmerged` | A PR exists but is not integrated. |
| `reconciliation-required` | Overlapping branches, stale bases, red gates, or tracking/evidence disagreements must be resolved before integration. |
| `startable` | Preconditions are now satisfied, but no accepted implementation exists. |
| `blocked` | A named prerequisite prevents work. |
| `deferred` | Intentionally outside the current sequence. |
| `done` | Merged, independently evidenced, required checks green, and tracking/signoff reconciled. |

`built` is never a synonym for `merged` or `done`.

## Unit and product state

| Unit / area | Delivery state | Current disposition |
|---|---|---|
| R4-U0 / O24 + O31-O34 | **merged** in PR #161; gate-base convention advanced in PR #172 | Delivery is present. Reconcile stale signoff text and advance the per-unit base before the next landing. |
| R4-U1 / O35-O36 | **built**; **open-unmerged**; **reconciliation-required** | PR #170 is draft, clean, 21/21 green. PR #180 is stacked remediation for security-gate bypasses; it is draft with 18/21 green. Its immediate failures are five full-history secret findings and a 14,131-addition landing delta above the 8,500 cap; the aggregate gate is consequentially red. Do not merge #170 alone. Rebase and reconcile the combined result, then retain one canonical PR. |
| R4-U2 / O25 | **merged**; corrections **open-unmerged** and **reconciliation-required** | Two post-merge corrections remain open: #185 replacement-key support fails its runtime-attestation config/lock hash check, while #186 reports 8,565 additions against the 8,500 cap. Reconcile both from the current integration tip, rerun the 443-assertion auth harness and nao/internal-auth suites, then integrate one conflict-resolved correction path. |
| R4-U3 / O26 | **built**; **open-unmerged**; **reconciliation-required** | PR #184 is based on the current U2 tip and contains the atomic loader plus re-review fixes. It has 17/19 green; release evidence reports a 15,001-addition landing delta above the 8,500 cap, and the aggregate gate is consequentially red. Reconcile the base, retain U2 protections, repair the documented `LoaderPanel` target gap, and run the full 14 + 7-day HTTP walk before merge. |
| R4-U4 / O27 + O38 | **startable** | Jayden and Alton are the named two reviewers, so P2 is satisfied. No accepted U4 implementation exists. Build the scientific-semantics and artifact-trust seam only after U1/U2/base reconciliation, with both reviewers on any `shared/` change. |
| R4-U5 / single-paper authoring | **built**; **open-unmerged**; **reconciliation-required** | PR #176 is draft with 17/19 green. Its release-evidence job rejects synthetic merge parents that do not match the event base/head; the aggregate gate is consequentially red. Rebase after loader/auth reconciliation. Full paper extraction works, but normal synthesis sends at most 12 selected passages and sentence-provenance B-PL22 remains unimplemented. |
| Provider-backed evidence | **built**; docs **open-unmerged**; **reconciliation-required** | PR #190 is stacked on #176 and has 17/19 green; release evidence reports 8,840 additions against the 8,500 cap, and the aggregate gate is consequentially red. OpenAI was the main synthesis provider over 12 selected passages; Anthropic had one official verifier-only role. The one-paper edge correctly remained held for zero independent corroboration. This was a bounded issue-189 exception, not a general O29 unblock. |
| R4-U6 metrics | **deferred** | U6a/U6b/U6c remain candidate work; no implementation has been built. |
| R4-U7 full UI | **built**; **open-unmerged**; **reconciliation-required** | PR #191 is the canonical full UI candidate and contains PR #175's head. Do not merge #175 separately. #191 has 17/19 green; release evidence reports 13,449 additions against the 8,500 cap, and the aggregate gate is consequentially red. Rebase after data/contract reconciliation, preserve the two-reviewer rule for its shared status change, rerun U2 regression, Flutter tests/analyze, and physical-Android traversal. |
| O28 accessibility/plain-language provenance | **built** in part; remainder **deferred** | UI work adds substantial semantics, but raw edge IDs and complete ordinary-user provenance language still require review. Do not mark O28 complete from the reskin alone. |
| O29 release promotion | **deferred** | No hosted writes, deployment, immutable release promotion, or general provider authorization. |
| Model training | **separate and non-serving** | Historical model-training bundles are present on the branch through merged PRs #158/#160/#165/#169. Do not train, serve, modify, or make Run 4 depend on them. |

## Fresh GitHub PR ledger

| PR | Topic | State at refresh | Checks / action |
|---:|---|---|---|
| #161 | U0 release gate | merged | 19/19 green; ancestor of integration. |
| #170 | U1 original | open draft, clean | 21/21 green, but superseded in substance by stacked remediation #180. |
| #172 | per-unit gate-base convention | merged | 19/19 green; issue #171 is unexpectedly still open and needs issue-state reconciliation. |
| #175 | UI predecessor | open, clean | 19/19 green; contained by #191, so do not land both. |
| #176 | U5 paper authoring | open draft, unstable | 17/19; release evidence rejects mismatched synthetic-merge parents; aggregate gate consequently fails. |
| #177 | U2 authorization | merged | 19/19 green; current integration tip at refresh. |
| #180 | U1 security remediation | open draft, unstable | 18/21; five history secret findings plus 14,131 additions > 8,500; aggregate gate consequently fails. |
| #184 | U3 atomic loader | open draft, unstable | 17/19; 15,001 additions > 8,500; aggregate gate consequently fails. |
| #185 | U2 replacement-key correction | open draft, unstable | 17/19; runtime-attestation config/lock hash mismatch; aggregate gate consequently fails. |
| #186 | U2 audit-truth correction | open draft, unstable | 17/19; 8,565 additions > 8,500; aggregate gate consequently fails. |
| #190 | provider-E2E evidence | open draft, unstable | 17/19; stacked on #176; 8,840 additions > 8,500; aggregate gate consequently fails. |
| #191 | canonical full UI | open, unstable | 17/19; contains #175; 13,449 additions > 8,500; aggregate gate consequently fails. |

No PR newer than #191 existed at the refresh. Fetch again at every resume.

## Required reconciliation order

1. **Refresh before writing.** Fast-forward the clean VS Code checkout, fetch GitHub PR/check state,
   verify current ancestry, and update this snapshot if it changed.
2. **Reconcile the landing gate.** Advance `RUN4_UNIT_BASE_SHA` to the exact accepted current unit base,
   update CI in lockstep, regenerate deploy attestation, and prove the gate still fails closed. Close or
   correctly resolve issue #171. Do not reinterpret cumulative integration history as one unit.
3. **Close U1 safely.** Treat #180 as remediation over #170. Fix its secret-scan failure, rebase the
   combined branch, independently re-review bypass cases, and leave one canonical green PR.
4. **Close U2 corrections.** Combine #185 and #186 from the current integration tip, resolve overlap,
   rerun 443/443 plus nao/internal-auth tests, and integrate only the reconciled result.
5. **Rebase the unit base again after integration advances**, then finish U3 #184 including its HTTP/UI
   loader gap and the real 14 + 7-day local walk.
6. **Implement U4.** P2 is no longer blocked: Alton and Jayden are named reviewers. Preserve deterministic
   scientific gates and shared TS/Dart parity; do not make an INTERIM result servable.
7. **Finish U5 and provider evidence.** Rebase #176 after U3/U4, then integrate the accurate #190 evidence.
   Do not claim full-paper LLM coverage or sentence provenance until those paths actually exist.
8. **Integrate the full UI from #191 only.** Reconcile against final data shapes and U4 provenance;
   close/supersede #175 rather than landing both; verify on the connected physical Android device.
9. **Run the complete suite and both local exit passes.** API integrity must be green. The real-paper
   pass may honestly yield a held edge with one paper; separately prove card serving with a fixed verified
   edge and matched health data unless independent corroboration is added.
10. **Stop before cloud promotion.** Hosted Supabase, deployment, model promotion, and production claims
    remain outside Run 4 authorization.

## Local provider and end-to-end evidence already obtained

- Complete canonical paper extraction: 91,162 characters.
- Normal OpenAI synthesis prompt: 12 selected evidence passages, not the entire text.
- Anthropic official role: verifier only; result `uncertain` with zero independent sources.
- Locally reconstructed spend including superseded attempts: OpenAI about SGD 0.0648; Anthropic about
  SGD 0.1340. Provider billing is authoritative.
- Fixed-edge local harness: 20/20.
- Health data: 21 simulated days of gut, mood, energy, hydration, stool, sleep, HRV, resting heart rate,
  steps, SpO2, temperature, bloating, and standing-water context.
- Rendered outputs on physical Android: four rule cards plus sleep/HRV and sleep/resting-HR research cards.
- This evidence lives on PR #190 until reconciled and merged; it is not yet part of the integration branch.

## Resume command

The human may start a new session with:

`run docs\temp\run4\orchestrator-prompt.md`

That instruction is explicit authorization to resume the local Run 4 workflow within the recorded
constraints. The orchestrator prompt routes all other files and starts from this status rather than
re-running the original preflight or rebuilding merged units.
