---
title: Demo runbook — 3-minute video production plan
summary: The shot-by-shot production plan for the hackathon demo video, centred on nao and the paper-ingestion brain — the owner-specified animation-led 180-second running order with every beat mapped to the internal component it depicts (issue #300 target flow), the setup commands to reach each state, what must never be claimed, and the failure fallbacks; figures re-measured 2026-08-02 against 14 verified edges of which 11 are servable, and 0 cards with producer='edge'.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

# Demo runbook — 3-minute video production plan

> **State anchor.** Running order (§1, §1b) is the owner's, unchanged, from PR #342. Every **figure** below
> was re-measured against `dev-phase2-run4` @ `0083858`; hosted table counts were read directly from the
> Supabase demo project on **2026-08-02**. Re-verify before recording — §11.
>
> Doc 4 of the four-document set in issue #328. Written first because what can physically be recorded
> bounds what the other three documents may claim.
>
> **Three changes since PR #342 was written that alter what you may record:**
> 1. **R0 is cleared.** `check-config` now reports `Decorrelation: OK — synthesis=openai, verifier=agnes`.
>    The TEST-MODE override block is gone from `tools/llm-router/src/`. The 🛑 stop-block that stood on
>    Slide 4 was describing a state that no longer exists, and has been removed.
> 2. **The pipeline has now run end to end into Supabase.** `verified_edges` is **14, of which 11 are
>    servable** — not 0. Every corpus, spend and hosted figure in the pre-#342 sections was stale.
> 3. **The §4 → §6 → §7 promise is now partly payable, and the boundary is exact:** verified edges exist,
>    but **no `producer='edge'` card exists yet**. See "The one thing this running order must not promise".
>
> **The fatal risk has inverted.** It used to be "we claim a verifier that is switched off." It is now
> **R0b: "we claim the verifier validated something because it ran."** It ran, and 11 of 14 edges are
> servable — but that is a fidelity judgement about single papers, not a validation of the science.

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

## 1. The running order — OWNER-SPECIFIED, 2026-08-01

> **This section supersedes the earlier slide-led running order.** The owner specified an
> **animation-led** structure on 2026-08-01. Sections 6 (captures) and 7 (slides) below still
> describe the previous plan and need restructuring around this order — the *content* of Slide 4
> (decorrelation) and Slide 5 (the honest slide) survives and is folded into §4 and §8 here.
>
> **Division of labour, owner's words:** *"demo is supposed to be flashy, the writeup will be
> detailed, evidence will be in repo."* So this video's job is to **communicate the mechanism**,
> not to carry the evidence. Depth belongs in `writeup.md`; proof belongs in the repo.

180 seconds. Narration assumes ~150 words/minute.

| § | Content | ~time | Medium |
|---|---|---|---|
| 1 | What this is | 0:12 | slide |
| 2 | Problem framing | 0:13 | slide |
| 3 | **nao UI overview + features** | 0:20 | capture |
| 4 | **The pipeline animation** (6 beats, below) | 0:40 | animation |
| 5 | Client intro — biotope walkthrough, fast and short | 0:20 | capture |
| 6 | **Insights animation** — metrics → match → surface | 0:25 | animation |
| 7 | Back to biotope insights — cards + evidence chain | 0:30 | capture |
| 8 | Living app · gap ledger · future (**not** Zebra & Viceroy — see §1b §8) | 0:20 | slide |

**No hero shot.** The mechanism is the hero.

### Why animation is the correct choice here, not a compromise

The pipeline's internals are **genuinely unfilmable** — there is no screen on which a claim becomes
an edge. Animating them is the only honest way to show them. The governing principle:

> **Animate what cannot be filmed. Film what can.**

§4 and §6 are animation because nothing renders them. §3, §5 and §7 are real screen captures
because those surfaces exist and work. Do not animate anything that could have been filmed.

---

## 1b. Section-by-section map to the internal system

Every beat below names the code, contract or table it depicts, so the animation cannot drift from
what the system actually does. **The authority for this flow is issue #300 §"Target flow".**
Three model tiers: **`a`** = small/cheap · **`s`** = synthesis (smart) · **`v`** = verifier.

### §3 · nao UI overview → #300 step 1 · Sourcing

| On screen | Internal |
|---|---|
| Corpus dashboard, paper search + facets | `apps/nao` Papers/Overview reading **D1/FTS5**, a *derived projection* of R2 |
| Seeds / research questions | `ingestion_seeds` table, `/api/seeds` |
| "Ingest" control | `githubDispatch` → GitHub Actions (**never** a provider call from nao) |
| Keyword expansion | **`a`** model, `seeder` node → `seed-queries` |

**Truth boundary to respect on screen:** R2 + `manifest/papers.jsonl` are truth; **D1 is a
projection**. nao dispatches and reports — it never holds a provider key.

### §4 · The pipeline animation → #300 steps 2–5

Six beats, each mapped:

| # | Animation beat | Internal | Status |
|---|---|---|---|
| 1 | Research paper | `StructuredPaper.canonicalText` from R2 | built |
| 2 | **Flattened** | **`selectPassages` deleted — whole paper in** (#300 §A) | built (#306) |
| 3 | Fed into synthesiser | **`s`** model via `paperRun.ts` / `paperPrompt.ts` | built (#306) |
| 4 | **Extracting key sentences → verdict** | `quoteSpans[]` — verbatim + exact char offsets, **plus the mechanism span** (#300 §B) | built (#306) |
| 5 | Evidence chain + verdict → verifier | deterministic gates run **first**, then **`v`** model | built; since PR #355 the verdict judges fidelity to the **cited paper**, not a headcount of agreeing strangers |
| 6 | **Verification → stored on Supabase** | `relationship_claims` · `edge_verifications` · `verified_edges`; blueprints → `rules` | **run end to end: 14 · 14 · 14, 11 servable.** The step after this one — edge → card — has not run |

**Beat 2 is the one to make legible.** "Flattened" is exactly right and it is a real design
decision: the keyword prefilter was *deleted*, not improved. #300 measured why — searching
`gut_comfort_score` yielded `gut` 99 hits, `comfort` **0**, while `depress` (45) and `anxi` (30)
were never searched, so ~75 relevant sentences never reached the model and two live runs returned
**0 claims**. And the fix is deliberately **not** a synonym map: *"a hand-maintained alias table
means a human must expand vocabulary before the system can research any new pair, which defeats
automated research."*

**Beat 4 must show the mechanism quote**, not just a highlighted sentence. This is the
differentiator and it is what #300 §B exists for:

> **Your gut comfort and mood have been rising together.**
> Research reports these move together — *"Gut microbes synthesise neurotransmitter precursors
> that signal to the brain via the vagus nerve."*
> — *Diet–Microbiome–Brain Axis and Mental Health* (2026), cohort evidence

Not *"research supports this link"* — that is what every wellness app claims. The mechanism is
carried as a **second verbatim quote span**, never a paraphrase, because a paraphrased pathway is
exactly where invented biology appears.

**Beat 5 carries the decision content from the old Slide 4** — the decorrelation invariant,
`family(verifier) !== family(synthesis)`, unconditional and fail-closed, no flag and no test-mode
escape. Show that the verifier is a **different vendor family** from the synthesiser.

### §5 · biotope walkthrough → the client surface

Logging flows, Bristol/urine named-scale visuals, quick counts with bounded custom entry.
All landed in PR #329. Fast and short — this is context, not the argument.

### §6 · Insights animation → #300 step 6

| Animation beat | Internal |
|---|---|
| Week of metrics processed into trend / edge / personal shapes | `compute-baselines` → `evaluate-signals` (Deno edge functions) |
| Matching against the database | rules engine matches a week of user data against the `rules` table |
| Pulling insights out | `insight_cards`, `producer ∈ {rules, edge, personal}` — **measured 43 `personal`, 2 `rules`, 0 `edge`**; the `edge` arm is built but has produced nothing |
| Surfacing onto the app | m5b card render + provenance panel |

**Non-matching signals → the gap ledger.** Owner has **excluded the gap ledger from the MVP**, so
it appears in §8 as future work, not here as a live component.

### §7 · Cards + evidence chain → #300 step 6, second half

**Evidence is never LLM-processed.** The card *summary* is rendered by the **`a`** model; the
paper name, link and **verbatim quote** are surfaced as-is. The animation and the capture must not
imply the quote was generated.

### §8 · Living app → future

Gap ledger grows the corpus from unmatched demand. This section carries the old Slide 5 "honest slide"
content, which the judging criteria reward most: **never cut it.**

> **Zebra and Viceroy must come out of this slide.** The owner's running order named them, but **issue
> #277 quarantines every support-model training and evaluation claim** — in both directions, so "trained
> but not at benchmark" is as barred as a performance figure. The support models are non-serving and
> CI-enforced against import. Say only that custom models are research-only and serve nothing, or say
> nothing. Restore them if and when #277 clears.

---

### The one thing this running order must not promise

§7 shows cards with an evidence chain. **PR #342 wrote that this promise "cannot currently be paid
off" because every card was hand-authored scaffolding. That is now only partly true, and the exact
boundary is the single most important honest sentence in this submission:**

> **The research pipeline has produced verified edges. It has not yet produced a card.**

Measured on the hosted demo project, **2026-08-02**:

| `relationship_claims` | `edge_verifications` | `verified_edges` | `insight_cards` |
|---|---|---|---|
| **14** | **14** | **14 — 11 servable** (8 `high`, 3 `mid`, 3 held) | **45 — 43 `personal`, 2 `rules`, 0 `edge`** |

So §4 → §6 → §7 is one continuous promise — *we read papers → we verify them → we match them to your
week → here are the cards*. **§4 and §6 now pay off; §7 does not.** The chain is real up to
`verified_edges` and stops one step short of a rendered card.

**What you may say over §7, and what you may not:**
- **May:** "Fourteen edges have been verified; eleven are servable." That is a measured hosted fact.
- **May not:** anything implying a card on screen came from a paper. **Zero cards have
  `producer='edge'`.**
- **May:** show the 43 `producer='personal'` cards, because they are honest about exactly this gap.
  They render as *"Still researching: X and Y"* and state in the body: *"This is an unverified
  personal observation from your own data only — we have not found published research for this
  pairing yet and are still researching it."* (`generate-insights/render.ts`, `PERSONAL_CARD_TEMPLATE`.)

**That last point is a feature, not an embarrassment — film it deliberately.** The distinction between
*"research supports this"* and *"only your data so far"* is the product's whole thesis, and the app
draws it in user-facing copy without being asked to. A card that says "still researching" while the
animation says "we verify against papers" is coherent and honest; it is the system declining to borrow
credibility it has not earned.

**The failure mode this document exists to prevent is unchanged:** do not film a card while the
animation claims it came from a paper. The narration must not close the gap the data leaves open.

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

> **The Run 4 script does not run here.** [`hack-mvp-demo-script.md`](../../../development/run4/hack-mvp-demo-script.md)
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

**All figures re-counted directly from `data/corpus/papers.jsonl` (60 MB) on 2026-08-01. The earlier
`1,298 / 870 / 845` in this section is superseded** — the corpus grew from 1,232 to over 21,000 records
that day after a seed-list fix. Treat these as a timestamp, not a total, and re-count before recording.

| Measure | Counted 2026-08-01 |
|---|---|
| Manifest records | **21,823** |
| `status = discovered` | **20,912** |
| `status = fetched` | **911** (all with extracted full text) |
| Full text > 5,000 chars — **the usable figure** | **894** |
| Full text > 20,000 chars | 768 |

> ## The one number discipline for this whole video
>
> **"Discovered" is not "usable."** 21,823 records versus 894 usable papers is a ~24× gap. Never say a
> bare total. Every spoken or on-screen count must carry its tier:
>
> - **21,823 records** — what the manifest holds. Mostly metadata hits.
> - **911 fetched** — what we actually hold the object for.
> - **894 with usable full text** — the only tier a claim can be grounded in. **Quote this one.**
>
> Do **not** quote **6,158**. That is what the deployed console displays: a stale hosted projection that
> **cannot be refreshed from CI** (§10). It is not a current count of anything.

Real DOIs, real titles, real character counts. You can film the local index and quote the tiered numbers.

### What is filmable, and what is not

| Surface | Filmable? | Evidence |
|---|---|---|
| nao **Overview** — corpus dashboard | **Yes** | Reads `corpusStats` from D1 (`overview/page.tsx:12`); D1 is populated |
| nao **Papers** — list, FTS5 search, facets, sort | **Yes** | Reads the D1 index directly (`papers/page.tsx:11`) |
| nao **Ingest** / **Loader** / **Models** | Chrome renders; underlying state thin | Panel components; treat as B-roll, don't dwell |
| nao **Claims** | **Yes — 14 rows** | `relationship_claims` = 14 hosted |
| nao **`/paper/[uid]`** detail | **Yes, as a reduced record** | PR #354 removed the 404: when the R2 object is out of reach it renders `IndexRowDetail` from the D1 row instead. It only 404s if the index row is missing too. **Say "reduced record" if asked — do not present it as the full paper object** |
| Evidence chain in biotope | **Renders empty in the active deck** | 14 verified edges exist. **0 ACTIVE cards have `producer='edge'`.** One archived card does — `edge:gut_comfort_score|correlates|mood_score`, generated 2026-08-01T16:52Z, title "Research-linked pattern: Gut comfort and Mood moved together" (measured 2026-08-02 as `test@ourobion.com`). It is reachable via the Archive surface, not the insights deck. Do not narrate it as what a user normally sees |

### The numbers you must not contradict

Read directly from the hosted Supabase demo project on **2026-08-02**:

| `relationship_claims` | `edge_verifications` | `verified_edges` | `insight_cards` |
|---|---|---|---|
| **14** | **14** | **14 — 11 servable** (8 `high`, 3 `mid`, 3 held) | **45 — 43 `personal`, 2 `rules`, 0 `edge`** |

`composed_insights` is populated. Verdicts across the 14: **1 `supported`, 10 `partial`, 2 `uncertain`,
1 `unsupported`**, confidence 0.72–0.92.

**The pipeline has produced published edges. It has not produced a card from one.** That is the line to
hold — §1's promise section states it in full, and Slide 5 narrates it.

**Spend — from the machine-local `data/llm-router/ledger.json`, all-time:** **US$1.80 over 59 calls** ·
45 OpenAI calls (of which US$1.58 is the 40-call 2026-08-01 synthesis batch, ≈US$0.04/paper) · **Agnes
10 calls at exactly US$0**, that plan being priced at zero until 2026-08-08.

> Two cautions on that figure. Earlier drafts said *"US$1.118 OpenAI · Agnes 18/50 calls"* — the spend was
> stale and **"18 of 50" is not verifiable from this repository**; the plan quota is vendor-side. Second,
> the ledger is **gitignored and machine-local**, and it records 10 Agnes verifier calls on 2026-08-01
> against **14** hosted verifications. Those two do not reconcile from here — the verification pass may
> have run on another machine or worktree with its own ledger. Quote the USD total as "measured locally,
> provider billing authoritative", and do not present the ledger call count as the pipeline's call count.

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

Annotate with the real figures, each carrying its tier: **21,823 records · 911 fetched · 894 with usable
full text** (re-count before recording, §11).

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

> ## ✅ R0 IS CLEARED — this slide is now safe to record
>
> *Verified by executing `llm-router check-config` at head on 2026-08-01.* The tool's own verdict is now:
>
> ```
> Decorrelation: OK — synthesis=openai, verifier=agnes (independent families enforced)
> ```
>
> The TEST-MODE override block that previously forced all six nodes onto OpenAI **no longer exists in
> `tools/llm-router/src/`**, and `router.config.json` routes `synthesis → gpt-5` (openai) and
> `verifier → agnes-2.5-flash` (agnes). Earlier revisions carried a 🛑 stop-block here reporting
> `Decorrelation: VIOLATED (allowed by TEST-MODE)`; **that state is gone and the stop-block was wrong to
> leave standing.** Nothing on this slide needs the TEST-MODE label any more.
>
> Two constraints still apply to what you may say over it:
> - Agnes ran and 11 of 14 edges are servable. Slide 4 may claim the *invariant* is real and enforced,
>   and that verification produced servable verdicts. It may **not** imply the science is settled: since
>   PR #355 a verdict answers *"is this claim faithful to the one paper it cites?"* — not *"is this true?"*
> - The free Agnes pricing **expires 2026-08-08**. After that the verifier leg stops until it is renewed,
>   and only the owner can renew it. If you record after that date, re-run `check-config` first.
>
> Re-run the command yourself before recording rather than trusting this paragraph — that is the whole
> point of the pre-record checklist (§11).

**The separation is by platform, not by architecture** — *this part is true of the declared config.*
`familyOf()` returns a `VendorFamily`, so a "family" here is the provider. When re-armed,
`cli.ts:522-523` enforces `family(verifier) !== family(synthesis)` unconditionally at config load and
`offlineAcceptance.ts:207` throws `configured families are not separated`.

**Say "platform" or "provider" on camera, not "family."** "Family" reads as an architecture claim we
are not making; the actual property is two models from different companies, with different corpora
and different weights, which is what makes the blind spots independent.

**Agnes is the right model to name, and it is genuinely in the path.** The adversarial role is precisely
the one that requires a model whose training data and weights are *not* shared with the writer. Agnes AI
is a sponsor whose team is among the judges (`hackathon-rules.md:78,81`). The ledger records **10 Agnes
calls on 2026-08-01 at US$0**, and the raw responses carry provider attestation `agnes-2.5-flash`. The
earlier "18 of 50 calls" figure is not reproducible from this repository — do not use it; the 50-call
plan quota is a vendor-side number we cannot observe.

### Slide 5 · The honest slide · 25s — **never cut**
Headline: **14 verified edges. 0 cards made from one.**
- The corpus is real: **21,823 records, 894 with usable full text** — and those are different numbers
- Synthesis ran at batch scale: **40 papers → 20 claims, 12 cited blueprints**, US$0.04 a paper
- The verifier ran: **14 edges checked, 11 servable** — judged on fidelity to the paper each one cites
- **The last mile is missing.** No card carries `producer='edge'` yet. Spend to date: **US$1.80**

> **Wording is load-bearing on this slide; do not improvise it.** Three failure modes:
> - Saying **"blocked"** or **"zero verified edges"** — both false now. 14 exist, 11 servable.
> - Saying **"the verifier validates our edges"** or **"the science backs this"** — false. A verdict says
>   the claim is a faithful reading of *one cited paper*. It is not a finding about the literature.
> - Showing a card while implying it came from a paper — false. **0 cards have `producer='edge'`.**
>
> The defensible framing: **"the chain is real up to the verified edge, and stops one step short of a
> card — and the app says so to the user rather than papering over it."** Naming the exact boundary is
> stronger than either overclaim, and it is true.

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

**Capture N1 (25s).** "This is nao, our operator window into that corpus. Twenty-one thousand records
discovered. Nine hundred and eleven actually fetched. Eight hundred and ninety-four with usable full text —
and that last number is the only one that matters, because a paper we can't read the body of is a paper we
can't ground a claim in. We keep those three numbers apart on purpose; collapsing them is how a corpus gets
advertised at twenty-four times its real size."

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

**Slide 5 (25s).** "So here is the honest state. The corpus is real, synthesis ran across forty papers for
about four cents each, and Agnes checked fourteen edges — eleven of them are servable. But read that
precisely: a verdict says the claim is a faithful reading of the one paper it cites. It does not say the
science is settled. And no card in the app has come from one of those edges yet — the last step isn't
built. The app says so itself: it labels those cards 'still researching', and tells you outright it's an
unverified observation from your own data. We could have hardcoded a plausible edge and you would not have
known."

**Slide 6 (5s).** "Everything we've claimed is in the write-up, with the evidence attached."

---

## 9. Never say these

| Don't say | Say instead |
|---|---|
| "Built for ASEAN" / "for Southeast Asia" | Nothing — drop the regional framing. No localisation, regional data source or market-specific feature shipped, so the claim has no evidence behind it |
| "A different model *family*" | "A different **platform** — OpenAI writes it, Agnes checks it." "Family" reads as an architecture claim we aren't making |
| "The verifier is blocked" / "zero verified edges" | "It ran: 14 edges checked, 11 servable" — both older phrasings are now false |
| "The verifier validated it" / "the science backs this" | "The verdict says the claim is faithful to the one paper it cites — that is not a finding about the literature" |
| "The literature doesn't support these claims" | "Our retrieval has no alias map, so corroboration counts measure our own vocabulary, not the science" |
| "Only one other study backed this up" as a *template* | It is genuine model-written caveat prose on the stored records — quote it as a real caveat, not as a hardcoded string |
| "We select the relevant passages and send those" | "The whole paper goes in — the model picks and quotes its own evidence" (#300 §A; there is no passage-selection stage) |
| "The card explains the mechanism" | "The card *quotes* the paper's own mechanism sentence, verbatim — we never paraphrase a pathway" |
| "21,823 papers" / any bare corpus total | Always give the tier: "21,823 records, 911 fetched, **894 with usable full text**" |
| "6,158 papers" | "894 with usable full text" — 6,158 is the deployed console's stale projection |
| "Verified research edges power the app" | "14 verified edges exist; **no card has been made from one yet**" |
| "This card is backed by research" (of any card on screen) | "This is a personal observation from your own data — the app labels it *still researching*" (**0 cards have `producer='edge'`**) |
| "3–5 blueprints per paper" | "We designed for 3–5 and measured 0.3" |
| "The brain pipeline runs in CI" | "It cannot be dispatched — the workflow isn't on the default branch" |
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
| **R0** | ~~Slide 4 claims a decorrelated verifier that is switched off.~~ **CLEARED 2026-08-01**: `check-config` reports `Decorrelation: OK — synthesis=openai, verifier=agnes`, and the TEST-MODE block is gone | **Resolved** | — | Nothing to do. Re-run `check-config` before recording anyway (§11) |
| **R0b** | **Narration upgrades "11 edges are servable" into "the verifier validated the science."** A verdict judges fidelity to a single cited paper, nothing wider | **High — it is the natural thing to say** | **Fatal — it is the one materially false claim still available to say**, and the rules treat that as disqualifying | Rehearse §8's Slide 5 wording verbatim; never improvise this segment |
| **R0c** | **A card on screen is narrated as paper-derived.** 0 cards have `producer='edge'` | **High — §7 invites it** | **Fatal** | Say "still researching / your own data only". See §1's promise section |
| **R0d** | **Agnes free pricing expires 2026-08-08**, after which the verifier leg cannot run and only the owner can renew it | Certain after that date | High — no re-recording or re-verification possible | Record before 2026-08-08, or get the renewal first. Re-run `check-config` on the day |
| **R1** | **nao login fails** — no `nao_members` row, or nao still pointed at hosted | **High until dry-run** | **Fatal** — nao is the video | §4. This is the #1 pre-record task |
| **R2** | macOS biotope build fails at head — last proven at `HEAD~323` | Medium-high | High — costs Capture B1 | Build the day before. `flutter clean`, `pod install` in `apps/biotope/macos`, retry; else Pixel AVD |
| **R3** | Someone clicks a paper detail page on camera | Medium | **Low since PR #354** — it renders a reduced index record, not a 404 | Safe to click. Do not describe the reduced record as the full paper object |
| **R4** | Docker not running | High — it isn't now | Fatal | Start Docker Desktop; confirm `docker info` |
| **R5** | `.env.public` missing → biotope throws at startup | High on a fresh checkout | High | §5; the `flutter analyze` warning is the tripwire |
| **R6** | Edge function returns `internal auth denied: not_configured` | Medium | Medium | Secret file not passed to `functions serve`, or wrong header. It is `x-ourobion-internal-secret` |
| **R7** | Seeding fails — user doesn't exist | Medium | Medium | Sign up first (§5); RLS keys on `auth.uid()` |
| **R8** | Narration drifts into diagnostic language | Medium | **High** — violates a non-negotiable principle | Rehearse §8 and §9 |
| **R9** | Video runs over 3:00 | High on first cut | **Fatal** — hard event rule | Cut in the §1 order. Never cut Slides 4 or 5 |

> **Two workflows are not fallbacks — neither can run.** Re-verified 2026-08-01 by querying the API:
> `gh run list --workflow=nao-d1-etl.yml` and `--workflow=brain-pipeline.yml` both return
> **`HTTP 404: workflow not found on the default branch`**. `workflow_dispatch` resolves the definition
> from the default branch, and `origin/main` carries only `ci.yml` and `brain-ingest.yml`. So:
> - **the D1 ETL cannot refresh the hosted index** — which is exactly why the deployed console still shows
>   ~6,158 and cannot be corrected before recording. Local `npm run etl` is the only refresh path, and the
>   index is already populated anyway (§3).
> - **the cloud brain pipeline has never run and cannot be triggered** (#343). Do not narrate it as CI.
>   The 14 verified edges were produced by a local run, not by the cloud workflow.
>
> Correct label for both: **Configured target; deployment unproven.**

---

## 11. Pre-record checklist

- [ ] `git fetch && git log -1 origin/dev-phase2-run4` — re-stamp the anchor SHA and timestamp above
- [ ] **`llm-router check-config` reports `Decorrelation: OK`** — was green on 2026-08-01 (R0 cleared), but
      confirm rather than assume, and confirm the Agnes price has not expired (R0d). Keys must be exported
      for the router to see them — it reads `process.env`, and brain-ingest's `.env` parser does **not**
      export into it:
      ```bash
      set -a; . tools/brain-ingest/.env; set +a
      cd tools/llm-router && ./node_modules/.bin/tsx src/cli.ts check-config
      ```
      Without that, every node reports `key absent` even with a fully populated `.env`.
- [ ] **nao dry run: `npm run dev` → sign in → Overview and Papers render** (R1)
- [ ] **Re-count the corpus and update §3 — it moves fast** (it went 1,232 → 21,823 in one day). Count all
      three tiers, never just the total. If the numbers moved, update §3, Slide 3's annotation, Slide 5 and
      the §8 narration together — they quote the same figures and drifting them apart is how a false number
      reaches the video.
- [ ] **`flutter run -d macos` reaches sign-in** (R2)
- [ ] `flutter analyze --no-pub` clean · `flutter test --no-pub` green
- [ ] `npx supabase start` up; `migration list --local` shows all **44**
- [ ] §5 seeding reports rows; both edge functions return success; Insights renders a card
- [ ] **Re-read the four hosted counts** (`relationship_claims`, `edge_verifications`, `verified_edges`,
      `insight_cards` split by `producer`). §3 records 14 · 14 · 14 (11 servable) · 45 (43/2/**0 edge**) as
      of 2026-08-02. **If a `producer='edge'` card now exists, §1's promise section, Slide 5 and the §8
      narration all change materially — rewrite before recording.**
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

**Related:** [`writeup.md`](../submission/writeup.md) · [`system-connection-map.md`](./system-connection-map.md) ·
[`hack-mvp-demo-script.md`](../../../development/run4/hack-mvp-demo-script.md) (Run 4, Windows, historical) ·
[`insight-slice-demo-runbook.md`](../../../development/insight-slice-demo-runbook.md) ·
[`phase2-demo-runbook.md`](../../../development/phase2-demo-runbook.md)
