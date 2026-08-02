---
id: "0021"
title: Nao membership is not health-data authority
summary: Biotope and Nao share Supabase identity, but an effective nao_members row is required for Nao; viewer, curator, and admin are Nao capability tiers and never grant cross-user personal-health access.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:00:58Z
---

# Nao membership is not health-data authority

Biotope and Nao use one Supabase Auth pool but have different authorization scopes:

- an authenticated account without an effective `nao_members` row is Biotope-only;
- an active, non-revoked membership grants Nao scope;
- `viewer < curator < admin` are capabilities inside Nao, not separate identities;
- membership and role are read from the database for the current caller, not trusted from a client or
  JWT role claim;
- no Nao tier widens `auth.uid() = user_id` access to another person's health observations, profile,
  wearable rows, or insight cards.

Membership provisioning is privileged and has no self-promotion path. Suspension and revocation must
take effect without waiting for a token refresh. Route checks are defence in depth; database RLS,
grants, and authorization functions remain authoritative. The executable contract starts in
[`20260728010000_nao_staff_roles.sql`](../../supabase/migrations/20260728010000_nao_staff_roles.sql)
and its later additive migrations/tests.
