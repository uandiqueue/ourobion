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

- Do not train anything in Run 4. Do not touch `model-training/` or `docs/temp/model-training/`.
- Historical model-training bundles are already present on `dev-phase2-run4`; they remain separate,
  non-serving, and must not become a runtime dependency.

## External actions not authorized

- Hosted Supabase writes or demo-database promotion.
- Cloudflare/R2 writes, deployment, production traffic, hosting changes, or key rotation/mutation.
- Model promotion or serving.
- Scientific-validation, diagnostic, or production-readiness claims.
- Merge into `dev-phase2` or `main`.

Name-only credentials may be reused only for their approved local task and never recorded:
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables.
