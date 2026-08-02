---
id: "0005"
title: Scheduled internal calls separate routing credentials from authorization
summary: Scheduled calls use a low-privilege project key for gateway routing and a separate rotatable internal secret for authorization; the service-role key must never travel in the request.
type: memory
status: unverified
decided: 2026-07-13
updated: 2026-08-02
---

# Scheduled internal calls separate routing credentials from authorization

A scheduler or internal operator may need to call a Supabase Edge Function, but it must not send the
project's service-role credential. Gateway routing and Ourobion authorization are separate concerns:

- a publishable/anonymous project key permits the request to reach the function;
- a dedicated Ourobion internal secret authorizes the internal operation;
- the function may use its server-side service-role credential for its own database work, but that
  credential never leaves the function environment.

The internal secret is rotatable with current/previous values, with the receiver updated before the
sender. Missing configuration must fail closed before a request is emitted. Exact setting, secret,
and header names belong to the latest migrations and deployment runbook; never copy them from an
older migration. The current replacement is
[`20260728060000_supersede_cron_publishable_apikey.sql`](../../supabase/migrations/20260728060000_supersede_cron_publishable_apikey.sql).
