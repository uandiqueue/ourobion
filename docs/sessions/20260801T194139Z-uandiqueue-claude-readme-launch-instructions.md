---
title: README launch instructions for biotope and nao, with the shared demo credentials
summary: The README pointed at per-app READMEs but never said how to reach either surface, and still called nao's deployment pending when nao.ourobion.com answers 200. Added a Launch it section (nao is a URL; biotope builds from source with the backend choice spelled out) and a viewer section carrying the shared test account, with the biotope write risk made explicit rather than left to a plea not to abuse it.
type: session
scope: repo
status: canonical
updated: 2026-08-01
---

# README launch instructions for biotope and nao

Branch `docs/readme/launch-instructions`, cut from `main` @ `5a5af7c`. Scope deliberately narrow:
**README.md only**. Requested so a teammate has unambiguous instructions for reaching both surfaces
to film the demo.

## Changed

- **New `## 🚀 Launch it`** — nao as a live URL needing no install; biotope built from source, with
  the toolchain entry points (`setup.ps1` → `biotope-env.ps1` → `flutter run`) and a table making the
  backend choice explicit: the hosted demo project `bewwvcksgpxoomyjavjp` for the seeded account, or
  a local stack (`10.0.2.2:54321` emulator / LAN IP for a physical phone) for development. Detail
  stays delegated to `apps/biotope/README.md` rather than being duplicated.
- **New `## 👀 Trying it as a viewer`** — recommends making your own account first, then gives the
  shared `test@ourobion.com` credentials as the alternative for seeing populated history.
- **Surfaces table corrected** — nao's cell said "production deployment evidence is still pending".
  `curl -o /dev/null -w '%{http_code}' https://nao.ourobion.com/` returns **200**, so that was stale
  and now reads as live.
- **Navigation table** gained a row pointing at the two new sections.

## Decided

- **The write risk is stated, not implied.** The shared account is view-only in nao but can *write*
  in biotope. The instruction as given was "please don't abuse biotope", which only binds
  well-intentioned readers. The README instead steers viewers to create their own account, and warns
  that anything logged against the shared one is visible to and spoilable by everyone else. Being
  vague here would have made a shared-state surprise more likely, not less.
- **The anon key was not pasted in.** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are client-facing by the
  repo's own convention (`.env.public.example` lists both as safe), but `.env.public` is gitignored,
  so committing the key would be a new publishing decision belonging to the owner — and a Supabase
  anon key is a JWT, which the gitleaks gate has a rule for. The README names the project ref and
  points at `.env.public.example` instead.
- **Repo is public, so the credential is permanent.** `test123` in a public README enters git history
  irreversibly and is readable by anyone, not only judges. Recorded as a deliberate owner decision for
  hackathon access; the account should be treated as burnable and rotated after judging.
- **Unrelated working-tree state left alone** — a deleted `apps/biotope/assets/images/logo.png` and an
  untracked `docs/ourobion_identity.md` were present and are not part of this change; only `README.md`
  was staged.

memory: none — this is a documentation-access change and introduces no durable architectural fact.
The one durable operational note (the shared demo account is writable in biotope and should be
rotated after judging) lives in the README itself, where the people affected by it will actually
read it.

## Verification

- `node tools/context_sync.mjs --check` — passed.
- `https://nao.ourobion.com/` — HTTP 200.
- `git diff --cached --name-only` — `README.md` only.
