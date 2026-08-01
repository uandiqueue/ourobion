---
title: "Run-2 U12 — scripted E2E demo dry-run + reproducible demo runbook (DoD v+vi, acceptance iv)"
summary: "The run's final unit: scripts/demo-dryrun-run2.ps1 drives the FULL demo (main loop 1–5 + features a–d) from `supabase db reset` with PASS/FAIL + evidence per step, including the run's essential LIVE proof — brain-ingest verify against the real OpenAI verifier (gpt-5, evidence-in-prompt, corpus-grounded) on the U2 fixture claim — and the optional D2-AMENDED decorrelated leg (verifier flipped to claude-sonnet-5 for ONE run, config restored byte-identically; verdicts recorded side-by-side as 'decorrelated but not attested/ablated'). Executed twice: full pass 21/21 PASS and a -SkipLiveLlm reproducibility pass from a clean reset reusing the first pass's artifacts. docs/shared/phase2-demo-runbook.md is the human-runnable runbook with real numbers, the TEST-MODE honesty wording, and an executed-vs-documented record. Biotope visually verified on the Android emulator (Windows desktop blocked: OS Developer Mode off) — sign-in, TRENDS 21-day chart, Insights incl. both edge cards, and the provenance screen; that check surfaced and fixed a REAL latent U7 bug (ProvenanceCitation.evidenceTier mistyped String? — the shared/brain EvidenceTier is a number — so every real edge card's provenance screen threw; U7's own fixtures had masked it with string tiers). Exact spend: OpenAI US$0.141315, Anthropic US$0.042660 (~SGD 0.18 / 0.06 of the 4 / 1.5 SGD budgets)."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run-2 U12 · Scripted E2E demo dry-run + reproducible demo runbook (final unit)

Branch `feat/phase2-run-2/u12-demo-dryrun-runbook` off `feat/phase2-run-2/u11-gap-surfacing`.
Deliverables: `scripts/demo-dryrun-run2.ps1` (the scripted dry-run), `docs/shared/phase2-demo-runbook.md`
(the reproducible runbook), screenshots under `docs/temp/phase2-run-2/assets/`, one small in-spirit
biotope bug fix (below).

## Dry-run pass 1 (full, live LLM + Anthropic leg) — 21/21 PASS

`powershell -File scripts\demo-dryrun-run2.ps1 -IncludeAnthropicLeg`, exit 0. Per-step evidence
(verbatim from the run):

- **S0–S1** toolchain + keys; `supabase db reset` clean (all migrations; auth.users wiped).
- **S2** rules load: `upserted 8 rule(s)`; rules table = 8.
- **S3** combined artifact dir `data/corpus/demo-edges` (gitignored): 5 claims
  (4 edge-loader fixtures + the U2 verify fixture), 4 hand-authored verifications — the gut/mood
  claim deliberately left unverified for the live leg.
- **S4 LIVE LLM (acceptance iv):** `brain-ingest verify --from-claims fixtures/verify-claims.jsonl
  --corpus fixtures/verify-corpus.jsonl --edges-dir data/corpus/demo-edges` → corpus loaded
  (5 docs), triage `full`, REAL verdict appended:
  `gut_comfort_score|correlates|mood_score → partial [full]`; verifier-node ledger delta
  **US$0.04085625**. (Earlier debug passes of the same leg produced `uncertain` — live verdicts
  vary run-to-run; recorded honestly in the runbook.)
- **S5** edge-loader `--from-dir` → 5 claims + 5 verifications valid; verified_edges = 4:
  gut/mood `partial @ hold` (live), rhr `partial @ mid`, hrv `supported @ high`, step `uncertain @ hold`.
- **S6** demo user `u12-demo@ourobion.local` (uid 47f0b3b6-…) via auth admin API + biotope
  onboarding rows (consent `gut_tracking`, profile display_name).
- **S7** password grant + `sb-127-auth-token` cookie (base64url session JSON) in a
  WebRequestSession; 2 s iat-skew pause.
- **S8** nao dev server on :3012.
- **M1** POST /api/loader → `loadedDays:14`, range 2026-07-11..24; 14/14 rows in BOTH truth tables
  stamped `simulated:run2-demo`.
- **M2** run-pipeline #1: 3 stages ok; 16 baseline snapshots; 4 rules cards (S4 suppressed at
  13-day baseline — honest).
- **M3** POST /api/loader → `loadedDays:7`, all backfill → 21-day range.
- **M4** run-pipeline #2: `firedPatterns=11`, `cards {upserted:5, byProducer {rules:4, edge:1}}`,
  personal_signals=120, `gapLedger {pairsTouched:109, demandByStatus {personal-null:108,
  personal-signal-no-edge:1}}`; edge card #9 `edge:sleep_duration_min|increases|hrv_sdnn_ms`.
- **M4b ORIENTATION (acceptance iv):** card #9 fired=sleep_duration_min, cited-edge
  subject=sleep_duration_min, copy names the FIRED metric ("Your sleep duration min data shifted
  downward today, …"); **0 mismatches** — NO card names a non-fired endpoint (U4 wrong-metric
  pattern queried over all edge cards).
- **M5** `get_insight_provenance(9)` as the authenticated user: branch=agree,
  pattern=signal:sleep_duration_min:down, completeness 0.75, edge verdict=supported band=high
  score=0.9, verbatim quote + citation with evidence passage. (Verdict display in clients carries
  the TEST-MODE stamp.)
- **FA** publish-status → 6 status rows all test_mode; today's spend rows to 8 dp (incl. the live
  verifier call); cap round-trip: phrasing_card perDayUsdCap 0.5 set (updated_by=auth.uid) →
  visible → cleared (NULL). C7 file caps never raised.
- **FB** /api/claims → 5 claims (stool_form honestly unverified); REJECT
  `sleep_duration_min|increases|hrv_sdnn_ms` → overlay `supported / human=reject`; re-run
  pipeline → 0 new cards cite the rejected edge; NEW edge card #14
  `edge:sleep_duration_min|decreases|resting_hr_bpm`; old card #9 generated_at unchanged;
  provenance still SHOWS the rejected edge (honest history).
- **FC** POST /api/seeds "Magnesium and sleep quality" → slug `magnesium_and_sleep_quality`;
  CLI `seed-queries --candidates-only` → `topics: 6 static + 1 db` +
  `st:magnesium_and_sleep_quality` anchor with empty metricKeys (C9 intact; zero spend).
- **FD** /api/gaps → totalCount=109, top-50 returned, aggregate-only; top row
  body_temp_c × energy_score with derived add-as-seed label `body temp c and energy score`.
- **XA (optional decorrelated leg, D2-AMENDED):** verifier node flipped to `claude-sonnet-5`
  (config edit within TEST-MODE; the pre-O7 decorrelation clause tripped and WARNED as expected),
  the SAME verify leg re-run once into a scratch dir (never loaded into the DB), config RESTORED
  byte-identically. Side-by-side (decorrelated but NOT attested/ablated):
  `openai/gpt-5 → partial` vs `anthropic/claude-sonnet-5 → supported`
  (an earlier pass: gpt-5 → `uncertain`). Anthropic delta **US$0.02353500**.
- **S9** ledger day 2026-07-24 (UTC): verifier US$0.18542500, phrasing_card US$0.00015125.

## Dry-run pass 2 (reproducibility, `-SkipLiveLlm`) — 20/20 PASS

Second full execution from `supabase db reset` (the XA leg is not part of this pass), reusing the
pass-1 artifacts in `data/corpus/demo-edges` (the runbook's LLM step was executed live in pass 1;
this pass reuses the recorded verification — stated verbatim on the step). All steps green, ledger
deltas US$0.00000000 both providers, and the engine numbers REPRODUCED EXACTLY:
`firedPatterns=11`, `cards {upserted:5, byProducer {rules:4, edge:1}}`, personal_signals=120,
`gapLedger {pairsTouched:109, demandByStatus {personal-null:108, personal-signal-no-edge:1}}`,
same card set incl. edge card #9. This is DoD (vi): the documented commands reproduce from a clean
local stack.

## LLM spend (exact ledger numbers, both providers)

Ledger `data/llm-router/ledger.json`, day 2026-07-24 (UTC), U12 delta over the pre-U12 baseline
(verifier 0.00145000, phrasing_card 0.00015125):

- **OpenAI: US$0.14131500** (~SGD 0.182 @1.29) — four live gpt-5 verifier calls across the
  script-debug iterations + the final pass (0.03960625, 0.03265625, 0.02819625, 0.04085625).
  Budget: ≤ 4 SGD — used ~4.6%.
- **Anthropic: US$0.04266000** (~SGD 0.055 @1.29) — two claude-sonnet-5 verifier calls
  (0.01912500 + 0.02353500; the XA leg ran in two debug iterations). Budget: ≤ 1.5 SGD — used ~3.7%.
- Router C7 caps (US$1/day/node, hard stop 95%) were the guardrail throughout and were never raised.

## Biotope visual check (Android emulator; Windows desktop honestly blocked)

- **Windows desktop NOT exercised:** `flutter build windows` fails with
  "Building with plugins requires symlink support. Please enable Developer Mode" — OS Developer
  Mode is OFF on this machine and the agent is not admin. Manual step for a human: enable
  Developer Mode (`start ms-settings:developers`), then `flutter run -d windows` works directly.
- **Executed instead on the toolchain AVD `biotope_pixel`** (per brief: emulator when desktop is
  not enabled): debug APK built from this branch, installed via adb; signed in AS the demo user
  through the real sign-in screen (adb-driven); Health Connect prompt dismissed (demo data comes
  from Supabase).
- **Screenshots** (docs/temp/phase2-run-2/assets/):
  - `u12-biotope-home-trends.png` — Home with the TRENDS section: Gut comfort score picker,
    21-point line 4 Jul → 24 Jul, the simulated 3-day dip clearly visible.
  - `u12-biotope-insights-list.png` — Insights list (rules cards, "How this was generated ›").
  - `u12-biotope-insights-edge-cards.png` — BOTH edge cards: the pre-reject hrv card and the
    post-reject resting-hr card (feature (b) visible in pixels); copy names the fired metric.
  - `u12-biotope-provenance-top.png` — provenance screen: pattern/branch, data coverage 21/28,
    edge triple, direction/band/score, **Verifier verdict: supported (as of 2026-07-12)** with the
    verbatim TEST-MODE stamp.
  - `u12-biotope-provenance-quotes-citations.png` — derivation, studied scope, verbatim source
    quote + locator, citation with `evidence tier 5 · high · supports · population`.

## In-spirit bug fix (small, demo-blocking): U7 provenance parser mistyped evidenceTier

Tapping any REAL edge card's "How this was generated" rendered "Provenance could not be loaded
right now." Root cause (found via a throwaway pure-Dart repro executing the production parser
against the live RPC): `ProvenanceCitation.fromJson` cast `evidenceTier` to `String?`, but
shared/brain `EvidenceTier` is a NUMBER (1..5) — `type 'int' is not a subtype of type 'String?'`.
U7's unit fixtures had encoded tiers as strings ("cohort"), masking the bug; the U5 live-proof JSON
(`"evidenceTier": 2`) already showed the true wire type. Fix (apps/biotope):

- `provenance_models.dart`: `evidenceTier` → `int?`, parsed `(as num?)?.toInt()`.
- `insight_provenance_screen.dart`: citation meta renders `evidence tier N` via a new gated
  `ProvenanceCopy.evidenceTierPrefix` (added to `ProvenanceCopy.all`).
- Tests corrected to the contract: `provenance_model_test.dart` fixtures use numeric tiers (and
  the invalid `impactTier: "mid"` → `"moderate"`), `provenance_screen_widget_test.dart` likewise.
- Verified: repro parses (`card #9 … verdict=supported`), `flutter analyze` clean,
  `flutter test` **111/111**, and the rebuilt APK renders the full provenance screen (screenshots).

## Gates

- Dry-run script: pass 1 **21/21 PASS** (incl. live LLM + Anthropic legs), pass 2 (`-SkipLiveLlm`)
  **21/21 PASS** from a clean reset.
- apps/biotope (touched): `flutter analyze` — No issues found; `flutter test` — **111/111 pass**.
- `node tools/context_sync.mjs --check` — passed (runbook front-matter + regenerated docs/INDEX.md
  via `--fix-index`).
- Generated-plugin EOL churn: confirmed content-empty (`git diff --ignore-cr-at-eol` empty),
  discarded; no `Bin` entries in `git diff --stat`; NUL scan clean.
- router.config.json byte-identical after the XA leg (asserted in-script); no cap raises, no new
  migrations, no shared/ code changes (the runbook is a doc).

## Decisions made autonomously (for review)

- **Script robustness for two documented local-stack wrinkles:** (a) nao calls retry (≤4×, 3 s)
  ONLY on PostgREST "JWT issued at future" (the U11 iat-skew wrinkle — it also fires when
  @supabase/ssr mints a refreshed token mid-run); (b) `supabase db reset` gets ONE retry — under
  heavy host load the post-reset health probe can time out ("context deadline exceeded") after all
  migrations applied. Both are stated in the runbook's rough edges.
- **Windows PowerShell 5.1 drops a raw `Cookie` header** on Invoke-WebRequest — the script plants
  the session cookie via a WebRequestSession container instead (documented in the runbook).
- **Combined artifact dir** `data/corpus/demo-edges` (gitignored under data/corpus/): edge-loader
  fixture claims+verifications + the U2 verify-fixture claim, live verification appended — so ONE
  `--from-dir` load feeds the full-rebuild loader without pruning surprises.
- **Anthropic-leg hygiene:** scratch `--edges-dir`, never loaded into Postgres; ledger attribution
  split via per-call deltas (the ledger is per-NODE, and the verifier node hosted both providers).
- **The emulator, not a faked desktop run,** for the visual check — with the exact desktop error +
  the human step recorded.
- **In-spirit fix scope:** only the provenance-parser type bug (demo-blocking, main-loop step 5);
  nothing else in biotope touched. The U9-added `humanVerdict` field is returned by the RPC but not
  yet rendered by the U7 screen — left as-is (not demo-blocking; the reject story is told in nao).

## Not verified / exceptions (honest list)

- **Windows desktop biotope launch** — blocked by OS Developer Mode (exact error above); the ONE
  unexercised launch path. Android emulator path fully exercised instead.
- **run-pipeline failure path** (502/failedStage) not forced live — unit/live-tested in U5;
  documented as a rough edge.
- **Live verifier verdicts are non-deterministic** (uncertain/partial observed for the same claim,
  and sonnet-5 said supported) — the runbook instructs presenters never to promise a verdict; all
  verdicts remain TEST-MODE-stamped ("scaffolded + unit-tested"), and the XA side-by-side is
  labeled "decorrelated but not attested/ablated".
- **nao /login browser click-path** not driven this unit (headless cookie auth used; the login
  page renders and prior units drove authenticated pages live).
- **deno check** of edge functions: n/a locally (no edge-function change this unit).

memory: Run-2 U12 (final unit) done — scripts/demo-dryrun-run2.ps1 proves the whole demo E2E from db reset (21/21 PASS twice: live pass incl. real gpt-5 verify [partial] + claude-sonnet-5 decorrelated leg [supported], and a -SkipLiveLlm reproducibility pass); docs/shared/phase2-demo-runbook.md is the human runbook with real numbers + TEST-MODE wording; biotope verified on the Android emulator (Windows desktop needs OS Developer Mode for plugin symlinks) which surfaced+fixed a real U7 bug (ProvenanceCitation.evidenceTier mistyped String? vs numeric EvidenceTier — provenance screen threw on all real edge cards; flutter 111/111 after fix). Spend: OpenAI US$0.1413, Anthropic US$0.0427. PS5.1 gotchas hit: BOM-less non-ASCII .ps1 parse failure, Invoke-WebRequest drops raw Cookie headers (use WebRequestSession).
