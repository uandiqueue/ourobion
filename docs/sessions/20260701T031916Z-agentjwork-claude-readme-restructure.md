# Session 20260701T031916Z — agentjwork — claude — readme-restructure

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-phase2 (direct, user-authorized) · **Issue:** —
- **Type:** Docs. Restructure the READMEs so setup lives per-app and the root is a human-facing showcase/pointer.

## Attempted
Split documentation by audience: app-specific launch/setup instructions → each app's README; root
`README.md` → product showcase + the **human** front door (mirroring `AGENTS.md` as the **agent** front door).

## Changed
- **`README.md`** (root) — rewritten as product showcase (One Health monitor; the biotope + nao
  surfaces; the brain) + a **human pointer** table (run each app, product/architecture/repo/UI design,
  the brain, insights/metrics, shared contracts, decisions & rationale, dev workflow) + an **AI-agent**
  pointer to `AGENTS.md`, with the split stated explicitly (humans ← decisions/rationale/how-to-run;
  agents ← how-to-build/principles). Condensed the context-engineering rationale + graphify to a
  pointer. **Removed** all setup/toolchain/Android/troubleshooting/deploy-model content.
- **`apps/biotope/README.md`** — expanded from a stub into the biotope how-to-run home: prerequisites,
  Linux/macOS/Windows setup, bounded toolchain, local Supabase, Android (physical + emulator),
  troubleshooting, and the "where dependencies live" deploy model (moved out of the root README). Fixed
  the stale env path `src/.env.public` → `apps/biotope/.env.public` (verified against the actual layout).
- **`apps/nao/README.md`** (added earlier this session) — the nao how-to-run home: Node ≥26, env files,
  local D1 (`--local`, no Cloudflare account) + ETL, `npm run dev`, auth/R2 caveats, deploy outline.
- Verified every root-README link resolves.

## Decided
- **Doc audience split:** setup/launch (fill `.env`, toolchain, run) lives in **app-specific** READMEs;
  the **root README is a human showcase + pointer**, the counterpart to `AGENTS.md` (the agent pointer).
- **nao local dev needs no Cloudflare account:** `wrangler d1 execute --local` is an offline SQLite
  file; the only credential a nao developer needs is a (read-only) **R2 token** for the corpus. An
  account-scoped `CLOUDFLARE_API_TOKEN` is only for remote D1 / deploy (operator/CI), placed in the
  shell env or CI secret — never in `apps/nao/.env` (which `gen-env` mirrors into the Worker's `.dev.vars`).

## Left
- Root `README.md` still describes graphify install via the setup scripts — fine; full detail already
  in `docs/graph/README.md`.
- nao deploy: create the real cloud D1 + set `database_id`, `etl --remote`, set the Worker `SUPABASE_URL`
  var/secret, bind `nao.ourobion.com` (tracked in the nao README + prior session's "Left").

## Blockers
- None.
