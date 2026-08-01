---
title: Demo runbook — 3-minute video production plan
summary: The shot-by-shot production plan for the hackathon demo video, centred on nao and the paper-ingestion brain — a 180-second running order of PowerPoint slides and app captures, the exact narration, the setup commands to reach each state, what must never be claimed, and the failure fallbacks.
type: reference
scope: repo
status: draft
updated: 2026-08-01
---

# Demo runbook — 3-minute video production plan

> **State anchor.** Verified against `dev-phase2-run4` @ `e6f0e1f09a1cae7ab02e580af88c3da88c99298d`,
> **2026-08-01 ~06:00 UTC**, on the macOS recording machine (§2). Re-verify before recording — §10.
>
> Doc 4 of the four-document set in issue #328. Written first because what can physically be recorded
> bounds what the other three documents may claim.

## The plan in one paragraph

**The video is about nao and the paper-ingestion brain.** That is the solution; biotope is where its
output lands in front of a person. The video is **3 minutes maximum** (event rule, mandatory) and is
built in four blocks: two slides framing the problem, two captures of nao showing the real corpus,
two slides carrying the pipeline and the design decision behind it, then one biotope capture and the
honesty slide. Roughly **100 seconds on the brain, 25 on biotope, 55 on framing.** Record the captures
silently and lay one continuous voice-over over the assembled cut.

**Total build: about half a day.** ~2h proving the nao and biotope stacks, ~1h recording captures,
~2h building 6 slides, ~1h voice-over and cut.

## 0. Evidence labels

Every claim here carries one, reused verbatim from
[`system-connection-map.md`](./system-connection-map.md) §0. Observation date is **2026-08-01**. The
distinction that matters most is between the third and the fourth: **a configured target is not a
deployment.**

`Connected now — local config observed 2026-08-01` · `Implemented and locally proven` ·
`Implemented; manual/optional` · `Configured target; deployment unproven` ·
`Defined in cloud CI; latest execution unverified` · `Unknown live external state` ·
`Planned/research-only; not serving`

Where the honest answer is "no evidence found," this document says so. That is a finding, not a gap.

---

## 1. The running order

180 seconds. Narration assumes ~150 words/minute. **Record in this order.**

| # | Medium | Time | Runs to | On screen | Purpose |
|---|---|---|---|---|---|
| 1 | **Slide 1** | 0:08 | 0:08 | Title + one-line definition | What this is |
| 2 | **Slide 2** | 0:14 | 0:22 | The problem | Why a brain is the answer |
| 3 | **Capture N1** | 0:25 | 0:47 | nao **Overview** — corpus dashboard | The corpus is real |
| 4 | **Capture N2** | 0:30 | 1:17 | nao **Papers** — search + facets | **Hero shot** |
| 5 | **Slide 3** | 0:28 | 1:45 | The ingestion → publication pipeline | How a paper becomes a claim |
| 6 | **Slide 4** | 0:20 | 2:05 | The decorrelation invariant | **The design decision** |
| 7 | **Capture B1** | 0:25 | 2:30 | biotope — card + provenance | Where it lands for a person |
| 8 | **Slide 5** | 0:25 | 2:55 | **The honest slide** | The differentiator |
| 9 | **Slide 6** | 0:05 | 3:00 | Close | — |

**If you run over, cut in this order:** fold Capture N1 into N2 (saves 25s) → Slide 2 down to 12s →
Capture B1 down to 18s. **Never cut Slide 4 or Slide 5.** They are the two segments the judging
criteria reward most.

---

## 2. The recording machine

| Fact | Observed | Label |
|---|---|---|
| Host | macOS 26.5.2, `darwin-arm64`; Node v26.4.0 / npm 11.17.0 (nao needs `>=26`) | Connected now — local config observed 2026-08-01 |
| `flutter devices` | **macOS (desktop)** and **Chrome (web)** — those two only | Connected now — local config observed 2026-08-01 |
| Physical phone / `adb` | Not connected; `adb` not on `PATH` | **No evidence found** |
| Docker daemon | Not running at time of writing | Connected now — local config observed 2026-08-01 |
| `flutter analyze` at head | Clean, apart from `The asset file '.env.public' doesn't exist` (3.7s) | Implemented and locally proven |
| macOS desktop build | Artifacts exist from **2026-07-28 17:47** — i.e. `HEAD~323` | Implemented; manual/optional — **re-verify, §10** |
| R2 credentials | Present in `apps/nao/.env` (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) | Connected now — local config observed 2026-08-01 |

**Record biotope on macOS desktop** — it reaches `http://127.0.0.1:54321` with no port forwarding. The
`Pixel_10_Pro_XL` AVD is a phone-shaped fallback but `adb` is missing and `.env.public` would need
repointing to `10.0.2.2:54321`; budget 45 minutes to prove it. Do not record in Chrome.

> **The Run 4 script does not run here.** [`hack-mvp-demo-script.md`](../../../temp/run4/hack-mvp-demo-script.md)
> is PowerShell, targets a Huawei YAL-L21 over `adb reverse`, and predates this head by 323 commits.
> Talk-track and known-gap source only.

**Capture mechanics.** `Cmd-Shift-5` → Record Selected Window. One take per capture. Move
deliberately — Run 4 logged skipped frames decoding the large generated artwork, so don't scrub
through biotope's Home. Record silent; voice-over afterwards.

---

## 3. What nao can actually be filmed doing

This is the section that decides the video, so it is evidence-first.

### The local corpus index is real and current — **verified by direct query, 2026-08-01**

`apps/nao/.wrangler/state/v3/d1/…` on this machine holds a populated D1/FTS5 index
(*Implemented and locally proven*):

| Measure | Local D1 | Live figure per issue #328 §4 |
|---|---|---|
| Papers indexed | **1,298** | — |
| `status = fetched` | **756** | **756** ✅ exact match |
| Full text > 5k chars | **739** | **739** ✅ exact match |
| `status = discovered` | 542 | — |
| Extraction method | `jats` 488 · `pdf` 259 · `directOa` 5 · `core` 4 | — |

**This corrects an earlier reading of this doc and of issue §2.1.** For the two metrics that are the
actual progress metrics, the local papers view is **not stale — it is exact.** Real DOIs, real
titles, real character counts. You can film it and quote its numbers.

> Do **not** quote 6,158. That is the record count, and the issue is explicit that record count is not
> the progress metric. Quote **756 fetched** and **739 with usable full text**.

### What is filmable, and what is not

| Surface | Filmable? | Evidence |
|---|---|---|
| nao **Overview** — corpus dashboard | **Yes** | Reads `corpusStats` from D1 (`overview/page.tsx:12`); D1 is populated |
| nao **Papers** — list, FTS5 search, facets, sort | **Yes** | Reads the D1 index directly (`papers/page.tsx:11`) |
| nao **Ingest** / **Loader** / **Models** | Chrome renders; underlying state thin | Panel components; treat as B-roll, don't dwell |
| nao **Claims** | **Renders empty** | `relationship_claims` = 0 |
| nao **`/paper/[uid]`** detail | **No — 404s locally** | R2 binding empty under `next dev` (local R2 simulator holds no objects; `apps/nao/README.md:77-79`). Needs `wrangler dev --remote` |
| Evidence chain in biotope | **Renders empty** | `verified_edges` = 0 |

### The numbers you must not contradict

Verified against the hosted demo project at 2026-08-01 05:00 UTC (*Unknown live external state* —
reported by the orchestrator, not re-observable from this machine):

| `verified_edges` | `relationship_claims` | `edge_verifications` | `insight_cards` |
|---|---|---|---|
| **0** | **0** | **0** | 1 |

The pipeline runs and the corpus is real; **it has not yet produced a published edge.** Slide 3 and 4
narrate the pipeline, Slide 5 states this plainly, and that is the honest and higher-scoring framing.

**Spend, for the cost appendix:** US$1.118 OpenAI · Anthropic 0 · Agnes 18/50 calls.

---

## 4. Setup — nao

Point nao at the **local** Supabase so both apps sit on one backend for the recording. (As configured
today, `apps/nao/.env.local` points at the hosted project while biotope points at local — coherent
architecturally, confusing on camera.)

```bash
# 1. Local stack up (Docker Desktop must be running).
npx supabase start && npx supabase status      # copy API URL + anon key

# 2. Point nao at it.
cd apps/nao
cp -n .env.public.example .env.public
#    set NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#        NEXT_PUBLIC_SUPABASE_ANON_KEY=<from status>
npm run gen-env                                 # projects → .env.local and .dev.vars
```

**Create a staff user.** nao has no public sign-up; membership lives in `public.nao_members`
(migration `20260728010000_nao_staff_roles.sql`). `scripts/nao-local-staff.ps1` is PowerShell — this
is the same operation in bash:

```bash
EMAIL=demo@ourobion.local     # must already exist in auth.users — sign up in biotope first (§5)
UID_=$(docker exec supabase_db_ourobion psql -U postgres -d postgres -X -q -t -A \
  -v ON_ERROR_STOP=1 -v email="$EMAIL" \
  -c "select id from auth.users where lower(email)=lower(:'email') limit 1;")

docker exec supabase_db_ourobion psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 \
  -v uid="$UID_" -v role=curator -c "
insert into public.nao_members (user_id, role, status, revoked_at, updated_at)
values (:'uid'::uuid, :'role', 'active', null, now())
on conflict (user_id) do update
set role = excluded.role, status = 'active', revoked_at = null, updated_at = now();"
```

**The D1 index is already populated on this machine** (§3). Only rebuild it if you must:

```bash
npx wrangler d1 execute ourobion-nao-index --local --file=src/db/schema.sql
npm run etl        # R2 creds are present in apps/nao/.env
```

```bash
npm run dev        # → http://localhost:3000, sign in as the staff user
```

---

## 5. Setup — biotope

All macOS/bash from the repo root. `scripts/seed-test-data.ps1` is PowerShell and will not run here;
the SQL seeder below is the documented standalone path.

```bash
cp apps/biotope/.env.public.example apps/biotope/.env.public
#   SUPABASE_URL=http://127.0.0.1:54321 · SUPABASE_ANON_KEY=<from supabase status>

cd apps/biotope && flutter pub get && flutter run -d macos
#   sign up as demo@ourobion.local, complete consent + profile setup, quit
```

`.env.public` is gitignored, so it is **absent in any fresh clone**; the app throws at startup without
it and `flutter analyze` warns — that warning is the tripwire. Sign-up must precede seeding: RLS keys
on `auth.uid()` and the seeder resolves the UUID from `auth.users` by email
([memory 0009](../../../memory/0009-local-test-data-seeding.md)). Local auth is email/password only
([memory 0011](../../../memory/0011-local-supabase-auth-email-only.md)).

```bash
# Seed 21 backdated days of raw rows (TRUTH); rebuilds engagement_state in SQL.
docker exec -i supabase_db_ourobion psql -U postgres -d postgres \
  -v email=demo@ourobion.local -v days=21 < scripts/seed-test-data.sql

# Serve the edge functions — they fail closed without an internal secret.
DEMO_TMP="$(mktemp -d)"
SECRET="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
printf 'OUROBION_INTERNAL_SECRET_CURRENT=%s\nOUROBION_INTERNAL_SECRET_PREVIOUS=\n' "$SECRET" \
  > "$DEMO_TMP/functions.env"
npx supabase functions serve --env-file "$DEMO_TMP/functions.env" &

# Rebuild projections — baselines FIRST, insights SECOND (insights read baselines).
ANON="$(grep '^SUPABASE_ANON_KEY=' apps/biotope/.env.public | cut -d= -f2-)"
for FN in compute-baselines generate-insights; do
  curl -sS -X POST "http://127.0.0.1:54321/functions/v1/$FN" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -H "Content-Type: application/json" \
    -H "x-ourobion-internal-secret: $SECRET" \
    -d "{\"user_id\":\"$UID_\"}"; echo
done

cd apps/biotope && flutter analyze --no-pub && flutter test --no-pub && flutter run -d macos --no-pub
```

---

## 6. The three captures

### Capture N1 — nao Overview · 25s
Land on **Overview** after sign-in. Rest on the corpus statistics: papers indexed, fetched, full-text
coverage, the extraction-method breakdown. This is the "the corpus is real" shot. Do not scroll fast.

### Capture N2 — nao Papers · 30s — **the hero shot**
Open **Papers**. In order:
1. Let the list render (real titles, real years, real citation counts).
2. Type a search term into the FTS5 search bar — something in-domain, e.g. `gut` or `sleep`.
3. Apply one facet — extraction method or open-access status — and let the count update.
4. Change the sort.

The point being made on screen is that this is a *searchable derived index over a real corpus*, not a
mock. **Do not click through to a paper detail page — it 404s locally** (§3).

### Capture B1 — biotope card and provenance · 25s
Insights tab → rest on the deterministic rules card → swipe right to save it (the `SAVED` counter
increments) → open **"How this was generated."** The provenance screen shows the pattern, data
coverage, effective days, stable / not-yet-stable, and the producer explainer *"Produced by a built-in
rule over your own logged data."* Scroll it once, slowly.

> **Optional B-roll if you have seconds spare:** biotope's consent screen and the 30-second logging
> flow (`daily_log` → stool form → urine colour → symptom flags). Cut first if tight. Do not tap
> Environment on Scan — it is not built and has no tap target.

---

## 7. The six slides

Headline plus at most three lines each. The voice-over carries the detail.

### Slide 1 · Title · 8s
**Ourobion** — a One Health personal ecological health monitor, built on an evidence brain.
Sub-line: *nao ingests the literature · biotope surfaces it to a person*.

> **No regional framing.** Do not describe the product as built for ASEAN or Southeast Asia in the
> video or on any slide. Nothing shipped is region-specific — no localisation, no regional data
> source, no market-specific feature — so a regional claim invites "show me which part" and there is
> no answer. It is a market intention, not a built thing. Describe what exists. (§9)

### Slide 2 · The problem · 14s
Headline: **Health claims are asserted, not shown.**
- Consumer apps correlate two numbers and call it an insight
- The evidence exists — in an ocean of papers nobody reads
- Anything user-facing must stay non-diagnostic: a hard product constraint

### Slide 3 · The pipeline · 28s
Left-to-right chain — the spine of the whole submission:

```
seed topics → discover → fetch → extract full text (jats / pdf / directOa / core)
  → THE WHOLE PAPER goes into the synthesis model (LLM A)
  → it returns claims, each carrying a verbatim evidence quote — and, where the paper
    states one, a verbatim mechanism quote
  → deterministic gates: quote re-checked at exact character offsets · schema ·
    active-metric key · non-diagnostic copy
  → adversarial verification (LLM B) → verified_edge → card
```

Annotate with the real figures: **1,298 indexed · 756 fetched · 739 with usable full text.**

Second call-out — **a decision we reversed**: *we deleted the keyword prefilter.*

> **There is no passage-selection stage.** *Verified at head, 2026-08-01.* `paperPrompt.ts:227-230`:
> *"The full canonical text is embedded verbatim and UNMODIFIED — no windowing."* The model reads the
> whole paper and picks its own quotes. The earlier `selectPassages` windowing still exists in-tree
> behind the older pair-based `synthesize` command, but the live path is `synthesize-papers`, one
> provider call per paper (#300 §A). **Do not draw a "select passages" box.**

### Slide 4 · The design decision · 20s — **never cut**
Headline: **The model that checks a claim never comes from the platform that wrote it.**
- Writer: **OpenAI `gpt-5`** · Checker: **Agnes `agnes-2.5-flash`**
- Different company, different training data, different weights — **so different blind spots**
- Unconditional and fail-closed; **no retrieval ⇒ `uncertain`**, and `uncertain` is held, never published

> ## 🛑 DO NOT RECORD THIS SLIDE YET — the invariant is currently disabled at runtime
>
> *Verified by executing `llm-router check-config` at head, 2026-08-01.* The tool's own verdict:
>
> ```
> Decorrelation: VIOLATED (allowed by TEST-MODE) — synthesis=openai, verifier=openai
> ```
>
> `tools/llm-router/router.config.json` **declares** `synthesis → gpt-5` (openai) and
> `verifier → agnes-2.5-flash` (agnes). But a TEST-MODE override block forces **all six nodes onto
> OpenAI** and switches the invariant off. Its own text: *"Run 2.0 single-provider posture (Jayden,
> 2026-07-24): only OPENAI_API_KEY is provisioned, so all six nodes run OpenAI and the
> synthesis↔verifier family-decorrelation invariant is **deliberately OFF**. Verifier verdicts are
> scaffolded + unit-tested, NOT independently verified. Restore a second provider and delete this
> block to re-arm the hard invariant."*
>
> It also mandates a label on any result produced under it:
> **`scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)`**.
>
> **What unblocks it:** an `AGNES_API_KEY` now exists in `tools/brain-ingest/.env` (added
> 2026-08-01), which is the second provider the block was waiting for. Someone with `tools/**`
> ownership must delete the TEST-MODE block and re-run `check-config` until it reports decorrelation
> satisfied. **Until that output is green, Slide 4 as written is false and must not be recorded.**
> Tracked as risk R0.

**The separation is by platform, not by architecture** — *this part is true of the declared config.*
`familyOf()` returns a `VendorFamily`, so a "family" here is the provider. When re-armed,
`cli.ts:522-523` enforces `family(verifier) !== family(synthesis)` unconditionally at config load and
`offlineAcceptance.ts:207` throws `configured families are not separated`.

**Say "platform" or "provider" on camera, not "family."** "Family" reads as an architecture claim we
are not making; the actual property is two models from different companies, with different corpora
and different weights, which is what makes the blind spots independent.

**Agnes is the right model to name — once it is actually in the path.** The adversarial role is
precisely the one that requires a model whose training data and weights are *not* shared with the
writer. Agnes AI is a sponsor whose team is among the judges (`hackathon-rules.md:78,81`), and the
usage ledger records **18 of 50 calls consumed**. ⚠️ **Open question:** how those 18 calls were made
while TEST-MODE routes every node to OpenAI is unexplained — resolve it before quoting the figure.

### Slide 5 · The honest slide · 25s — **never cut**
Headline: **Verified edges today: 0.**
- Synthesis is measured at batch scale; Agnes verification has run but is **not complete**
- Nothing has cleared the full gate — and `uncertain` never ships, so we hold it
- Corpus: **756 fetched · 739 with usable full text** · spend to date **US$1.118**

> **Confirm this wording with the orchestrator before recording.** An earlier draft said the verifier
> was "blocked on a provider key." That was the older state and is no longer safe to assert: **Agnes
> has consumed 18 of 50 calls**, and #322 fixed real Agnes response handling (code fences), so the
> verifier has genuinely run. The 2026-08-01 freshness audit's phrasing is the defensible one —
> *"#307 has measured synthesis at batch scale, but verification remains incomplete and no
> projection/card result has been reported."* **Do not say "blocked" and do not say "it works."**

Closing line on the slide: *We could have hardcoded a plausible edge. You would not have known.*

### Slide 6 · Close · 5s
One line on what's next, the repo and write-up links, team name.

---

## 8. The narration

~450 words at 150 wpm. Read it flat and unhurried.

**Slide 1 (8s).** "Ourobion is a One Health health monitor in two parts: nao, which reads the
scientific literature, and biotope, which puts what it finds in front of a person."

**Slide 2 (14s).** "Consumer health apps correlate two numbers and call it an insight. They assert;
they don't show their working. The evidence exists — it's sitting in an ocean of papers nobody reads.
So we built the reader first."

**Capture N1 (25s).** "This is nao, our operator window into that corpus. Twelve hundred and
ninety-eight papers indexed. Seven hundred and fifty-six fully fetched. Seven hundred and thirty-nine
with usable full text — that last number is the one that matters, because a paper we can't read the
body of is a paper we can't ground a claim in."

**Capture N2 (30s).** "The index is derived — object storage holds the papers, and this is a rebuilt
full-text search layer over them. Real titles, real DOIs, real citation counts. We can search the
corpus, facet it by how the full text was extracted — structured XML, PDF, direct open access — and
sort it. Everything downstream is built from exactly this."

**Slide 3 (28s).** "We seed topics, discover candidate papers, fetch them, and extract the full text.
Then the whole paper — not an extract — goes into the synthesis model, and it returns claims, each
quoting the evidence sentence verbatim. Where the paper states a mechanism, that's quoted verbatim
too, never paraphrased, because a paraphrased pathway is exactly where invented biology appears.
We used to pre-select passages by keyword. It was nearly blind — searching a gut-and-mood paper for
'comfort' returned zero hits while forty-five mentions of depression were never shown to the model,
and two live runs produced no claims at all. So we deleted that stage."

**Slide 4 (20s).** "Then the decision the whole system rests on. Every claim is re-checked
adversarially by a model on a *different platform*. OpenAI writes it; Agnes checks it. Different
company, different training data, different weights — so where one model is blind, the other usually
isn't. That's unconditional, it fails closed, and an uncertain claim is held, not published."

**Capture B1 (25s).** "This is where a surviving claim lands — in biotope, against a person's own
logged data. Every card can be opened up: what pattern fired, how many days of data stood behind it,
whether that baseline is stable yet, and what produced it. Here, a built-in rule, not research. If we
can't say where a card came from, we don't show it."

**Slide 5 (25s).** "So here is the honest state. That pipeline has published zero verified edges.
The corpus is real, the extraction is real, synthesis runs at batch scale, and Agnes has started
checking — but nothing has cleared the whole gate yet, and our rule is that uncertain doesn't ship.
So we hold them. We could have hardcoded a plausible edge and you would not have known."

**Slide 6 (5s).** "Everything we've claimed is in the write-up, with the evidence attached."

---

## 9. Never say these

| Don't say | Say instead |
|---|---|
| "Built for ASEAN" / "for Southeast Asia" | Nothing — drop the regional framing. No localisation, regional data source or market-specific feature shipped, so the claim has no evidence behind it |
| "A different model *family*" | "A different **platform** — OpenAI writes it, Agnes checks it." "Family" reads as an architecture claim we aren't making |
| "The verifier is blocked" / "the verifier works" | "Verification has run but is not complete; nothing has cleared the full gate" |
| "We select the relevant passages and send those" | "The whole paper goes in — the model picks and quotes its own evidence" (#300 §A; there is no passage-selection stage) |
| "The card explains the mechanism" | "The card *quotes* the paper's own mechanism sentence, verbatim — we never paraphrase a pathway" |
| "6,158 papers" | "756 fetched, 739 with usable full text" |
| "Verified research edges power the app" | "Zero verified edges today — we hold uncertain claims" |
| "Live" / "in production" / "deployed" | "Running against a local stack" |
| "Detects", "diagnoses", "treats" | "Signal", "pattern", "observation" ([memory 0003](../../../memory/0003-non-diagnostic-copy.md)) |
| "Health score" / "rating" | "Coverage — how much of the window has data" |
| "Research-backed card" (of the rules card) | "A deterministic rule over your own data" |
| "Our wearable reads your watch" (on desktop) | "Wearable sync is best-effort — it augments confidence, never gates" ([memory 0006](../../../memory/0006-wearable-sync-best-effort.md)) |

**The honesty line if a biotope surface shows seeded data:** *"This is a local stack with twenty-one
days of fabricated logs — fabricated raw rows, with every projection above them rebuilt by the real
functions. The pipeline is real; the person is not."*

---

## 10. Risk register

| # | Risk | Likelihood | Impact | Fallback |
|---|---|---|---|---|
| **R0** | **Slide 4 claims a decorrelated verifier that is switched off.** `check-config` reports `Decorrelation: VIOLATED (allowed by TEST-MODE) — synthesis=openai, verifier=openai` | **Certain today** | **Fatal — this is a false claim in the submission**, the one thing the rules say leads to disqualification | Delete the TEST-MODE block in `tools/llm-router/src/overrides.ts` (an `AGNES_API_KEY` now exists — the second provider it was waiting for), re-run `check-config` until green, then record. If it cannot be re-armed in time, **rewrite Slide 4 to describe the invariant as designed-and-enforced-in-config but currently disabled for single-provider running**, and carry the mandated TEST-MODE label |
| **R1** | **nao login fails** — no `nao_members` row, or nao still pointed at hosted | **High until dry-run** | **Fatal** — nao is the video | §4. This is the #1 pre-record task |
| **R2** | macOS biotope build fails at head — last proven at `HEAD~323` | Medium-high | High — costs Capture B1 | Build the day before. `flutter clean`, `pod install` in `apps/biotope/macos`, retry; else Pixel AVD |
| **R3** | Someone clicks a paper detail page on camera | Medium | Medium — a 404 on screen | Rehearse N2; stay on the list. Or run `wrangler dev --remote` |
| **R4** | Docker not running | High — it isn't now | Fatal | Start Docker Desktop; confirm `docker info` |
| **R5** | `.env.public` missing → biotope throws at startup | High on a fresh checkout | High | §5; the `flutter analyze` warning is the tripwire |
| **R6** | Edge function returns `internal auth denied: not_configured` | Medium | Medium | Secret file not passed to `functions serve`, or wrong header. It is `x-ourobion-internal-secret` |
| **R7** | Seeding fails — user doesn't exist | Medium | Medium | Sign up first (§5); RLS keys on `auth.uid()` |
| **R8** | Narration drifts into diagnostic language | Medium | **High** — violates a non-negotiable principle | Rehearse §8 and §9 |
| **R9** | Video runs over 3:00 | High on first cut | **Fatal** — hard event rule | Cut in the §1 order. Never cut Slides 4 or 5 |

> **The D1 ETL workflow is not a fallback — it cannot run.** #326 added
> `.github/workflows/nao-d1-etl.yml`, but it is `workflow_dispatch`-only, its header says it becomes
> runnable only once the file reaches the default branch, and its checkout pins `refs/heads/main` —
> and it **is not on `main`** (`origin/main` carries only `ci.yml` and `brain-ingest.yml`;
> `gh workflow list --all` registers three workflows, not including it). Correct label: **Configured
> target; deployment unproven.** Local `npm run etl` is the only refresh path, and the index is
> already populated anyway (§3).

---

## 11. Pre-record checklist

- [ ] `git fetch && git log -1 origin/dev-phase2-run4` — re-stamp the anchor SHA and timestamp above
- [ ] **🛑 `llm-router check-config` reports decorrelation satisfied, not `VIOLATED`** (R0). Keys must
      be exported for the router to see them — it reads `process.env`, and brain-ingest's `.env`
      parser does **not** export into it:
      ```bash
      set -a; . tools/brain-ingest/.env; set +a
      cd tools/llm-router && ./node_modules/.bin/tsx src/cli.ts check-config
      ```
      Without that, every node reports `key absent` even with a fully populated `.env`.
- [ ] **nao dry run: `npm run dev` → sign in → Overview and Papers render** (R1)
- [ ] Re-query local D1 and update the §3 numbers if they moved:
      `sqlite3 <db> "select status, count(*) from papers group by status;"`
- [ ] **`flutter run -d macos` reaches sign-in** (R2)
- [ ] `flutter analyze --no-pub` clean · `flutter test --no-pub` green
- [ ] `npx supabase start` up; `migration list --local` shows all 41
- [ ] §5 seeding reports rows; both edge functions return success; Insights renders a card
- [ ] **Re-check `verified_edges`.** If it is no longer 0, Slide 5 and the §8 pivot change materially
      — rewrite before recording
- [ ] Re-confirm the spend figures
- [ ] Final cut timed at **≤ 3:00**

## 12. Open decisions

1. **Does biotope appear at all,** or is the video 100% nao? Current plan gives biotope 25s as the
   payoff shot. Dropping it buys 25s for the pipeline slides.
2. **`wrangler dev --remote` for paper detail?** It would unlock a genuinely strong shot — a real
   paper's stored metadata — but needs a Cloudflare API token, not just the S3 credentials we have.
   Worth 30 minutes to test.
3. **Who records the voice-over,** and is it one continuous take over the assembled cut or
   per-segment?

---

**Related:** [`writeup.md`](./writeup.md) · [`system-connection-map.md`](./system-connection-map.md) ·
[`hack-mvp-demo-script.md`](../../../temp/run4/hack-mvp-demo-script.md) (Run 4, Windows, historical) ·
[`insight-slice-demo-runbook.md`](../../insight-slice-demo-runbook.md) ·
[`phase2-demo-runbook.md`](../../phase2-demo-runbook.md)
