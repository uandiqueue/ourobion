---
title: "Run 4 U2 follow-up — truthful control-audit lifecycles"
summary: "Replaced write-then-best-effort audit rows with operation-scoped attempted/succeeded/failed lifecycles, atomic database mutations, explicit external-effect reconciliation, and fail-closed audit errors."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U2 follow-up — truthful control-audit lifecycles

Issue #182. Exact base `ad8ef178053c7e6514283f19ee7a4f3f0829dc0c`; branch
`fix/auth/run4-u2-audit-truth` in the assigned isolated worktree.

## Attempted

Make every Nao control mutation tell the truth about ordering and outcome: a durable attempt before
an effect, a terminal success only after it, an explicit failure after a rejected effect, and a
stable operation id for safe retry/reconciliation. Preserve the existing cookie-bound actor and RLS
boundary, redact audit content, and do not touch hosted/provider state or Run 4 authority documents.

## Changed

- Added `operation_id`, `phase`, and `error_code` to `nao_control_events`. Pre-existing rows are
  honestly backfilled as `legacy_unverified`; uniqueness constraints allow one attempt and at most
  one terminal outcome per actor/operation.
- Added two explicit `SECURITY INVOKER` functions. `nao_record_control_event` is an idempotent append
  primitive for external effects. `nao_apply_control_mutation` is a closed, short transaction for
  seed add/toggle, claim rejection, and model-cap upsert: attempt, mutation, and outcome commit
  together, and an audit failure aborts the mutation.
- Added the RLS-preserving `nao_unresolved_control_operations` view as the reconciliation queue for
  durable attempts whose external-effect outcome could not be stored.
- Added `controlAudit.ts` with the stable `X-Ourobion-Operation-Id` contract, typed opaque failures,
  attempt-before-effect orchestration, and deterministic unit seams. Updated the database-backed and
  external-effect routes to use the appropriate lifecycle boundary and return the operation id.
- Extended source-conformance, redaction, pure lifecycle, static migration, and Postgres authz
  assertions. A reviewer-found privilege regression is pinned by executable SQL calls through all
  four transactional branches while the acting role is proven unable to select `created_by` /
  `updated_by`; response-loss tests prove ambiguous external outcomes remain unresolved. The final
  full Nao suite passed 220/220, the focused audit/authz/redaction/GitHub suite passed 94/94, and
  `tsc --noEmit --incremental false` passed.

## Decided

- Database mutations use one caller-privileged transaction. This is the only way an audit terminal
  event can be inseparable from the durable mutation without elevating past the actor's grants/RLS.
- R2, GitHub Actions, and edge-function calls cannot share a Postgres transaction. Their protocol is
  therefore durable attempt → external effect → terminal outcome. Failure to store the terminal
  event returns a typed 503 containing the operation id and deliberately leaves an unresolved row;
  it never lies that the effect failed or invites an unsafe blind retry.
- Existing single-row events are not reinterpreted as successful. Their evidence is insufficient,
  so `legacy_unverified` is the only honest migration value.
- `failed` is reserved for an authoritative rejection. A transport exception can mean the remote
  effect committed before its response was lost, so it writes no terminal event and returns the
  distinct opaque `control_outcome_unknown` 503 with the operation id. Raw provider, network,
  database, identity, and secret text is not relayed.
- Column redaction remains least-privilege. The transactional RPC constructs `RETURNING` JSON only
  from explicitly granted public columns; it does not restore identity-column SELECT and does not
  elevate to `SECURITY DEFINER`. Both new RPCs explicitly revoke Supabase default execution from
  `PUBLIC`, `anon`, and `service_role`, then grant only `authenticated`; the SQL harness pins that
  exact privilege map.
- Audit and business truth use different transforms. Audit `detail` is redacted then storage-safe;
  mutation `target` and `payload` are storage-safe only, so legitimate emails, UUID references, and
  deny-key-shaped business fields are not silently rewritten before persistence.
- An error, malformed payload, or thrown response-loss from the atomic database RPC is also
  `control_outcome_unknown`, not “not started”: the transaction may have committed before the HTTP
  response disappeared. All four database-backed handlers return the stable operation id for
  reconciliation.
- GitHub dispatch treats only 4xx as authoritative rejection. A 5xx or other unexpected non-204
  status is outcome-unknown because GitHub may have enqueued the workflow before returning the
  error, and `workflow_dispatch` exposes no operation-id lookup to correlate later.

## Left

- Issue #181 owns `POST /api/loader` and its atomic loader write. This unit deliberately did not edit
  `apps/nao/src/app/(app)/api/loader/route.ts` or loader SQL. The temporary compatibility overload of
  `recordControlEvent(action, target, detail)` records only an unresolved `attempted` phase, never a
  false success.
- Required #181 reconciliation, at its owned atomic RPC boundary: resolve/pass the same operation id;
  append `loader.simulate`/`attempted`; refuse a duplicate attempt before either user-row upsert;
  perform both upserts; append `succeeded`, or roll back the mutations and append `failed`; then
  remove the compatibility call/overload. Until that integration is applied, loader attempts are
  explicitly visible in the unresolved-operation view rather than mislabelled successful.
- The Docker/Postgres harness was not run because this task explicitly prohibited starting/resetting
  Docker. Its SQL assertions were added and statically reviewed only; there is no Postgres runtime
  evidence from this session, and the assertions remain pending the next permitted harness run.
- UI callers do not yet send `X-Ourobion-Operation-Id`, and the UI is ownership-frozen in this unit.
  The server returns its generated id on success/error, but an automatic browser retry currently
  generates a new id and therefore cannot deduplicate an outcome-unknown external effect. Full-UI
  reconciliation must generate one UUID before the first request, reuse it for every retry, and
  surface the returned operation id when reconciliation is required.

## Blockers

Integration blocker only: #181 must perform the loader-route reconciliation above when the two units
are combined. This unit's other seven mutating route handlers have complete lifecycle semantics.

memory: none
