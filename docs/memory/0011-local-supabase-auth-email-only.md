# Local Supabase auth: email/password works; OAuth needs a hosted project

**Gotcha (local dev).** Auth is Supabase Auth. Against the **local** Docker stack, only
**email/password** works out of the box: `supabase/config.toml` has `enable_signup = true` and
`enable_confirmations = false`, so you can sign up + sign in instantly with no email step. Use that for
local feature work (and it's the account the test-data seeder targets — [[0009-local-test-data-seeding]]).

**OAuth (Google / Apple) is effectively off locally.** `config.toml` ships them disabled
(`[auth.external.apple] enabled = false`, Google likewise). Wiring them to `127.0.0.1` needs real
provider client IDs/secrets + redirect URLs — fiddly, and **Apple Sign In requires the paid Apple
Developer Program** to even create the credential ([[0010-ios-build-needs-mac-and-paid-account]]).
Google OAuth credentials are free but still awkward against localhost.

**How to apply.** Test Google/Apple OAuth against a **hosted** Supabase project (a free-tier cloud
project as staging), not local Docker. Keep local for daily-logging / projection work via email+password.
Note also: local DB state **persists** across `supabase stop`/`start` (it restores from a Docker volume
— you'll see "Starting database from backup…"); it's only lost on `supabase db reset` or
`supabase stop --no-backup`.
