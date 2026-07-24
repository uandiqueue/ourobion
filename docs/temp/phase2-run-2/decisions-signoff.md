---
title: Phase-2 Run 2.0 — Decisions for Sign-off (D-entries)
summary: Every non-trivial choice the Run-2.0 orchestrator made autonomously — design, schema, contract, config, test-strategy, the OpenAI-only decorrelation override, any ADR/architecture amendment intent. Jayden's retroactive-review queue. shared/- or ADR-touching entries carry the B8 2-reviewer flag. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 — Decisions for sign-off

Format per entry: the choice · alternatives rejected · why · source unit. Amendments append
(`Dn AMENDED`), never rewrite. C-entries (numeric/config values) are folded in here as `C2.x` rows
to keep Run 2.0's review surface in one doc.

## D1 · Run in a dedicated worktree; carry the run inputs onto the run branch — U0

- **Choice:** run in worktree `C:\project\ourobion-run2` on `feat/phase2-run-2/*` off
  `origin/dev-phase2` @ e185cf0; commit the run's input docs (`next-build-optimizations.md` Run-2.0
  version, the adversarial-verdict doc, the orchestrator prompt) plus Jayden's two prep diffs
  (`.gitignore` non-anchored `.open-next/`/`.next/` for graphify; `tools/brain-ingest/.env.example`
  LLM-provider block) in the U0 bootstrap commit.
- **Alternatives rejected:** (a) build in the main checkout — rejected: it sits on `signoff/phase2`
  with Jayden's uncommitted sign-off work (launch prompt says worktree when the checkout is in use);
  (b) leave the input docs uncommitted — rejected: they exist ONLY in the main checkout's working
  tree, so a fresh resume session (PART R) could not reconstruct the run's inputs from the branch.
- **Why:** resumability requires branch + tracking docs to be the complete state; the inputs are part
  of that state. Note the memory that solo runs skip worktrees is superseded here by the launch
  prompt's explicit instruction (checkout in use).

## D2 · OpenAI-only posture = TEST-MODE decorrelation override (ADR amendment intent) — U1 (planned)

- **Choice (per launch prompt PART 3 — Jayden's decision, recorded here for retro-review):** all
  router nodes point at gpt-*/o* ids on `api_worker`; the synthesis↔verifier family-decorrelation
  invariant is overridden behind an explicit, clearly-labelled TEST-MODE flag. Every verifier result
  this cycle is worded "scaffolded + unit-tested", NOT "demonstrated independent verification", in
  demo/UI and logs.
- **ADR amendment intent:** touches the accepted decorrelation invariant (memory 0012 / ADR-0012
  lineage, C6/O7). Accepted ADR bodies are immutable — this entry IS the recorded amendment intent;
  flagged for retro-review. The general O7 fix (family(verifier) !== family(synthesis)) still lands
  with B5, unchanged.
- **B8 flag:** any shared/-touching implementation detail will be listed on the owning unit's entry.

## D3 · nao writes biotope tables for the simulated-data loader (design-contract deviation) — U6 (planned)

- **Choice:** implement O11 as a nao API route + page writing simulated rows into biotope's existing
  storage-primitive tables via Supabase (shared identity), provenance-flagged as simulated, dev-only.
- **Alternatives rejected:** (a) a biotope-side loader screen — rejected: PART 1 step 1 says "via a
  nao UI" (Jayden's demo definition); (b) hand-run SQL — the exact thing O11 exists to remove.
- **Why flagged:** docs/shared/biotope-nao-link.md says the apps share only identity/contracts/the
  verified_edges layer and nao never touches biotope's per-user health tables. O11 is Jayden's locked
  decision and supersedes for the demo, but the deviation is recorded for retro-review (and the link
  doc may need an amendment note next cycle). **B8-adjacent: retro-review.**

## D4 · Unit decomposition + sequencing of the FINAL worklist — U0

- **Choice:** 12 build units as in the orchestration log; contract/backend units (U1–U5) before app
  units (U6–U11); U4 carries the gap_ledger migration used by both O18 and O9; the nao CI job rides
  the first nao code unit (U6); e2e + runbook is its own final unit (U12).
- **Alternatives rejected:** (a) one-unit-per-O-item (15+ PRs, more gate runs, no cohesion — O17+O20
  are one contract-hardening seam; O16+O18 edit the same handler blocks); (b) backend-all-then-UI-all
  (delays integration feedback on the nao seam until late).
- **Why:** matches the dependency spine (O15→feature b; O16→card demo), keeps each PR one review
  surface, and caps loss-on-halt at one unit.

## D5 · evaluate-signals cron gap: fix via the U5 trigger only, not a new cron — U0/U5

- **Choice:** the shipped schedule never runs evaluate-signals (no cron, no config.toml entry). The
  demo path is the U5 on-demand trigger, which runs all three functions in sequence — so the demo
  does not need the cron. Adding the missing cron/schedule is recorded for Jayden (human-decisions
  H3), NOT done autonomously.
- **Why:** production scheduling policy (cadence, cost, pg_cron config prereqs per memory 0005) is a
  product call the backlog does not answer; the run's boundary rule says record, don't resolve.

## D6 · TEST-MODE flag shape + router surface changes — U1

- **Choice:** `testMode: { reason: string }` in router.config.json (non-empty reason mandatory;
  reason text records posture, date, Jayden attribution, revert instruction). With the flag, the two
  decorrelation clauses downgrade to a loud warning; without it, validation hard-fails exactly as
  before (test-proven). Warning sink injectable (`validateConfig(raw, {warn})`, default
  console.warn). `route()` results + `checkConfig` carry testMode state; `decorrelation.ok` widened
  `true` → `boolean` (false only reachable under TEST-MODE; sole consumer updated in-commit).
  Exported label constant: `scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation
  OFF)` — downstream units MUST stamp verifier verdicts/UI/logs with it.
- **Alternatives rejected:** env-var flag (invisible in the committed config = not "clearly
  labelled"); silently removing the invariant (forbidden — O7's general fix still lands with B5).
- **Source:** U1 (PR #124). Anthropic/google provider + price rows kept so re-arming decorrelation
  is config-only.

## C2 · Run-2.0 router config values — U1

| id | value shipped | alternatives | rationale |
|----|---------------|--------------|-----------|
| C2.1 | synthesis + verifier → `gpt-5`; seeder/phrasing_card/extract_assist/report_narrative → `gpt-5-mini`; ALL routes `api_worker` | o4-mini for cheap tier | PART 3 mandates gpt-*/o* on api_worker; gpt-5 for the two quality-critical nodes, mini for volume nodes |
| C2.2 | `perDayUsdPerNode` 1.00 USD; per-run output-token cap 60000; hard-stop 0.95 kept | prior $5/day/200k | 20 SGD run cap ⇒ keep the guardrail well under it (6 nodes × $1 = worst-case $6/day) |
| C2.3 | price row `gpt-5-mini: 0.25/2.0 USD per MTok, provisional: true` | — | OpenAI list price at ship time; provisional pending O8 calibration |

Operational note (U1 smoke): gpt-5-family models spend ~70 reasoning tokens on trivial prompts —
undersized maxOutputTokens yields empty visible text. Size generously in downstream units.

## D2 AMENDED (2026-07-24) · Anthropic key loaded — optional decorrelated verifier, ≤ 2 SGD

- Jayden loaded ANTHROPIC_API_KEY (tools/brain-ingest/.env) mid-run with a separate **2 SGD hard
  budget**, "just in case you need it for the verifier (different model)". The OpenAI-only posture
  (D2) remains primary; switching the verifier node to a claude-* id is at the orchestrator's
  judgment (likely decision point: U12 e2e). If exercised: TEST-MODE stays on (the pre-O7 clause
  `family(verifier) !== 'anthropic'` still trips), verdict labels change to "decorrelated but not
  attested/ablated" — NOT "demonstrated" — and the switch + spend get their own D-entry/ledger rows.
  Launch prompt PART 0 + PART 3 amended in both copies (main checkout + run branch).

## D7 · U2 implementation choices (verifier grounding) — U2

- **Evidence bound:** `DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE = 700` (config-overridable via
  RetrieveOptions/mapper opts), sentence-level selection scored by distinct matched terms,
  document-order emission, truncate-never-drop for a ranked hit's top sentence.
- **Locator shape:** `chars:<start>-<end>` into the CorpusDoc canonical text (same offset space as
  QuoteSpan); external candidates use `abstract:0-<n>`. Honest-carry rule: external candidates carry
  only what exists (abstract), never fabricated passages.
- **Fixture corpus:** 5 gut/mood CorpusDocs incl. one deliberate decoy (sleep/steps) + matched
  claims fixture; the claim's cited paper is in-corpus for quoteCheck but echo-excluded from
  retrieval. CLI: `--corpus` / `--edges-dir`; empty-corpus runs WARN loudly.
- **[B8]** shared/brain: `EvidencePassage` type + optional `Citation.evidence` (additive,
  AssertExact-guarded) — 2-reviewer retro-review. Note: shared/tsconfig excludes brain/ and shared's
  npm test is a no-op echo — the schema guard was verified through edge-loader (its static
  consumer); flagged for the retro-review to consider giving shared/brain its own typecheck.
- **Prompt contract:** `VERIFIER_PROMPT_VERSION` bumped to `verifier-2026-07-24.1`.

## D8 · U3 implementation choices (contract hardening) — U3

- **[B8] O17 clause shape:** superRefine on the shared verification schema — servable verdict
  (`supported`/`partial`, inlined to mirror SERVABLE_VERDICTS) requires `spansFound >= 1 AND
  allPresent === true`; conditional on verdict so zero-span `uncertain`/`refuted` records stay
  valid (intentionally retained). Band code (shared/brain/index.ts) untouched — the loader
  zod-validates every line before banding, so the schema clause alone makes bad records unloadable
  (the brief's touch-index.ts condition was not met).
- **Pre-existing test retargeted, not weakened:** the old A3 "zero-span accepted" test rode the
  `partial` fixture — exactly what O17 now forbids; retargeted to the `uncertain` fixture so A3's
  producer-encoding guarantee survives on a non-servable carrier. Flag for reviewers: this is
  O17's intended tightening, not a lost invariant.
- **O20 seams:** synthesis rejects with new typed reason `'copy-gate'` (follows existing rejected-
  claims pattern; `validateCopy` is a REQUIRED ProcessContext field, runtime-imported mirror of
  loadClaimValidator so shared/ stays out of brain-ingest's static type graph); loader re-checks as
  a line-numbered hard-fail (matches its active-metric convention).
- Mutation proof for acceptance (iii): schema clause + loader gate git-stashed → both O17 tests and
  the O20 loader test fail; restored → 50/50 + 340/340.

## D9 · U4 implementation choices (card semantics + gap ledger) — U4

- **Gap-ledger shape: architecture §A1 VERBATIM, overriding the dispatch brief's suggested shape**
  (per the brief's own architecture-wins rule): `(metric_a, metric_b, scope pk, status ∈ 8 §A1
  values, personal_signal, lit_candidate, completeness, demand, last_ingest_attempt, corpus_version,
  last_status_change)` + `metric_a < metric_b` CHECK. The brief's `reason` values map to §A1
  statuses via `gapStatusFor` (research_context→blocked-completeness per §S7; contradiction→
  needs-review; no-edge→personal-signal-no-edge/personal-null); `object_only_signal` has no §A1
  status → carried in `lit_candidate.orientation`. Serve path writes `scope='aggregate'` only; no
  user ids (§A1 privacy invariant); authenticated SELECT restricted to aggregate rows; UPSERT via
  `record_gap_events(jsonb)` RPC, service_role-only EXECUTE.
- **O16 seam choice:** pure-layer `ClassifiedPattern.cardEdge` (null for object-only) + single
  `rendersCard` policy fn + render-level fired-metric assertion (defense in depth); `topEdge` now
  PREFERS subject-endpoint consistent edges so card metadata/insight identity stay coherent.
- **Demand semantics:** per-(user, pair, status) dedupe per run → demand = demanding-users count;
  last-write-wins status until the weekly A1 classifier (later cycle) owns resolution; branch-4
  idiosyncratic BOTH renders the personal card AND ledgers demand (architecture's "does BOTH").
- **Carry-forward:** contradiction's shared/brain `needsReview()` edge-flag not wired (shared/ was
  out of U4 scope) — owned by a later unit / run-end backlog note.

## D10 · U5 implementation choices (trigger + provenance + prune) — U5

- **Empty-input prune policy (O19/A14):** failed S2 fetch → 500 before prune; successful ZERO-row
  read → SKIP prune (suspect-input posture — a mass wipe is indistinguishable from a broken view at
  that seam). Leftover rows stop refreshing and fall to the freshness filter: two-step decay, never
  a one-shot wipe.
- **Freshness filter shipped in-unit:** `SNAPSHOT_FRESHNESS_DAYS = 7` (one baseline window) as a
  single `.gte(computed_at)` on generate-insights' baselines fetch; union line untouched. C-entry:
  value 7, provisional, pending O2/O8-style calibration.
- **Provenance RPC:** `get_insight_provenance(bigint)` — brief said uuid but insight_cards.id is a
  bigint identity column; SCHEMA WINS. SECURITY INVOKER (caller's RLS; anon → 42501 proven).
  Verdict pinned to the CITED verified_at version (not newest); edges = the card's own edge_refs
  (O18-filtered). Null result deliberately conflates not-found/not-owned.
- **No per-user pipeline scoping:** none of the three engines parses a request body — the trigger
  runs the full pipeline (adding scoping = out of scope).
- **evaluate-signals config.toml entry added** (it had none) — cron still NOT added (H3, Jayden's).

## D11 · U6 implementation choices (nao loader) — U6

- **Backfill semantics:** first load ends TODAY (the engine's evaluated day must have a value or
  nothing fires); once the range reaches today, "N more days" extends history BACKWARD
  (forward-to-today takes priority when real days have passed). The only shape satisfying both
  O11's "up to today" and a single-sitting demo of steps 1→4. Dip scenario anchored to today;
  loaded days never rewritten. Defaults: 14 first / 7 increment / 60 max; seed `run2-demo`.
- **Provenance mechanism:** wearable_daily uses its EXISTING `source` column; daily_gut_rows gained
  additive nullable `data_origin text` via new migration (NULL = real; value
  `simulated:run2-demo`). No guard/contract change (guards parse only the original migration file).
- **Auth-test repair in-commit:** two pre-existing nao jose-stub tests were stale (missing
  `role:'authenticated'`, invisible pre-CI since nao was never gated); repaired mechanically so the
  new CI job lands green — flagged for reviewer as unrelated-but-necessary.
- **Honesty holds on fresh DB:** no hand-seeded verified_edges — edge/personal card paths stay
  empty, gap_ledger carries the demand (110 personal-null rows), brainScopeSkips logged.
- **Harness note:** the U6 subagent run carried a transient harness security-classifier error
  (stage-2); actions reviewed by the orchestrator — local-stack admin user + session-cookie route
  testing, exactly per brief. Recorded for transparency.

_(Further D-entries appended per unit as the run executes.)_
