---
title: Phase-2 Run 3.0 decisions and sign-off record
summary: Append-only record of non-trivial implementation decisions and human sign-off state for the locked Run 3 tranche.
type: plan
scope: shared
status: canonical
updated: 2026-07-27
---

# Phase-2 Run 3.0 decisions and sign-off record

## D1 — O24 Deno reproducibility boundary (2026-07-27)

- Pin GitHub CI to official Deno `v2.8.1`, the runtime used to generate and verify the shared
  `supabase/deno.lock`.
- Configure each of the four Edge Function `deno.json` files to consume that one frozen lock. This
  retains their local import maps while preventing fresh JSR resolution in the release gate.
- This implements the locked O24 reproducibility requirement; it does not change function behaviour
  or deployment configuration.

## D2 — O24 exact-SHA evidence semantics (2026-07-27)

- A pull-request run's immutable synthetic merge commit is valid exact cumulative evidence when the
  context job proves `git rev-parse HEAD == GITHUB_SHA` and the merge parents are the base and PR head.
- The run's head association and its checked synthetic merge SHA are recorded distinctly in the final
  PR evidence comment. A direct dispatch of the branch head is not required for this O24 acceptance.

## Sign-off state

Human acceptance and merge are pending for every Run 3 unit.
