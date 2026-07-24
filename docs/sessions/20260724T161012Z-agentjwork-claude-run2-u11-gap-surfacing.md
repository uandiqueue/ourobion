---
title: "Run-2 U11 — knowledge-gap surfacing in nao (O9 demo slice / feature d)"
summary: "A 'Knowledge gaps' section on /ingest reads the A1 gap_ledger's aggregate rows (demand-ranked, plain-language §A1 status labels, lit_candidate context) and bridges each gap to the O14 seed form via a human-only 'Add as seed' prefill; detection+surfacing only — the autonomous gap→research loop stays B5+U16-gated."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run-2 U11 — gap surfacing in nao (O9 demo slice / feature (d))

Branch `feat/phase2-run-2/u11-gap-surfacing` off `feat/phase2-run-2/u10-seeds-as-data`
(stacked chain off origin/dev-phase2). SMALL unit: detection + the ledger shipped in U4;
this adds the nao READ surface only.

## What was built

- **`apps/nao/src/lib/gapsControl.ts`** — pure helpers (convention: route/components are IO
  glue over unit-tested functions): the eight §A1 statuses with plain-language labels
  (research-coverage descriptions, deliberately zero diagnostic/medical language; unknown
  statuses fall back to the raw string), metric-key humanization (`hrv_sdnn_ms` → "HRV SDNN
  ms"), `deriveGapSeedLabel` for the seed bridge, `describeGapContext` (edge presence/band,
  O16 `orientation`, completeness from `lit_candidate` jsonb), demand-DESC sort with a
  deterministic pair tie-break, `GAPS_PAGE_SIZE = 50`.
- **`GET /api/gaps`** (`src/app/(app)/api/gaps/route.ts`) — authenticated cookie-bound read of
  `gap_ledger` aggregate rows; the migration's RLS SELECT policy (`scope = 'aggregate'`,
  authenticated) is re-asserted as an explicit filter; `count: 'exact'` so the UI can say
  "showing top N of M" honestly. READ-ONLY: no write surface exists (A3 queue / dispatch /
  auto-research stay B5+U16-gated).
- **`GapsPanel.tsx`** — the /ingest "Knowledge gaps" table: metric pair, status label, demand,
  last change, context; per-row **"Add as seed"** button (human-in-the-loop bridge only).
- **`GapsAndSeeds.tsx`** + `SeedsPanel` prefill prop — a thin client wrapper holding the one
  piece of shared state: the clicked gap's derived label lands in the seed form (scrolled into
  view + focused), for the human to review/submit through the existing O14 POST path.
- `ingest/page.tsx` renders the wrapper; gaps styles appended to `ingest.css` (reuses the
  panel/table system); `tests/gapsControl.test.ts` (11 node:test cases, incl. a
  no-diagnostic-language regex over every status label).

No migrations, no supabase/functions, no apps/biotope, no tools/ changes.

## Live proof (local stack, actual outputs)

Stack already up; `gap_ledger` was EMPTY (fresh DB from U10's reset), so the U6 flow was
re-driven: rules loaded via the sanctioned loader (`SUPABASE_DB_URL=… node
tools/rules/load_rules.mjs` → "upserted 8 rule(s)"), demo user created via the auth admin API
(`u11-demo@ourobion.local` → uid `58833bc2-4946-4f72-8c72-7543f1b44e54`), nao `npm run dev -p
3011`, routes driven with the password-grant session projected into the `sb-127-auth-token`
cookie (U6/U9/U10's proven approach). Zero LLM spend.

**Gap-row source (loader → pipeline as the authed user):**
- `POST /api/loader` → 200, 14 days (`2026-07-11 → 2026-07-24`, scenario recent-dip); run #1
  `gapLedger:{pairsTouched:0}` (S4 suppressed, insufficient baseline — honest).
- `POST /api/loader` again → 200, +7 backfill (21 days); pipeline run #2 → `generate-insights
  … firedPatterns:11 … gapLedger:{pairsTouched:110, demandByStatus:{"personal-null":110}}`.
- Pipeline run #3 → same 110 pairs; ledger demand incremented to 2 (aggregate upsert proven).
- (One local-stack wrinkle: the first loader call hit PostgREST "JWT issued at future" —
  sub-second issuer/verifier clock skew; a 2 s pause after password-grant fixes it. Noted for
  future proof scripts; not a code issue.)

**(a) Authenticated gaps read:** `GET /api/gaps` → 200,
`totalCount=110 pageSize=50 returned=50`, rows demand-DESC, e.g.
`body temp c × energy score | Pair evaluated — no strong personal pattern, no research edge |
demand=2 | 2026-07-24T16:07:59+00:00 | ctx=no edge in read store · completeness 0.75 |
seed="body temp c and energy score"`.

**(b) Page render:** authed `GET /ingest` → 200 (21 470 bytes); HTML contains "Knowledge
gaps", "gap ledger", "Seeds", "Ingestion control".

**(c) Prefill click-path (real browser — headless Chrome over raw CDP):** cookie planted,
`/ingest` loaded, 50 gap rows rendered; label input BEFORE = `""`; clicked "Add as seed" on
`body temp c × energy score` → label input AFTER = `"body temp c and energy score"`, slug
preview `slug: body_temp_c_and_energy_score`, label input focused = true. The human still
reviews + submits through the U10 form.

**(d) RLS / anon denial:** anon `GET /api/gaps` (no cookie) → **307** to
`/login?redirectedFrom=%2Fapi%2Fgaps` (middleware); anon-key PostgREST
`GET /rest/v1/gap_ledger` → **200 `[]`** (no anon policy — RLS returns nothing).

Only `personal-null` appears live: the fresh DB has no `verified_edges`, so the
edge-dependent statuses (`personal-signal-no-edge`, `blocked-completeness`, `needs-review`)
can't occur — the label map covers all 8 §A1 statuses and is unit-pinned.

## Gates

- apps/nao `npm run typecheck` — clean.
- apps/nao `npm test` — **94/94** (baseline 83 + 11 new).
- `npx supabase db reset` — NOT run: no migration added (per brief, avoided).
- Live proof — executed against the real local stack, outputs above.
- `node tools/context_sync.mjs --check` — passed.
- NUL-byte scan of all new/changed files — clean; `git diff --stat` shows no "Bin".

## Decisions made autonomously (for review)

- **Placement/order:** Knowledge gaps renders on /ingest below the Seeds section (feature d:
  "surfaced during ingestion" — the ingest page IS the ingestion surface); "Add as seed"
  scrolls the form into view.
- **Prefill wiring:** shipped (it was trivially cheap) as a thin client wrapper
  (`GapsAndSeeds`) holding a `{label, nonce}` prefill state — nonce so repeated clicks
  re-apply; SeedsPanel gained an optional prop (default behaviour unchanged).
- **Labels:** e.g. `personal-null` → "Pair evaluated — no strong personal pattern, no research
  edge"; `served` → "Served — a verified research edge covers this pair". All 8 mapped;
  unknown → raw string (honest, forward-compatible).
- **Page size 50** with exact-count "Showing the top 50 of 110 gaps by demand" note; order
  demand DESC then pair ASC (deterministic).
- **Context column:** compact join of lit_candidate edge presence/band + orientation +
  completeness (e.g. "no edge in read store · completeness 0.75"); "—" when empty.

## Not verified / carried forward

- Non-`personal-null` statuses not exercised live (need verified_edges; see above) — labels
  covered by unit tests instead.
- The `run-pipeline` relay, loader, and RLS policy themselves were shipped/proven in U4–U6;
  re-exercised here only as the data source.

memory: Run-2 U11 shipped the O9 demo slice — /ingest "Knowledge gaps" table reads gap_ledger aggregate rows via GET /api/gaps (authenticated, demand-DESC, top-50 + exact count), §A1 statuses get plain research-coverage labels, and "Add as seed" prefills the U10 seed form (human-in-the-loop only; the autonomous gap→research loop stays B5+U16-gated). Local-stack gotcha: password-grant JWTs can be rejected as "issued at future" for ~1 s (issuer/verifier sub-second skew) — sleep 2 s after login in proof scripts.
