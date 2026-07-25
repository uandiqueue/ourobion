---
title: Phase-2 Demo Runbook (Run 2.0 end-to-end demo MVP)
summary: Exact, reproducible command sequence for the Run 2.0 demo — clean local stack → rules + verified edges (ONE live OpenAI verifier call) → nao simulated-data loader → engine pipeline → biotope trend/cards/provenance → models panel → human claim-reject → seeds → knowledge gaps. Every step lists its expected results with real numbers from the U12 dry-run, states the TEST-MODE honesty wording a presenter must use, and records which steps were executed vs documented-only.
type: runbook
scope: repo
status: canonical
updated: 2026-07-25
---

# Phase-2 Demo Runbook — Run 2.0 end-to-end demo MVP

Drives the FULL Run 2.0 demo on the **local stack**: main loop (1 load data → 2 analysis + trend →
3 load more days → 4 insight cards → 5 provenance) plus the four control-surface features
((a) models/spend/caps, (b) claims + human reject, (c) seeds, (d) knowledge gaps). One live LLM
call is spent per full pass (the OpenAI verifier — the run's essential live proof); everything
else is deterministic fixtures + the real engine.

**The one-command form of this whole runbook is the committed dry-run script:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo-dryrun-run2.ps1            # full pass (live verifier call)
powershell -ExecutionPolicy Bypass -File scripts\demo-dryrun-run2.ps1 -SkipLiveLlm   # reproducibility pass (reuses artifacts)
# optional flags: -IncludeAnthropicLeg (decorrelated ONE-call side-by-side, see §9),
#                 -DecorrelatedFullRun (decorrelated verifier drives the WHOLE loop, see §11),
#                 -KeepNao (leave nao up for a live demo)
```

It prints PASS/FAIL + evidence per step and exits non-zero on any failure. The sections below are
the same sequence broken out for a human driving a live demo, with expected results per step.

## What a presenter MUST say about verifier verdicts (TEST-MODE honesty)

Run 2.0 runs **all six router nodes on OpenAI** (`testMode` block in
`tools/llm-router/router.config.json`): the synthesis↔verifier family-decorrelation invariant is
deliberately OFF. Every verifier verdict shown in this demo is
**"scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)"** — the verbatim
`TEST_MODE_LABEL` stamped by nao's /models banner and biotope's provenance screen. Say it that
way: *the verdict machinery is real and live, but it is NOT an independent (decorrelated)
verification.* If the optional §9 leg was run, you may additionally say the fixture claim was
re-verified by a second provider (claude-sonnet-5) — **"decorrelated but not attested/ablated"** —
and that the two providers' verdicts are recorded side by side.

Also say plainly: the health data is **simulated** (every row provenance-stamped
`simulated:run2-demo`), and the research claims are **hand-authored fixtures** except the one
live-verified gut/mood claim.

## Prerequisites

- Windows + PowerShell; Docker Desktop running.
- Local Supabase stack up: `npx supabase start` (from an activated shell, see next line).
- Per shell: `. .\scripts\biotope-env.ps1` (node/npm/npx/flutter are NOT on the base PATH).
- `tools/brain-ingest/.env` with `OPENAI_API_KEY` (and `ANTHROPIC_API_KEY` only for §9).
- `npm ci` done in `apps/nao`, `tools/brain-ingest`, `tools/llm-router`, `tools/rules`,
  `tools/edge-loader`.
- For the biotope app step (§6): the Android emulator AVD `biotope_pixel` in the toolchain
  (Windows desktop build needs OS Developer Mode — see Known rough edges).

Env the commands below assume (the dry-run script sets these itself):

```powershell
. .\scripts\biotope-env.ps1
$env:SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
# from `npx supabase status -o env`:
#   $env:SUPABASE_URL = API_URL; $env:SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY
```

## 1 · Clean stack + rules

```powershell
npx supabase db reset          # applies ALL migrations; WIPES the DB incl. auth.users
cd tools\rules; npm run load   # rule blueprints (derived data, empty after reset)
```

Expected: reset ends `Finished supabase db reset`; loader prints `upserted 8 rule(s)`;
`select count(*) from rules;` → 8.

## 2 · Verified edges: fixtures + ONE live verifier call

Build a combined artifact dir (gitignored) from the two committed fixture sets:

```powershell
# data\corpus\demo-edges\claims.jsonl        = tools\edge-loader\tests\fixtures\edges\claims.jsonl
#                                              + tools\brain-ingest\fixtures\verify-claims.jsonl   (5 claims)
# data\corpus\demo-edges\verifications.jsonl = tools\edge-loader\tests\fixtures\edges\verifications.jsonl (4 records)
```

**LIVE LLM LEG** — verify the U2 fixture claim with the real OpenAI verifier (gpt-5, evidence-in-
prompt, corpus-grounded retrieval). This is the ONLY metered call of the demo:

```powershell
cd tools\brain-ingest
npx tsx src/cli.ts verify --from-claims fixtures/verify-claims.jsonl `
  --corpus fixtures/verify-corpus.jsonl --edges-dir ..\..\data\corpus\demo-edges
```

Expected (U12 dry-run, exact): `verify: corpus loaded — 5 doc(s)`, triage mode `full`, retrieval
over the fixture corpus, then a REAL verdict appended to `demo-edges\verifications.jsonl`.
**Verdicts vary run-to-run** (live model): the U12 passes observed `uncertain` and `partial` from
gpt-5 for `gut_comfort_score|correlates|mood_score`. Cost per call observed: US$0.033–0.041
(ledger delta, `data/llm-router/ledger.json`, verifier node; C7 cap US$1/day/node is the guardrail).

Load everything into Postgres through the real A11 loader:

```powershell
cd ..\..
node tools/edge-loader/load_edges.mjs --from-dir data/corpus/demo-edges
```

Expected: `5 claim(s) + 5 verification(s) valid` … `store now holds 5 claim(s), 5 verification(s),
4 verified edge(s)`. `verified_edges` then reads (verdict @ band):

```text
gut_comfort_score|correlates|mood_score     -> <live verdict> @ <hold|mid>   (the live one)
sleep_duration_min|decreases|resting_hr_bpm -> partial   @ mid
sleep_duration_min|increases|hrv_sdnn_ms    -> supported @ high
step_count|increases|sleep_duration_min     -> uncertain @ hold
```

(`correlates` is non-monotonic — even a `supported` gut/mood edge never decorates a card, per
O18; it surfaces through the gap ledger and provenance instead. The stool_form fixture claim
stays honestly unverified.)

## 3 · Demo user + nao

```powershell
# create the user via the auth admin API (db reset wiped auth.users):
#   POST $env:SUPABASE_URL/auth/v1/admin/users  {email, password, email_confirm: true}
#   headers: apikey + Authorization: Bearer <SERVICE_ROLE_KEY>
# demo identity used by the dry-run: u12-demo@ourobion.local / run2-demo-password!
cd apps\nao; npm run dev -- -p 3012
```

Sign in at `http://127.0.0.1:3012/login`. (Headless scripts instead do a password-grant POST to
`/auth/v1/token?grant_type=password`, wait ~2 s for the local-stack JWT iat skew, and plant the
session JSON as the `sb-127-auth-token` cookie, `base64-`-prefixed base64url.)

The dry-run also pre-seeds the biotope onboarding rows for §6 (consent + profile) via SQL:
`insert into consent_records (user_id, scope, granted) values (<uid>,'gut_tracking',true);` and a
`profiles.display_name`.

## 4 · Main loop 1–4: load data, run analysis, load more, cards

On `/loader` (Data Loader tab) — or `POST /api/loader` with `{}`:

1. **First load** → 14 simulated days ending today, scenario `recent-dip`, seed `run2-demo`.
   Expected: `loadedDays:14`; both truth tables show 14/14 rows provenance-stamped
   (`daily_gut_rows.data_origin` / `wearable_daily.source` = `'simulated:run2-demo'`).
2. **Run analysis** (button, or `POST /api/loader/run-pipeline`) — relays the `run-pipeline` edge
   function: compute-baselines → evaluate-signals → generate-insights.
   Expected: 16 baseline snapshots; 4 rules-producer cards (`energy_trending_down`,
   `gut_comfort_trending_down`, `gut_form_stable`, `hydration_trending_up`); S4 signals still
   suppressed (13-day baseline < 14 required) — honest.
3. **Load more days** → `loadedDays:7`, all history **backfill** → 21-day range. This is the
   "come back later with more data" beat of the demo.
4. **Run analysis again** — now the baseline is strong enough:
   Expected (U12 dry-run, exact): `firedPatterns:11` (gut_comfort down, mood down, sleep down,
   hrv down, urine_colour up, …), 120 personal-signal pairs, `cards {upserted:5, byProducer
   {rules:4, edge:1}}` — the edge card is `edge:sleep_duration_min|increases|hrv_sdnn_ms` — and
   `gapLedger {pairsTouched:109, demandByStatus {personal-null:108, personal-signal-no-edge:1}}`.

**Orientation check (what U4 fixed):** every edge card's copy names the FIRED metric —
"Your **sleep duration min** data shifted downward today, and published research reports that
sleep duration min tends to raise hrv sdnn ms…" — and the cited edge's SUBJECT is that fired
metric. No card ever states the non-fired endpoint moved. The dry-run asserts this over all edge
cards (0 mismatches).

## 5 · Main loop 5: provenance

`get_insight_provenance(<card id>)` as the authenticated user (biotope calls this RPC when a card
is tapped):

Expected for the edge card: `branch: "agree"`, `patternKey: "signal:sleep_duration_min:down"`,
`completeness`, `personal {rho, nEff, qValue, stable}`, and `edges[0]` carrying the full chain —
verdict + servingBand + derivation + verbatim quoteSpans + citations **with evidence passages**
(U2). A bogus/unowned card id returns `null`. Presenter: read the §TEST-MODE wording with every
verdict; clients stamp it automatically.

## 6 · Biotope app: trend chart, insight cards, provenance screen

```powershell
# Windows desktop needs OS Developer Mode (symlinks) — on the U12 machine it was OFF, so the
# Android emulator was used instead:
cd apps\biotope
# .env.public must point at the emulator's host alias: SUPABASE_URL=http://10.0.2.2:54321
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd biotope_pixel
flutter run -d emulator-5554        # or: flutter build apk --debug + adb install
```

Sign in as the demo user → Home shows the **TRENDS** section (gut_comfort_score preselected,
21-day line with the 3-day dip visible) → Insights tab lists the cards from §4 → tapping a card
opens **"How this was generated"** (the §5 provenance: pattern, coverage, personal stats,
research links with quotes/citations, every verdict stamped with the TEST-MODE label).
Screenshots from the U12 dry-run: `docs/temp/phase2-run-2/assets/`.

## 7 · Feature (a): models panel + editable caps

```powershell
cd tools\llm-router; npx tsx scripts/publish-status.ts   # explicit publish (projection tables)
```

Then `/models` in nao. Expected: 6 node rows, ALL flagged TEST-MODE with the verbatim label +
reason; today's spend rows incl. the §2 live verifier call to 8 decimal places; spend-vs-budget
summary against the run caps. **Cap edit round-trip:** set `phrasing_card` day cap to US$0.50 →
row appears with `updated_by = auth.uid()` → visible as the effective cap (`dayCap=US$0.50*` in
`check-config`) → clear it (null). Bounds: ≤ US$5.00/day, ≤ 200 000 tok/run (CHECK + client
mirror). The C7 file caps are never raised.

## 8 · Feature (b): claims + human REJECT supersedes serving

`/claims` in nao. Expected: 5 claims (4 fixtures + the live-verified gut/mood one; stool_form
honestly unverified). REJECT the edge the §4 card cites (`sleep_duration_min|increases|hrv_sdnn_ms`),
reason free-text. Then **Run analysis** again (§4 button). Expected:

- `verified_edges` overlay: `supported / human=reject` — verifier verdict untouched, human verdict
  on top (append-only `edge_human_verdicts` audit row, `created_by = auth.uid()`).
- The re-run produces **no new card citing the rejected edge**; a NEW edge card appears citing the
  next eligible edge (`edge:sleep_duration_min|decreases|resting_hr_bpm`); the pre-reject card is
  not re-upserted (generated_at unchanged).
- Provenance still SHOWS the rejected edge on the old card, now with `humanVerdict: "reject"` —
  honest history, never hidden.

## 9 · OPTIONAL: decorrelated verifier leg (D2-AMENDED)

Only with `ANTHROPIC_API_KEY` present; ≈ US$0.02. The dry-run flag `-IncludeAnthropicLeg` flips
ONLY the `verifier` node to `claude-sonnet-5` in `router.config.json` (a config edit within
TEST-MODE — the pre-O7 "verifier must not be Anthropic-family" clause trips and is downgraded to
a loud warning, which is EXPECTED), re-runs the §2 verify once into a scratch dir (never loaded
into the DB), records the verdicts side by side, and RESTORES the config byte-identically.

U12 observed: `gpt-5 → partial` vs `claude-sonnet-5 → supported` (and `uncertain` from gpt-5 on an
earlier pass) — presented strictly as **"decorrelated but not attested/ablated"**.

## 10 · Feature (c): seeds, and (d): knowledge gaps

- `/ingest` → **Seeds**: add "Magnesium and sleep quality" (query hint optional) → slug
  `magnesium_and_sleep_quality`, created_by = you. CLI proof the pipeline consumes it (offline,
  zero spend): `cd tools\brain-ingest; npx tsx src/cli.ts seed-queries --candidates-only` →
  `topics: 6 static + 1 db` and an `st:magnesium_and_sleep_quality` anchor with EMPTY metricKeys
  (C9: the LLM still cannot add pairs).
- `/ingest` → **Knowledge gaps**: demand-ranked aggregate `gap_ledger` rows (U12: totalCount 109,
  top-50 shown), plain-language status labels, no user ids anywhere. "Add as seed" prefills the
  seed form with the derived label (e.g. `body temp c and energy score`) — human reviews and
  submits through the §10 seed path; the autonomous gap→research loop stays B5+U16-gated.

## 11 · Variant: decorrelated verifier run (U13, Jayden H1 directive)

Jayden's H1: "we can actually simulate a full run with different model verifier" — go beyond §9's
ONE-call side-by-side and run the **WHOLE loop** with the decorrelated verifier's output actually
loaded and served. Flag: `-DecorrelatedFullRun` (mutually exclusive with `-SkipLiveLlm` and
`-IncludeAnthropicLeg`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo-dryrun-run2.ps1 -DecorrelatedFullRun
```

**What it does differently from a normal pass:**

1. Flips ONLY the `verifier` node to `claude-sonnet-5` in `router.config.json` (backed up first).
   The pre-O7 "verifier must not be Anthropic-family" clause trips — **EXPECTED, load-bearing**:
   `llm-router TEST-MODE WARNING — decorrelation invariant 'family(verifier) !== 'anthropic'' is
   VIOLATED...` — recorded verbatim in the session log.
2. Verifies **ALL 5 fixture claims LIVE** (not just the U2 gut/mood one) against a corpus **built at
   runtime**: the real `verify-corpus.jsonl` (5 docs) plus 4 synthesized `CorpusDoc`s — one per
   edge-loader fixture claim, each built from that claim's OWN already-committed citation +
   verbatim quote (never new "evidence" — a repackaging of the same FIXTURE material so quoteCheck,
   which runs before any verifier spend, can resolve every citation without R2).
3. Writes the 5 live verifications into the REAL `data/corpus/demo-edges` dir (not a scratch dir)
   and loads them through the real A11 edge-loader, so the decorrelated verdicts actually become
   `verified_edges` rows other people/steps read.
4. Runs the FULL main loop (load → analysis → backfill → analysis → orientation → provenance) on
   top of those decorrelated edges, then restores `router.config.json` byte-identically.
5. Features (a)-(d) are **skipped by design** this variant — unchanged code paths, already proven
   live in U12; skipping them keeps the decorrelated leg's spend/time bounded.

**Results (U13, executed twice from a clean `db reset`; BOTH live passes produced IDENTICAL
verdicts for all 5 claims — this looks like stable per-claim judgment under this specific thin
corpus, not run-to-run noise, though verdicts remain non-deterministic in general per the §
TEST-MODE wording above):**

```text
sleep_duration_min|increases|hrv_sdnn_ms     -> unsupported @ hold
sleep_duration_min|decreases|resting_hr_bpm  -> unsupported @ hold
step_count|increases|sleep_duration_min      -> supported  @ hold
stool_form|correlates|gut_comfort_score      -> unsupported @ hold
gut_comfort_score|correlates|mood_score      -> supported  @ mid
```

**A real, honest finding, not a bug:** every *directional* edge landed in the `hold` band (never
served); the one edge that clears `mid` (gut/mood) is a non-monotonic `correlates` relation that
never decorates a card (O18). Under this thin, single-source synthesized corpus, the independent
Anthropic verifier is **more conservative** than the permissive hand-authored fixture verdicts
(and than gpt-5's own live gut/mood calls in §2/§9) — it rated 3 of 5 claims `unsupported`. The
practical consequence: **0 edge-producer cards fired** either pass. The dry-run script treats this
as a non-fatal, honestly-reported outcome for this variant (not an assertion failure): main-loop
steps 1-3 and the rules-producer cards (4 of them), 120 personal signals, and the gap ledger all
ran/upserted normally; the orientation check (M4b) and the provenance RPC (M5) report **N/A this
pass** (no edge card exists to inspect/query) instead of asserting a failure. M5 instead runs a
**direct SQL trace** proving the decorrelated verdicts DID persist:

```sql
select edge_id || ' -> ' || (verification->>'verifierModel') || ' (verdict=' || verdict || ' band=' || serving_band || ')'
from edge_verifications where status='active' order by edge_id;
-- gut_comfort_score|correlates|mood_score     -> claude-sonnet-5 (verdict=supported   band=mid)
-- sleep_duration_min|decreases|resting_hr_bpm -> claude-sonnet-5 (verdict=unsupported band=hold)
-- sleep_duration_min|increases|hrv_sdnn_ms    -> claude-sonnet-5 (verdict=unsupported band=hold)
-- step_count|increases|sleep_duration_min     -> claude-sonnet-5 (verdict=supported   band=hold)
-- stool_form|correlates|gut_comfort_score     -> claude-sonnet-5 (verdict=unsupported band=hold)
```

Every row's `verifierModel` reads `claude-sonnet-5` — the decorrelated leg's output is what's
actually stored, not a scratch artifact. (A pass where the live draw instead clears `mid`/`high` on
a directional edge WOULD produce a servable edge card whose provenance traces the same way; that
shape simply wasn't the draw either of these two runs got.)

**Spend (exact, `data/llm-router/ledger.json`, `verifier` node — both attempts were 100% Anthropic
today; no plain-OpenAI verify call ran on 2026-07-25):**

- Attempt 1 (surfaced the M4 script-robustness gap below): US$0.10089000
- Attempt 2 (final, clean 17/17 pass after the fix): US$0.10350000
- **U13 total: US$0.20439000 (~SGD 0.2637 @ 1.29)** — well inside the ≤1.5 SGD (~1.1 USD) unit
  budget; router C7 per-day-per-node cap (US$1, 95% hard stop) never approached, never raised.
- `router.config.json` restored byte-identically after each attempt (`git diff` clean at commit).

**Script robustness fix folded in from attempt 1:** the original M4 assertion
(`no edge-producer card`) was written for the normal/OpenAI path, where the hand-authored fixture
verdicts are tuned to always clear a serving band. It is too strict for THIS variant, whose entire
point is an independent verifier's real judgment. Fixed by making the zero-edge-card outcome
non-fatal **specifically under `-DecorrelatedFullRun`** (a `$script:NoEdgeCardThisPass` flag), with
M4b/M5 degrading to an honest "N/A this pass" + the DB-level trace instead of asserting a failure.
The normal/OpenAI path's strict assertion is unchanged.

Standing label, unchanged: results are **"decorrelated but NOT attested/ablated"** — attestation /
ablation (systematically flipping providers across many claims and grading agreement) is next
cycle (backlog B5 / O7), not this run.

## Demo walk-through order (live audience)

1. `/loader` — load 14 days, Run analysis (main loop 1–2).
2. biotope Home — TRENDS chart (the dip); Insights — rules cards only (main loop 2).
3. `/loader` — +7 days, Run analysis (main loop 3–4).
4. biotope Insights — the edge card appears; tap → provenance screen (main loop 4–5). Read the
   TEST-MODE wording aloud.
5. `/models` — TEST-MODE banner, live spend cents, edit a cap (feature a).
6. `/claims` — REJECT the cited edge, Run analysis, show the card set change + provenance honesty
   (feature b).
7. `/ingest` — add a seed, show the CLI merged-topics line (feature c); Knowledge gaps + "Add as
   seed" (feature d).

## Known rough edges

- **JWT iat skew:** password-grant JWTs can be rejected as "issued at future" for ~1–2 s on the
  local stack — wait 2 s after sign-in in scripts.
- **`supabase db reset` wipes auth.users** — recreate the demo user (and its consent/profile rows)
  after every reset.
- **PowerShell 5.1 drops a raw `Cookie` header** on Invoke-WebRequest — the dry-run uses a
  WebRequestSession cookie container; curl.exe also works.
- **run-pipeline failure path not forced live:** the 502/failedStage contract is unit/live-tested
  in U5 but the demo never forces a stage failure.
- **Windows desktop biotope build requires OS Developer Mode** (Flutter plugin symlinks). Off on
  the U12 machine → Android emulator used. A human enabling Developer Mode can use
  `flutter run -d windows` directly.
- **Live verdicts vary run-to-run** (uncertain/partial observed for the same claim) — never
  promise a specific verdict on stage; the serving band follows the contract
  (uncertain→hold, partial→mid, supported→high).
- **Emulator networking:** inside the AVD the local stack is `http://10.0.2.2:54321`, not
  `127.0.0.1`.

## Executed-vs-documented (U12/U13 honesty record)

- **Executed by U12 (scripted, twice):** §1–§5, §7, §8, §10 — full pass (live OpenAI verifier)
  and a second reproducibility pass from `supabase db reset` with `-SkipLiveLlm` (artifacts
  reused; the runbook's LLM step was executed live in the first pass). §9 executed once.
- **Executed by U12 (manually):** §6 on the Android emulator (screenshots in
  `docs/temp/phase2-run-2/assets/`); Windows-desktop launch NOT exercised (Developer Mode off —
  see Known rough edges).
- **Executed by U13 (scripted, `-DecorrelatedFullRun`, twice from a clean `db reset`):** §11 — the
  first attempt surfaced a real script-robustness gap (M4's edge-card assertion too strict for a
  variant whose verdicts can legitimately serve nothing); fixed in-script and the second attempt
  ran clean end-to-end (17/17 PASS + 1 by-design SKIP). Both attempts produced identical per-claim
  verdicts and identical spend order of magnitude; router.config.json restored byte-identically
  both times.
- **Documented-only:** browser-driven `/login` sign-in flow (the dry-run authenticates
  headlessly; the login page itself was rendered but not click-driven this unit — U8/U10 drove
  authenticated pages live); Run-now ingest dispatch (out of demo scope, GH-Actions-gated).
