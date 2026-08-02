---
title: Insight Slice Demo Runbook (L6 one-card end-to-end)
summary: Exact, reproducible command sequence for the L6 one-card slice — one metric pair (gut_comfort_score × mood_score) driven through the whole brain + engine pipeline into one user-facing card with its source-panel dataset, on the local stack. Records the interim (key-blocked-honest) verification and exactly what flips when the B5 verifier key lands.
type: runbook
scope: repo
status: canonical
updated: 2026-07-28
---

# Insight Slice Demo Runbook — L6 one-card end-to-end

Drives **one pair** — `gut_comfort_score × mood_score` — through A2→A11 and S2→S8 into one
user-facing card plus its §S8 source-panel dataset, on the **local stack**, no metered API spend.
Slice definition: [`insight-engine-architecture.md`](../implemented/insight-engine-architecture.md) §9 (L6).

## What this slice honestly is (read first)

The real synthesised edge is `gut_comfort_score|correlates|mood_score` (A8 run U10, verbatim-quote
grounded, A9-gated). The decorrelated **A10 verifier cannot run for real** — it needs a non-Anthropic
key (run decision D4, durable caveat [memory 0016](../memory/0016-insight-engine-l6-one-card-slice.md)) and must not use the
Anthropic-family local-agent route (decorrelation). So the slice ships an **interim, key-blocked-honest
verification**:

- Its deterministic halves run **for real** — the A9 quoteCheck (over the paper's canonical text
  pulled from R2) and the verifier's own corpus BM25-lite retrieval (over the real corpus manifest).
- Its **verdict is forced by the schema, not faked**. `EdgeVerification` (`shared/brain`) only allows
  `supported`/`partial` when `corroboration.supporting ≥ 1`, and corroboration is re-derived **only
  from LLM-assigned stances** over retrieved sources. Deterministic retrieval yields `stance:'mentions'`
  only — no supporting stance can be honestly assigned without the (blocked) verifier LLM. The contract
  therefore forces the verdict to **`uncertain`**.
- `verifierModel` reads `INTERIM:pending-real-verifier (decorrelation-blocked, register B5)` so it can
  never be mistaken for a real verdict. The verification lives ONLY in the gitignored artifact dir
  (`data/corpus/edges/verifications.jsonl`) — never committed as truth.

**Consequence for the card.** `uncertain` → `edge_score 0` → `serving_band hold` → **not servable**.
With no servable edge on the pair, the composer's branch is **`idiosyncratic`** and the card is the
uncited **`personal`** "still-researching" card (composer.ts branch table). This is the honest branch,
not `agree`. What flips when B5 lands is spelled out at the end.

## Prerequisites

- `. .\scripts\biotope-env.ps1` in each PowerShell shell (node/npx are not on the base PATH).
- Local Supabase running; DB URL `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- `tools/brain-ingest/.env` has working R2 credentials (used for A9 text + the demo).
- Service-role key from `npx supabase status -o env` (`SERVICE_ROLE_KEY`) — used below only where
  noted; it is **no longer accepted as request authorization** on the three engine functions
  (R4-U2: the service-role bearer now gets a 401, same as any other wrong credential).
- `OUROBION_INTERNAL_SECRET_CURRENT` set locally for the functions (matches
  `app.ourobion_internal_secret` / the value your `.env` for `supabase functions serve` supplies)
  — the new, and only, authorization input for compute-baselines / evaluate-signals /
  generate-insights / run-pipeline. See `supabase/functions/_shared/internal_auth.ts`.

## Command sequence (db reset → card + source panel)

```powershell
# 0. Clean slate.
. .\scripts\biotope-env.ps1
npx supabase db reset                       # applies all migrations

$env:SUPABASE_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
# ANON is the JWT-gate credential (verify_jwt=true / Kong routing) — it grants nothing on its
# own. $SECRET is the ONE authorization input, compared constant-time against
# OUROBION_INTERNAL_SECRET_CURRENT/_PREVIOUS inside each function (R4-U2). Neither replaces the
# other; both headers are required below.
$ANON = (npx supabase status -o env | Select-String 'ANON_KEY').ToString().Split('"')[1]
$SECRET = $env:OUROBION_INTERNAL_SECRET_CURRENT
```

### 1. Seeder (A2-adjacent) — real local-agent run

```powershell
cd tools\brain-ingest
npx tsx src/cli.ts seed-queries --cap 6      # writes a mailbox request under data/llm-router/mailbox
```

The agent session fulfils the `<id>.request.json` by writing `<id>.response.json` (a single JSON
object keyed by candidate id → 3–6 scholarly queries; see `tools/llm-router/README.md`). Result:
`16/16 candidate(s) got queries via local_agent; rejected=0`. Because the L6 cross rule (step 5) is
loaded on disk, the seeder now enumerates a **`rule_blueprint` pair `rb:gut_comfort_score__mood_score`**
(the gut-brain pair) — a genuinely better gut-brain candidate than the static `gut_microbiome` topic.

### 2. Synthesis (A8) — already exists; re-run only if missing

The real claim lives at `data/corpus/edges/claims.jsonl` (edge
`gut_comfort_score|correlates|mood_score`). To regenerate (real local-agent run, A9-gated):

```powershell
npx tsx src/cli.ts synthesize --pair gut_comfort_score,mood_score `
  --paper "doi:10.1016/j.isci.2026.116224" `
  --terms "gut,IBS,gastrointestinal,abdominal,mood,anxiety,depression,microbiota"
```

### 3. Interim verification (A10, KEY-BLOCKED HONEST)

Runs the U11 scaffold's real deterministic halves (dry-run: A9 quoteCheck via R2 text + corpus
BM25-lite retrieval), then writes the schema-forced `uncertain` interim record. In this repo the
one-shot driver is `tools/brain-ingest/l6_interim_verify.mts` (throwaway — see the session log). It
prints, for real:

```
quoteCheck (A9): {"spansFound":2,"spansTotal":2,"allPresent":true}
retrieval: performed=true corpusHits=8 external=0 totalSources=8
verdict: uncertain | verifierModel: INTERIM:pending-real-verifier (decorrelation-blocked, register B5)
-> data/corpus/edges/verifications.jsonl
```

When B5 lands this becomes ONE command: `npx tsx src/cli.ts verify --edge
gut_comfort_score|correlates|mood_score` (verifier node flipped to `api_worker` in
`tools/llm-router/router.config.json`, non-Anthropic key present).

### 4. Load edges → Postgres (A11)

```powershell
node tools/edge-loader/load_edges.mjs --from-dir data/corpus/edges
# -> gut_comfort_score|correlates|mood_score → hold @ 0.000 (uncertain, ...)
```

```sql
select edge_id, relation, verdict, edge_score, serving_band,
       verification->>'verifierModel' as verifier_model
from verified_edges where edge_id = 'gut_comfort_score|correlates|mood_score';
-- correlates | uncertain | 0.000 | hold | INTERIM:pending-real-verifier (decorrelation-blocked, register B5)
```

### 5. Cross-metric rule (committed truth-tier data)

`data/rules/cross/gut/gut_comfort_mood_comove.json` — a `coincidence` blueprint over the pair, both
leaves rising, `lagDays: null` (same-window ≡ C10 lag 0; the edge is a symmetric `correlates`),
copy-gate clean. Load it into the `rules` table:

```powershell
node tools/rules/load_rules.mjs             # 8 blueprints valid; rules table holds 8 rows
```

This rule is brain-neighbour scoped (C10): it only fires when a **servable** edge connects the pair.
While the edge is `hold`, `generate-insights` reports it under `brainScopeSkips` — the honest dormant
state until the verifier lands.

### 6. Engine (S2→S8) — shaped user data → card

Seed one user with 60 days of `gut_comfort_score` and `mood_score` (see `scratchpad_l6_seed.sql` in the
session log). **Shaping rationale:** identical daily values → cross-correlation ρ = 1; a
balanced low-autocorrelation sequence over {2,3,4} keeps the S5 Pyper-Peterman `N_eff` above the
gate (`nEffMin` 10) — a periodic pattern collapses N_eff (~5) and a lopsided random draw makes the S4
MAD degenerate; the last-28-day window has median 3 / MAD 1 so today's joint rise to 5 fires the S4
signal (modified z = 1.349 > deadband 1.0).

```powershell
# NOTE (R4-U2): the service-role bearer no longer authorizes these calls — it now gets a plain
# 401, same as any other wrong credential. Auth is now two headers: an anon bearer to satisfy
# the JWT gate (grants nothing by itself) plus the internal secret, the only real authorization
# input (see supabase/functions/_shared/internal_auth.ts).
curl -s -X POST "http://127.0.0.1:54321/functions/v1/compute-baselines" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "X-Ourobion-Internal-Secret: $SECRET" -d '{}'
curl -s -X POST "http://127.0.0.1:54321/functions/v1/evaluate-signals"  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "X-Ourobion-Internal-Secret: $SECRET" -d '{}'
curl -s -X POST "http://127.0.0.1:54321/functions/v1/generate-insights" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "X-Ourobion-Internal-Secret: $SECRET" -d '{}'
```

Expected (honest end-state): `personal_signals` pair ρ 1.0 / N_eff ≈ 37 / q 0 / stable t;
`generate-insights` → `firedPatterns 2, insights {idiosyncratic 1}, cards {personal 1}`, the cross
rule under `brainScopeSkips`.

### 7. The card + its source panel

```sql
-- the produced card (uncited personal / idiosyncratic — the honest branch)
select rule_id, producer, category, title, edge_refs, insight_id
from insight_cards where user_id = 'd1e50000-0000-4000-a000-000000000001';
-- personal:gut_comfort_score|mood_score | personal | relationship | "Still researching: …" | [] | <insight_id>

-- the §S8 SOURCE-PANEL DATASET (verbatim quotes + char offsets + derivation + population)
select ve.verdict, ve.serving_band, ve.claim->>'population' as population,
       ve.claim->>'derivation' as derivation,
       span->>'quote' as quote, span->>'charStart' as char_start, span->>'charEnd' as char_end,
       span->>'locator' as locator
from verified_edges ve, jsonb_array_elements(ve.claim->'quoteSpans') span
where ve.edge_id = 'gut_comfort_score|correlates|mood_score';

-- per-citation applicability is the U1 cold-start stub — every citation grades 'unknown'
select cit->>'paperId' paper, cit->>'evidenceTier' tier, cit->>'impactTier' impact,
       cit->>'population' population, 'unknown' as applicability_u1
from verified_edges ve, jsonb_array_elements(ve.claim->'citations') cit
where ve.edge_id = 'gut_comfort_score|correlates|mood_score';
```

The source-panel dataset — 2 verbatim quotes with `charStart/charEnd`, the full derivation, the
claimed + per-citation population, and the U1 `'unknown'` applicability — is present **end-to-end in
the DB**. Its link ONTO the card (`insight_cards.edge_refs` → `verified_edges`) is populated by the
composer only for **servable** edges; while the interim edge is `hold` the card is the uncited
`personal` variant, so the panel is demonstrated from the edge/claim tables directly.

## What changes when the B5 verifier key lands

One-command re-runs (no code changes):

1. **Verifier (step 3)** flips `verifier` → `api_worker` in `router.config.json` (non-Anthropic key
   present) and runs `npx tsx src/cli.ts verify --edge gut_comfort_score|correlates|mood_score` for a
   real adversarial, decorrelated verdict.
2. If the verdict is `supported`/`partial` with corroboration, the loader (step 4) recomputes
   `edge_score`/`serving_band`: **band flips `hold` → `mid`/`high`** and the edge becomes **servable**.
3. `generate-insights` (step 6) then classifies the pair through the servable edge. The edge is
   `correlates` (context-only, non-monotonic), so the branch **upgrades to `research-context`** and the
   cross rule `gut_comfort_mood_comove` fires (leaves `research-context` and `agree`-servable
   only) — its card carries `edge_refs` pointing at the edge, and the §S8 source panel lights up
   **from the card**. (A monotonic `increases`/`decreases` edge would upgrade to `agree`; this pair's
   symmetric `correlates` tops out at `research-context` by design — §1.3 monotonic-only direction.)
