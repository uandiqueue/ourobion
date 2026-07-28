---
title: "Run 4 U2 replacement-key and executable-auth correction"
summary: "Corrected opaque Supabase replacement-key resolution and apikey-only engine transport, added the superseding cron migration and a local staff operator path."
type: session
scope: shared
status: canonical
updated: 2026-07-27
---

# Run 4 U2 replacement-key and executable-auth correction

Issue: #181
Branch: `fix/auth/run4-u2-correctness`

## Attempted

- Audited the inherited U2 internal-secret implementation against Supabase's replacement-key and Edge Function auth guidance, with particular attention to opaque `sb_publishable_*` / `sb_secret_*` keys.
- Applied the adversarial follow-up: treated legacy compatibility, local operator containment, and executable outbound-header evidence as correctness boundaries rather than documentation claims.
- Kept the existing dedicated internal-secret verifier as the first authoritative Edge Function gate and did not start, reset, or mutate the local Supabase stack.

## Changed

- Added deterministic named/singular replacement-key resolution with kind-specific prefix validation. Legacy keys now require both an explicit compatibility option and an exact local CLI origin (`http`, loopback/localhost, port 54321, with no user-info, path, query, or fragment); malformed or mixed-kind configuration fails closed.
- Sent publishable keys only on `apikey`, resolved replacement secret keys only for privileged database clients, and disabled platform JWT verification only for the four internal-secret-gated engine functions.
- Added an append-only migration that supersedes the prior cron registrations with `app.supabase_publishable_key`, no `Authorization` header, and the internal-secret header.
- Added behavioral fetch-capture tests over Nao's extracted production relay and run-pipeline's production request helper; both prove `apikey` plus internal secret and the absence of `Authorization`.
- Replaced the local Nao staff operator with an exact-container `docker exec` path using separated arguments, and added source and non-executing PowerShell parse guards.
- Guarded the demo's remaining legacy service-role bearer as a strict-local GoTrue Auth-admin bootstrap only, explicitly excluding Edge Function transport.

## Decided

- The prior applied cron migrations remain untouched; the later schedule migration replaces their job definitions by the stable job names.
- A missing or malformed key configuration is visible only after internal-secret authorization, avoiding an anonymous configuration oracle.

## Left

- Hosted key creation, secret provisioning, cron setting changes, deployment, and live-stack proof remain deliberately unperformed.
- Full Nao typecheck is pending a dependency install in this isolated worktree; no install was attempted.
- Focused verification passed: 52 Edge/shared tests, 88 Nao auth/relay/key tests, both changed PowerShell scripts parsed, `context_sync --check` and `git diff --check` passed.

## Blockers

- The project toolchain has no Deno executable, so frozen Deno checks could not run locally.
- `supabase/deploy-attestation.json` is intentionally stale after the function config/source changes. It remains an explicit release blocker and must not be regenerated without a real local `functions serve` proof.

memory: none
