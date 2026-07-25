---
title: "Run-2 U9 — human verdict override (reject supersedes serving) + nao claims curation (O13 / demo feature b)"
summary: "The O13 additive human-verdict layer plus the demo-critical nao curation surface, completed as a SECOND-ATTEMPT unit: the first U9 agent hit a usage limit mid-unit and left uncommitted partial work, which this session audited file-by-file against the brief (verdict: architecture sound; ONE live bug found and fixed — supabase-js .contains() was handed a JS array, which postgrest-js serialises as a Postgres array literal `cs.{[object Object]}` → 500 'invalid input syntax for type json'; citationsContainsValue now returns a JSON string). Migration 20260724150000 adds edge_human_verdicts (append-only audit, action CHECK 'reject' only, created_by forced to auth.uid() by RLS, deliberately NO FK to relationship_claims so the loader's full-rebuild prune can never clobber human truth); 20260724150001 recreates verified_edges with two appended columns (human_verdict/human_verdict_at, latest-row lateral join) and re-creates get_insight_provenance with additive humanVerdict/humanVerdictAt keys — rejected edges stay VISIBLE in provenance (honest history), while generate-insights excludes them null-safely for NEW cards (.or human_verdict.is.null,human_verdict.neq.reject on top of the band gate). nao gets /claims (SubNav tab) + a per-paper 'Claims & verdicts' section on /paper/[uid] (jsonb containment claim->'citations' @> [{paperId}]), both over ClaimsPanel: claim triple, derivation, quoteSpans, citations, latest verifier verdict with the verbatim TEST-MODE stamp, human-verdict status, and the ONE write action REJECT (+optional reason) → /api/claims/reject as the authenticated user. Live proof end-to-end on the real seams: fixture artifacts through the real edge-loader CLI, BEFORE/AFTER serving exclusion demonstrated by the pipeline itself (pre-reject edge card cites the hrv edge; post-reject re-run's new edge card cites the next eligible edge and never re-cites the rejected one), provenance RPC still shows the rejected edge with humanVerdict='reject', and a full loader rebuild does NOT clobber the human verdict. GIN measured and declined: 4 claims, seq scan 0.085 ms. No shared/ changes (no B8). Un-reject/restore carried forward."
type: session
scope: shared
status: canonical
updated: 2026-07-24
memory: "U9 done (2nd attempt): O13 human-verdict layer (edge_human_verdicts, reject-only, no-FK-on-purpose) + verified_edges/provenance overlay + nao /claims curation; postgrest-js .contains() needs a JSON STRING for jsonb containment (array → Postgres array literal bug); no GIN (4 rows, 0.085 ms seq scan)."
---

# Run-2 U9 · Human verdict override + nao claims curation (O13, DEMO-CRITICAL feature b) — second attempt

Branch `feat/phase2-run-2/u9-claims-human-verdict` off `feat/phase2-run-2/u8-model-config-spend`
(chain tip e25ec26). Backlog O13 (locked — executed, not re-opened): ADDITIVE human-verdict layer;
artifacts stay source; override RECORDED, never a silent edit; verifier NOT weakened — reject sits
on top and supersedes FOR SERVING; no human action = the verifier default stands (interim until B5).

## Limit-halt recovery: audit of the predecessor's partial work

The first U9 agent died on a usage limit mid-unit leaving 4 modified + 8 untracked files
uncommitted. Per run protocol nothing was assumed correct: every file was read against the brief,
all couplings were re-verified (TEST_MODE_LABEL verbatim vs `tools/llm-router/src/types.ts:53`;
relationKey pipe-shape vs `shared/brain/index.ts:20`; the overlay view's base column list vs the
S6 original 20260716031048:90-97 and the A16 recreation 20260718051721:54-61 — byte-identical,
human columns appended at the end only; the provenance function body vs the O12 original
20260724085023 — identical except the hv lateral join + two additive keys), a NUL-byte scan of all
12 files came back clean, and every gate + the FULL live proof was redone from scratch.

**Audit verdict:**
- **Kept as-is:** both migrations; ClaimsPanel.tsx; the /claims page; both /api/claims* routes;
  the paper-page section + SubNav tab + CSS; the generate-insights exclusion; both test files
  (edge_human_verdicts.test.ts was already complete, not half-written).
- **Fixed (the one real bug):** `claimsControl.citationsContainsValue()` returned
  `[{ paperId }]` (a JS array). postgrest-js serialises array arguments to `.contains()` as
  Postgres array literals — the live route emitted `claim->citations=cs.{[object Object]}` and
  PostgREST answered **500 "invalid input syntax for type json"**. The predecessor never ran this
  against the live stack. Fix: return `JSON.stringify([{ paperId }])` (a string passes through raw
  as `cs.<json>`); the unit test now pins the string-ness and the parsed shape.
- **Discarded:** nothing.
- **Finished (predecessor was mid-measurement):** the GIN decision — see below.

## What ships

### 1 · Migration `20260724150000_create_o13_edge_human_verdicts.sql`
`edge_human_verdicts` (id identity pk, edge_id text, action CHECK in ('reject'), reason,
created_by uuid not null, created_at default now()). Append-only audit: latest row per edge wins;
no UPDATE/DELETE policies; un-reject/'restore' intentionally NOT modelled this cycle (carried
forward). RLS: authenticated SELECT + INSERT `with check (created_by = auth.uid())` (forged-audit
guard; D3 dev posture); service_role bypasses. Deliberately **NO FK to relationship_claims** —
the loader's full-rebuild prune deletes/re-inserts claim rows and an FK would either cascade-erase
human truth or block the loader; the reject route is the existence guard instead. Table comment
states the two-tier-truth twist verbatim: this table is TRUTH for human decisions — rebuilds must
never clobber it. Index (edge_id, created_at desc, id desc) backs the latest-row lateral join.

### 2 · Migration `20260724150001_o13_verified_edges_human_overlay.sql`
- `verified_edges` recreated (CREATE OR REPLACE, columns appended at the end only):
  `human_verdict` / `human_verdict_at` from the newest edge_human_verdicts row per edge (lateral
  limit-1, `order by created_at desc, id desc`). security_invoker + active-only + newest-per-edge
  semantics unchanged.
- `get_insight_provenance` recreated: each edges[] entry gains additive `humanVerdict` /
  `humanVerdictAt` (LIVE latest verdict, deliberately not pinned to the cited verified_at — a
  human decision made after the card served is exactly what the reader should see). **No filter
  on the human verdict** — the RPC never hides a rejected edge (honest history).

### 3 · Serving exclusion — `supabase/functions/generate-insights/index.ts`
The verified_edges fetch adds `.or("human_verdict.is.null,human_verdict.neq.reject")` on top of
the existing `.in("serving_band", ["high","mid"])` band gate (null-safe: a bare .neq would drop
every un-curated edge). NEW cards can never cite a human-rejected edge; the band gate and the
verifier are untouched.

### 4 · nao curation surface
- `src/lib/claimsControl.ts` — pure helpers (TEST_MODE_LABEL duplicate under a coupling test,
  containment value, claim/verdict merge, reject-body validation with relation-key shape check).
- `src/components/ClaimsPanel.tsx` — claims (triple, derivation, quoteSpans, citations), latest
  verification (verdict/band/score/at + verbatim TEST-MODE stamp), human status ("REJECTED BY
  HUMAN … supersedes the verifier for serving" vs "No human check — the verifier verdict stands"),
  REJECT button + optional reason; post-reject message states the override semantics.
- `/claims` page + SubNav tab; per-paper section on `/paper/[uid]` via `?paper=` containment.
- `/api/claims` (GET, cookie-bound authenticated read of relationship_claims + verified_edges;
  claims without verification stay visible as honestly unverified) and `/api/claims/reject`
  (POST: parse → 401 unauth → 404 unknown edge → INSERT as the user).
- No shared/ changes — **no [B8]**.

### 5 · Tests
- `tools/edge-loader/tests/edge_human_verdicts.test.ts` (6): table shape/CHECK/no-FK/RLS pins,
  overlay view pins (base columns unchanged + appended human columns + lateral join), provenance
  keys + never-hides pin, generate-insights null-safe exclusion pin (cross-language, S6 style).
  Suite **56/56** (baseline 50 + 6).
- `apps/nao/tests/claimsControl.test.ts` (11): TEST_MODE_LABEL coupling, reject-body validation,
  containment string, merge semantics (reject passthrough never hides the verifier verdict).
  Suite **74/74** (baseline 63 + 11).

## Live proof (local stack, actual outputs, all redone this session)

Setup: fresh `npx supabase db reset` (both new migrations applied; auth wiped), demo user
`u9-demo@ourobion.local` → uid `3c34e2ab-e1a0-4f28-aa1f-0285e09279c1` via the auth admin API,
rules loaded (8), `npm run dev` (:3000), routes driven with the real password-grant session
projected into the `sb-127-auth-token` cookie (U6's proven approach). Verified the local edge
runtime mounts THIS worktree's `supabase/functions` (docker inspect), so the exclusion code that
ran is the code shipped here.

**(a) Fixture load — the REAL loader path, no SQL seeding:**
`node tools/edge-loader/load_edges.mjs --from-dir tests/fixtures/edges` (the hand-authored fixture
mirror of the R2 edges/ prefix; SUPABASE_DB_URL from `npx supabase status`):
```
✓ 4 claim(s) + 4 verification(s) valid (shared/brain contract + active registry endpoints)
  - sleep_duration_min|increases|hrv_sdnn_ms → high @ 0.900 (supported, 2026-07-12T00:00:00.000Z)
✓ upserted 4 claim(s) + 4 verification(s) (1 flipped superseded); pruned 0
✓ store now holds 4 claim(s), 4 verification(s), 3 verified edge(s)
```

**(b) Claims read as the authenticated user** — `GET /api/claims` → 200, all 4 claims (incl.
`stool_form|correlates|gut_comfort_score` honestly unverified, verification:null);
`GET /api/claims?paper=fixture:sleep-hrv-meta-2023` → 200 with exactly the one claim whose
citations contain that paper: triple + derivation + quoteSpan ("longer habitual sleep duration was
associated with higher SDNN…", Results para 2) + citation (tier 5, supports) + verification
{supported, high, 0.9, 2026-07-12} + humanVerdict:null. Authenticated `GET /claims` → 200
(`<title>Claims · ourobion nao</title>`). The TEST-MODE stamp is rendered client-side by
ClaimsPanel from TEST_MODE_LABEL — verbatim wording pinned to tools/llm-router by the coupling
test (the API payload was proven live; the stamp string itself is code+test-verified, honest note).

**(c) Human REJECT** — `POST /api/claims/reject {edgeId, reason}` → 200:
```
{"ok":true,"verdict":{"id":1,"edge_id":"sleep_duration_min|increases|hrv_sdnn_ms","action":"reject",
 "reason":"U9 live proof: demo curation reject — fixture claim, not real evidence",
 "created_by":"3c34e2ab-e1a0-4f28-aa1f-0285e09279c1","created_at":"2026-07-24T15:04:42.743174+00:00"}}
```
created_by = the authenticated uid (RLS-forced). Unknown edge → 404 `unknown edge: not|a-real|edge`.
Unauthenticated /api/claims → 307 to sign-in (middleware intercepts before the route's own 401).

**(d) View overlay** — `select edge_id, verdict, serving_band, human_verdict from verified_edges`:
the hrv edge row is `supported | high | reject | 2026-07-24 15:04:42` — verifier verdict untouched,
human verdict recorded on top.

**(e) Serving exclusion BEFORE/AFTER — proven by the real pipeline, not just SQL:**
- BEFORE reject: serving-eligible set (band ∈ high/mid ∧ not rejected) = 2 edges incl. the hrv
  edge; pipeline run (loader 14d + 7d backfill → 11 firedPatterns) produced edge card **id 9**
  at 15:02:43 citing `sleep_duration_min|increases|hrv_sdnn_ms`.
- AFTER reject: the same eligibility SQL returns only `sleep_duration_min|decreases|resting_hr_bpm`;
  the exact PostgREST filter generate-insights uses
  (`serving_band=in.(high,mid)&or=(human_verdict.is.null,human_verdict.neq.reject)`) returns only
  that edge; pipeline re-run upserted a NEW edge card **id 14** at 15:05:32 citing the
  resting_hr edge — the rejected edge was not re-cited and card 9's generated_at did not change.
- Rebuild-safety: a second full loader run after the reject ("upserted 4 + 4, pruned 0") left
  `human_verdict = reject` standing and edge_human_verdicts count = 1 — rebuilds never clobber.

**(f) Provenance stays honest** — `get_insight_provenance(9)` edges[0] still returns the full
rejected edge: verdict "supported", servingBand "high", derivation, quoteSpans, citations, plus
`"humanVerdict": "reject", "humanVerdictAt": "2026-07-24T15:04:42.743174+00:00"` (the field WAS
cheap to add — no honesty caveat needed).

## GIN decision (predecessor's open measurement, closed)

`EXPLAIN ANALYZE select edge_id from relationship_claims where claim->'citations' @> '[{"paperId":
"fixture:sleep-hrv-meta-2023"}]'::jsonb` at current scale (4 claims): Seq Scan, cost 0.00..15.10,
execution **0.085 ms**. A GIN index on `claim->'citations'` is unwarranted — decision: **no GIN**;
revisit when relationship_claims reaches a scale where the seq scan shows up (noted in
claimsControl.ts next to the containment helper).

## Gates (all redone this session — no credit taken for predecessor runs)

- `tools/edge-loader`: `npm run typecheck` clean; `npm test` **56/56**.
- `apps/nao`: `npm run typecheck` clean; `npm test` **74/74**.
- shared/: untouched (no tsc needed, no B8).
- `npx supabase db reset`: clean with both new migrations (table + 15-column view verified).
- `node tools/context_sync.mjs --check`: passed.
- NUL-byte scan of all 12 touched files: clean; `git diff --stat` shows no "Bin".

## Scope notes / carried forward

- **Un-reject/restore:** intentionally not modelled (append-only, reject-only CHECK) — carried
  forward for a later cycle's semantics.
- **deno check** of generate-insights: not possible locally (no deno) — validated behaviourally
  via the served edge runtime (the BEFORE/AFTER card evidence above); CI deno-check is the type
  gate.
- O17/U3 invariants, biotope, router, brain-ingest synth/verify: untouched.

memory: U9 done (2nd attempt): O13 human-verdict layer + nao /claims curation; postgrest-js .contains() needs a JSON STRING for jsonb containment; no GIN at demo scale (0.085 ms seq scan); un-reject carried forward.
