# Nao demo honesty: fabricated budget telemetry and paper-detail 404s

memory: A hardcoded literal must never carry a fresh timestamp. `BrainPipelinePanel` shipped an
`OWNER_SNAPSHOT` frozen object stamped `observedAt: '2026-08-01'` under the heading "Dated owner
ceiling snapshot", so a viewer read frozen numbers as live budget governance. The real source
(`llm_router_status` / `llm_router_spend`, published by `tools/llm-router/scripts/publish-status.ts`)
was already being fetched by the very same component. When a panel needs a figure, check whether the
component already holds the real one before writing a constant. Also: a zero can be a measurement —
Agnes bills at nothing, so `verifier` genuinely records calls at US$0.00, and rendering that as
"0.00% of cap · OK" is as misleading as a fabricated number in the other direction.

## Attempted

- Cut `fix/nao/demo-honesty-budget-telemetry-papers-404` from `origin/dev-phase2-run4` @ `e0c6077`
  in an isolated worktree. Two confirmed audit findings, not re-litigated.
- Traced the budget figures to their real source before changing anything: `/api/models` →
  `llm_router_status` + `llm_router_spend` (UTC today) + `llm_router_cap_overrides`, all projections
  of `router.config.json` + `data/llm-router/ledger.json`. Confirmed the panel already fetched them
  and already had an honest empty state for its "Published spend boundary" section.
- Diagnosed the paper-detail 404 empirically rather than by inspection: the local Miniflare R2
  bucket keyed on `bucket_name: "ourobion-corpus"` holds **0 objects** (`_mf_objects` = 0, no
  `blobs/` directory), while local D1 keyed on the `database_id` holds **21,813 real `papers` rows**.
  The list works because `scripts/etl.mjs` writes D1 over the S3 API with SigV4 and
  `wrangler d1 execute --local`; nothing in the repo ever writes `meta/*.json` into local R2.
- Checked the `papers` DDL (`apps/nao/src/db/schema.sql`, 25 columns — there are no D1 migrations)
  column-by-column against every field the detail page renders, before proposing any fallback.

## Changed

- **`lib/modelsControl.ts`** — added pure, IO-free helpers: `PROVIDER_PREFIXES` /
  `providerFamilyOf()` (model-id prefix → provider family, mirroring `router.config.json`'s
  `providers` table because O10 forbids nao reading `tools/` files), `hasUnpricedCalls()`, and
  `rollupByProvider()` which groups published status rows by family and sums calls, USD and
  effective day caps. Empty status yields an empty array by design.
- **`components/BrainPipelinePanel.tsx`** — deleted `OWNER_SNAPSHOT` entirely. The estimate block now
  renders a per-family rollup of the published rows (nodes, calls, US$ of combined day cap, percent),
  the snapshot's `published_at`, and the existing 1-hour staleness warning. When nothing is published
  it says so and shows no figure.
- **`components/ModelsPanel.tsx`** — deleted `RUN_CAP_SGD_OPENAI` / `RUN_CAP_SGD_ANTHROPIC` and the
  "Run 2.0 budget context" paragraph, replaced by the same derived rollup. Added a **`Calls today`**
  column (real telemetry the table was discarding). A node with recorded calls at US$0.00 now shows
  `n/a` for percent-of-cap and a `NOT USD-BOUND` badge instead of `OK`, with a footnote naming it.
- **`lib/d1.ts`** — added `PaperDetailRow` + `getPaperDetailRow()`, selecting the four columns
  `PAPER_COLUMNS` omits but the detail page renders (`full_text_char_count`, `storage_kind`,
  `storage_size_bytes`, `fetched_at`). `PAPER_COLUMNS` and the search path are untouched.
- **`lib/paperDetail.ts`** (new) — pure module that enumerates, as data, the nine fields D1 has no
  column for (`D1_UNAVAILABLE_FIELDS`), plus builders for the fallback's identifiers, provenance
  facts and tags. Null columns read `not recorded`, never `0` and never an em dash.
- **`paper/[uid]/page.tsx`** — on an unreachable corpus object the page now falls back to the index
  row instead of `notFound()`. Rendered as a visibly **reduced record**: an amber banner naming the
  nine unavailable fields, the Open-access block and the four unavailable provenance rows omitted
  outright, and a `detail__source` line on the full path saying it came from the corpus object. A uid
  absent from D1 too still 404s. `ClaimsPanel` reads Supabase and is unaffected.
- Tests: +12 (`modelsControl` rollup cases incl. the zero-priced node and the empty path;
  `paperDetail` honesty cases; `getPaperDetailRow` column and null cases). Extended the
  non-diagnostic copy gate to `ModelsPanel.tsx`, the paper-detail page, and `paperDetail.ts`.

## Decided

- **FIX 1 took option 1 (read the real values).** The coordinator ran `publish-status.ts` mid-task, so
  the tables hold real rows. Relabelling a frozen literal was rejected: real telemetry exists and the
  component was already fetching it.
- **The owner's SGD run ceilings (20 OpenAI / 2 Anthropic) are now shown nowhere.** They are real
  facts recorded in a run doc, but no machine-readable boundary carries them, so rendering them means
  reintroducing an unverifiable literal. Deliberate omission. The panel shows the caps that do exist.
- **The rollup asserts exactly one thing nao cannot read from a row: the model-id prefix → family
  map.** Everything numeric comes from a published row. An unknown prefix reports `unrecognized`
  rather than being folded into a neighbouring family.
- **FIX 2 took the labelled-D1-fallback option**, not remote bindings. Rationale below.
- **A bare 404 was itself a dishonesty**, not merely a broken link: it reads as "no such paper" about
  a record the list had just shown. The fallback fixes the claim, not just the status code.

## Left

- `publish-status.ts` is still a manual step, so both panels can show real-but-stale numbers. The
  `published_at` stamp and the 1-hour stale warning now appear on the brain-pipeline surface too, but
  that is a mitigation, not a fix — the router does not auto-publish per call.
- `test_mode` is now always `false` (R4-U3 removed the config block that could set it), so the
  TEST-MODE banner in `ModelsPanel` is dead code. Out of scope here; worth removing later.
- Agnes pricing expires **2026-08-08**. After that the `agnes-2.5-flash` price entry lapses and the
  `NOT USD-BOUND` reading may stop being meaningful. Outside this task's territory (`apps/nao/**`).
- `docs/shared/hackathon/submission/demo-runbook.md:105-108` claims 1,298 papers / 756 fetched / 542
  discovered. Local D1 actually holds 21,813 / 743 / 21,070. Not touched — outside territory, but the
  runbook's corpus figures do not match the corpus.
- The runbook and `apps/nao/README.md:107-109` still tell the reader that paper detail needs
  `wrangler dev --remote`. That is now only true for the *full* record; the reduced record works
  under plain `next dev`. Doc update deferred (outside `apps/nao/**` for the runbook).

## Blockers

- None. Both fixes landed without Docker, without Cloudflare credentials, and without a network call.

## Verification

- `npm run typecheck` — clean.
- `npm test` — **380 pass, 0 fail** (was 368; +12 new). Both copy-gate tests pass.
- `npm run lint` — no ESLint warnings or errors.
- `node tools/context_sync.mjs --check` — passed.
- `git diff --check` — clean.
- Not verified by running the app: the worktree has no `.wrangler/` state, so `next dev` here would
  show an empty list as well as an empty bucket. The fallback's data path is covered by injected-D1
  unit tests; the rendered page was not exercised against live bindings.
