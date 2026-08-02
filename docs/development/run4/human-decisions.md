---
title: Run 4 Human Decisions
summary: Current human authority for Run 4 branch scope, autonomy, reviewers, local resources, provider exception, UI integration, and prohibited external actions.
type: decision-sheet
scope: run4
status: canonical
updated: 2026-07-28
---

# Run 4 Human Decisions

## Branch and autonomy

- `dev-phase2-run4` is the sole Run 4 integration branch. It descends from Run 3 through the recorded
  lineage repair. Never merge Run 4 into `dev-phase2` or `main` from this workflow.
- The branch intentionally has no protection requirement. The machine `Run 4 Gate` is still required
  evidence and must fail closed; unprotected does not mean unchecked.
- Local work may continue without per-step human approval. A reconciled PR may merge into
  `dev-phase2-run4` when the actual current-head checks are all green and independent review is complete.
  Never merge red, duplicate, stale-base, or ambiguous work.
- Keep the primary VS Code checkout fast-forwarded to the latest `dev-phase2-run4` after integration.

## Review and unit decisions

- Jayden and Alton are the named two reviewers for R4-U4 and other Run 4 `shared/` contract changes.
  P2 is therefore satisfied; U4 is startable. Their approval must be recorded on the actual shared PR.
- U0 and U2 are merged. Do not rebuild them; reconcile their tracking and pending corrections.
- U1 must reconcile #170 with its stacked security remediation #180. Do not merge #170 alone.
- U2 corrections #185 and #186 must be combined and conflict-reviewed rather than landed independently.
- U3 #184 is built but not integrated. Preserve its raw-truth and U2 authorization invariants.
- U5 #176 and provider evidence #190 are built but unmerged; sentence-level B-PL22 remains unfinished.
- The canonical full UI candidate is PR #191. It includes PR #175; do not merge both. The full UI should
  replace the current UI except where final system/data shapes require an explicit reconciled adaptation.
- The owner directed that the full UI must not be trimmed merely to fit the original product-unit cap.
  Reconcile that exception transparently in the envelope and machine gate; do not disable the gate.
- U6 metrics are not implicitly admitted by this decision sheet.

## Local environment

- Local Supabase reset is approved for disposable test data.
- The connected physical Android phone may be installed to, launched, and driven for UI/accessibility
  verification. Keep it unlocked/available when a build is running; never touch personal or hosted data.
- Local nao, local Supabase, local Edge Functions, migrations, seeders, and full local harnesses are
  authorized.
- UI work is owned by the canonical UI branch; other units avoid independent redesign and reconcile only
  data-shape/provenance compatibility.

## Provider decision

- Issue #189 was a bounded local exception to the earlier zero-provider-call posture:
  - OpenAI: main paper-synthesis provider, SGD 20 ceiling.
  - Anthropic: verifier only, SGD 2 ceiling; no extra roles.
- The test is complete. It used OpenAI over 12 selected evidence passages after full local extraction,
  and one official Anthropic verifier call. The real edge remained held for zero independent sources.
- Locally reconstructed total including superseded calls: OpenAI about SGD 0.0648; Anthropic about
  SGD 0.1340. Provider billing is authoritative.
- This does not generally unblock O29 or authorize further provider spend. A new live call needs a new
  explicit role/budget decision.
- Full evidence, actual spend, and fail-closed results are recorded in
  [`provider-e2e-status.md`](./provider-e2e-status.md). The checked-in router config was not silently
  changed for this test; it used an isolated in-memory config, and durable reconciliation remains
  pending.

## Model training

- Do not train anything in Run 4. Do not touch `model-training/` or `docs/development/model-training/`.
- Historical model-training bundles are already present on `dev-phase2-run4`; they remain separate,
  non-serving, and must not become a runtime dependency.

## Hackathon MVP demo rehearsal — hosted demo project (2026-07-28)

Jayden directed a hosted demo migration for the one-hour hackathon MVP run, via
[`hack-mvp-prompt-cloud.md`](./hack-mvp-prompt-cloud.md). This is the "separate approval of named
isolated rehearsal resources" that [`pending-build-register.md`](./pending-build-register.md) B-PL19
requires, and it narrowly overrides the standing hosted-writes prohibition below, for this scope only.

- **Named resource, and only this one:** demo project `bewwvcksgpxoomyjavjp`. The clean production
  reserve `jscxvnettbvkboijczav` stays untouched.
- **Approved scope:** apply the repo's append-only migrations; deploy edge functions; set function
  secrets; load the brain serving projection from pinned R2 edge JSONL; seed one demo auth user with
  simulated backdated history; invoke `compute-baselines` then `generate-insights`.
- **Limits that still hold:** no real personal health rows (simulated only, kept flagged as
  simulated); never weaken a cap, gate, test, scanner, RLS policy or assertion to make something work;
  no live LLM/provider calls; `model-training/` untouched; no production-readiness or
  scientific-validation claim.
- **Demo rehearsal, not a release promotion.** It does not close B-PL19 and makes no O29 claim.
  B-PL19's missing pieces — exact migration ledger, explicit release selector, immutable
  namespace/manifest, checksummed promotion, target-load provenance, rollback, cross-environment
  verdict policy — still do not exist.

**Executed 2026-07-28, and the approval is now spent.** A first attempt from host `UaNdIQueue` was
blocked by a network-level block on the Postgres wire protocol and wrote nothing. A later attempt the
same day, from a host where that block was absent, ran end to end: 30 of 30 migrations, 26 base
tables, 2 views, 4 app RPCs, 4 edge functions, the internal secret, demo auth user
`demo@ourobion.com`, 8 rules, and 21 simulated days with derived baselines and one insight card.

Two things stayed within scope but are worth reading before anyone treats this project as complete:
the brain serving projection was **not** loaded (`relationship_claims` / `edge_verifications` are
still 0 rows), and the rules loader ran with `sslmode=no-verify` because Supabase's published CA URL
404s. No repo gate, cap, policy or assertion was weakened. Full measured before/after state,
decisions and traps are in
[`20260728T091140Z-…-hack-mvp-hosted-demo-executed.md`](../../sessions/20260728T091140Z-uandiqueue-claude-hack-mvp-hosted-demo-executed.md);
the portable procedure is [`hosted-demo-migration-runbook.md`](./hosted-demo-migration-runbook.md).

## External actions not authorized

- Hosted Supabase writes or demo-database promotion — **except** the narrowly scoped, named hackathon
  demo rehearsal on `bewwvcksgpxoomyjavjp` recorded in the section above, which is now executed and
  spent; it does not authorize any further hosted write.
- Cloudflare/R2 writes, deployment, production traffic, hosting changes, or key rotation/mutation.
- Model promotion or serving.
- Scientific-validation, diagnostic, or production-readiness claims.
- Merge into `dev-phase2` or `main`.

Name-only credentials may be reused only for their approved local task and never recorded:
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables.
