---
id: "0011"
title: Local Supabase defaults to email/password auth
summary: The checked-in local Supabase configuration uses immediate email/password auth; OAuth requires real provider credentials and hosted callback configuration, while database reset remains distinct from ordinary stop/start.
type: memory
status: unverified
decided: 2026-07-13
updated: 2026-08-03
---

# Local Supabase defaults to email/password auth

In the checked-in local configuration, email/password signup and sign-in work without an email
confirmation step. Google and Apple OAuth are disabled by default and require real provider
credentials and valid callback URLs; verify them against a properly configured hosted project rather
than assuming local Docker proves OAuth.

Local database state normally survives `supabase stop`/`start`. `supabase db reset` and
`supabase stop --no-backup` are deliberately destructive operations and must not be confused with an
ordinary restart. Recheck `supabase/config.toml` if the local auth policy changes.
