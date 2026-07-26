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

## Sign-off state

Human acceptance and merge are pending for every Run 3 unit.
