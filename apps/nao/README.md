# ourobion nao

The web **window into the brain**. It now covers the paper corpus, relationship claims and human
review, ingestion seeds/gaps, loader and pipeline controls, and model/spend status. It is built for
OpenNext on Cloudflare Workers, but a production deployment and production-grade role/RLS boundary
are **not yet proven**; do not read the presence of routes as deployment evidence.

**Stack:** Next.js (App Router) → **OpenNext on Cloudflare Workers**; **R2** (native binding) for
per-paper metadata; **Cloudflare D1 + FTS5** as a derived search index; **Supabase Auth** (edge-verified
JWT) as the access gate. Design tokens: dark "bio-neo-mythical" theme from the **Ourobion Nao identity
kit** (`assets/ourobion-nao-logo/`) — Outfit + JetBrains Mono, and **dark is primary** (nao has no light
mode; the kit's light palette is only for white/pale surfaces).

> Cross-platform: macOS, Linux, and Windows all work — nao needs only **Node + npm**. The repo's
> Windows `scripts/biotope-env.ps1` toolchain is for the *biotope* Flutter app and is **not** required
> here.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **≥ 26** | nao pins `engines.node >=26` (newer than biotope's Node 18+). Use `nvm` or Homebrew. |
| npm | bundled with Node | |
| The selected environment's Supabase project | — | Shared identity/data plane with biotope: URL + anon (publishable) key; at least one user (no public sign-up). |
| R2 S3 credentials | — | Only for the local/CI **ETL** that builds the D1 index. The running Worker uses the native R2 binding (no creds). |

On macOS, get Node ≥26 with **nvm** (recommended for an exact version):

```bash
# https://github.com/nvm-sh/nvm
nvm install 26 && nvm use 26
node -v   # v26.x
# — or Homebrew: brew install node   (ensure it resolves to >= 26)
```

> **Windows:** nao has no PowerShell dependency, but Node must be on PATH. Either install Node ≥26
> globally, or reuse the bounded toolchain: `. .\scripts\biotope-env.ps1` in each shell.

---

## One-time setup

From `apps/nao/`:

```bash
# 1. Secrets / config — copy the examples, then fill them in.
cp .env.public.example .env.public   # NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
cp .env.example        .env          # R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET (ETL only)

# 2. Install deps
npm install
```

`.env.public` (client-visible `NEXT_PUBLIC_*`) and `.env` (server-only secrets) are the only two files
you edit. `npm run gen-env` (run automatically by `predev`/`prebuild`) projects them into the
gitignored `.env.local` (Next.js) and `.dev.vars` (wrangler/OpenNext); never edit those by hand.

## Production build and Worker runtime contract

The production path has four deliberately separate configuration surfaces:

| Surface | Names | Contract |
|---|---|---|
| Next build-time public values | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_ENV` | Set before `next build`; Next may inline them into client assets. They are public by design. |
| Worker runtime values | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OUROBION_INTERNAL_SECRET`, `GH_ACTIONS_TOKEN` | Declared by name under `secrets.required` in `wrangler.jsonc`; values are never committed. The publishable key is low privilege, but only the server relay consumes this runtime copy. |
| Ordinary Worker vars | `GH_REPO`, `GH_ACTIONS_REF=dev-phase2-run4` | Non-secret routing configuration committed under `vars` in `wrangler.jsonc`. |
| Native Worker bindings | `CORPUS` (R2), `DB` (D1) | Resource bindings configured in `wrangler.jsonc`; they are not environment variables or S3 credentials. |

Nao's reviewed `compatibility_date` remains `2024-12-01`. That predates Cloudflare's automatic
`process.env` population date, so `wrangler.jsonc` explicitly pairs `nodejs_compat` with
`nodejs_compat_populate_process_env`; otherwise the declared text bindings would not reach the
`process.env` reads used by the server routes.

`SUPABASE_SERVICE_ROLE_KEY` is not part of nao's build or runtime contract. The run-pipeline relay
uses the publishable key only as transport metadata and `OUROBION_INTERNAL_SECRET` as its distinct
authorization input. `apps/nao/.env.example` feeds local `.dev.vars`; in that local projection only,
`scripts/gen-env.mjs` mirrors public `NEXT_PUBLIC_SUPABASE_URL` to the server name `SUPABASE_URL`.

`next.config.mjs` pins `outputFileTracingRoot` to `apps/nao` via `import.meta.dirname`. The contract
test guards that exact trace root and the complete Wrangler binding/name split. A successful local
build proves local artifact construction only: dashboard value delivery, the deployed Worker, hosted
Supabase access, and any hosted write remain unproven.

---

## Run locally

```bash
# 3. Build the local D1 search index (derived, rebuildable from the R2 manifest):
npx wrangler d1 execute ourobion-nao-index --local --file=src/db/schema.sql   # apply schema
npm run etl                                                                   # load corpus from R2 → local D1

# 4. Start the dev server (predev runs gen-env automatically):
npm run dev          # → http://localhost:3000
```

### What you'll see
- `/` redirects to **`/login`** — the app is auth-gated. Sign in with a user from your nao Supabase
  project (**Dashboard → Authentication → Add user**; there is no public sign-up).
- After login: **Overview**, **Papers**, **Claims**, **Ingest**, **Loader**, and **Models** expose the
  implemented read/control surfaces. Availability depends on the matching D1, R2, Supabase schema,
  role, and server-secret setup; fixture/demo state must remain visibly distinguishable from live data.
- **Paper detail** (`/paper/[uid]`) reads the **R2 binding**, which is empty under the local `next dev`
  simulator → detail pages 404 locally. To exercise them, run against the real bucket with
  `npx wrangler dev --remote`, or use a deployed environment.

### Rebuild the index later (when the corpus changes)
The schema uses `CREATE TABLE IF NOT EXISTS`, so to pick up schema changes drop first:

```bash
npx wrangler d1 execute ourobion-nao-index --local --command "DROP TABLE IF EXISTS papers; DROP TABLE IF EXISTS papers_fts;"
npx wrangler d1 execute ourobion-nao-index --local --file=src/db/schema.sql
npm run etl
```

---

## Verify

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run build        # next build
npx --no-install opennextjs-cloudflare build  # fresh Next build + local Worker bundle
npm test             # complete nao node:test suite
```

For build evidence, inspect `.next/static` for the absence of synthetic server-only canaries and
record `.open-next/worker.js` and full `.open-next` tree bytes plus adapter warnings exactly as
observed. These are measurements, not a release threshold. Remove `.next`, `.open-next`, `.wrangler`,
and generated `.env.local` / `.dev.vars` residue when the evidence run ends.

---

## Brand assets

`apps/nao/public/brand/` holds every brand file the app serves: `nao-mark-dark.svg` / `-light.svg`,
`nao-lockup-dark.svg` / `-light.svg`, and the favicon set (`nao-favicon.svg`, `nao-favicon-16.png`,
`nao-favicon-32.png`, `nao-apple-touch-icon-180.png`). These are **copied from
[`assets/ourobion-nao-logo/`](../../assets/ourobion-nao-logo/)** — the Nao identity kit and this app's
brand source of truth — and must **never be redrawn or hand-edited** in place. If the kit changes,
re-copy the files; don't patch the copies. `apps/nao/tests/brand.test.ts` enforces byte-equality with
the kit, so an in-place edit fails the suite.

Favicons are wired through `metadata.icons` in `src/app/layout.tsx`, and `src/app/` deliberately holds
**no** `icon.*` / `apple-icon.*` files: in Next 15 an explicit `metadata.icons` completely overrides the
file-convention icons, so a file left there would look load-bearing while contributing nothing to
`<head>`. One mechanism, one place.

Where each asset is used: the **mark** at a fixed 40 px in the top bar (the kit's legibility floor), the
full **vertical lockup** on the login canvas, and the simplified glyph as the favicon. The `-light`
variants are bundled for white/pale surfaces and are intentionally unused by this dark-primary UI.

---

## Deploy (Cloudflare Workers, outline)

1. `npx wrangler login`.
2. `npx wrangler d1 create ourobion-nao-index` → put the returned `database_id` in `wrangler.jsonc`.
3. Apply schema + build the **remote** index: `... d1 execute ourobion-nao-index --remote --file=src/db/schema.sql` then `npm run etl -- --remote`.
4. Build via OpenNext, then deploy and bind the route (`nao.ourobion.com`). Before deployment, supply
   the four required Worker runtime values named above; `GH_REPO` / `GH_ACTIONS_REF` and `CORPUS` /
   `DB` come from `wrangler.jsonc`.

This section is an operator outline, not evidence that those hosted steps were executed. Issue #227's
authorized verification stops at local build, bundle inspection, and config/type validation.

See [`docs/nao/nao-app-design.md`](../../docs/nao/nao-app-design.md) for the full design + rationale.
**Doc map (start here):** [`docs/INDEX.md`](../../docs/INDEX.md).
