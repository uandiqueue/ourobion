---
title: R4-U4 follow-on — trusted-edge plumbing for the U3 demo positive control
summary: Captured provider-returned model identity distinctly from configured fallbacks, projected artifact/attestation through the edge loader into the U4 columns, and made generate-insights fetch and fail-closed on them, with exhaustive positive/negative gate tests.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# R4-U4 follow-on — trusted-edge plumbing for the U3 demo positive control

Issue: #240 (blocks #179 and #184) · branch: `feat/brain/run4-u3-trust-plumbing`
(cut from `origin/feat/db/run4-u3-atomic-demo-loader`, PR #184's head)

Scope of this session: issue #240 steps **1–3 plus tests only**. Steps 4–5 (obtaining a genuinely
provider-attested verification, and rerunning the 14+7 / provenance / reject / B-PL15 flows) were
explicitly out of scope and were **not** attempted. **No LLM or provider call was made** — every
router in this session's tests is a local stub, and no artifact was hand-marked `attested`.

## Attempted

- Make the model identity a verification record carries say WHERE it came from, so
  `attestation_attested` can be true for provider-returned identities and nothing else (B-BR1).
- Populate the R4-U4 artifact/attestation columns from the edge loader, which the U4 migration
  deliberately left to a follow-on.
- Make `generate-insights` actually read those columns, so its fail-closed trust gate evaluates
  real data instead of the uniform NULL it has been seeing for every database-loaded edge.
- Cover the gate in both directions, with the negative matrix exhaustive over the failure modes.

## Changed

**1 · Provider-returned identity, captured at response time (`tools/llm-router`)**

- `src/types.ts`: new `ModelIdentitySource` (`provider-response` | `router-config` |
  `local-agent-mailbox`) and `ModelIdentity` (`model`, `source`, `providerAttested`, `family`,
  `returnedVersion`, `decorrelatedFromSynthesis`). `LlmResponse.modelIdentity` is **required**, so
  no route — and no test mock — can produce a response whose identity provenance is unknown.
  `LlmResponse.model` is retained and documented as a mirror for logs/ledger only.
- `src/routes/apiWorker.ts`: `providerAttested` is true only when the provider's own response body
  carried a usable model id; a missing/blank one falls back to the configured id with
  `source: 'router-config'`. Neither implemented surface (Anthropic Messages, OpenAI
  chat/completions) exposes a version distinct from the model id, so `returnedVersion` is `null`
  there — a genuine "no version", not "not captured".
- `src/routes/localAgent.ts`: mailbox fulfilments are `providerAttested: false` unconditionally —
  there is no provider response to attest.
- `src/router.ts`: fills the two config-derived members (`family`, `decorrelatedFromSynthesis`).
  Decorrelation is false under TEST-MODE by definition and `null` when a family is unresolvable;
  it is never `true` on missing information. `providerAttested` is decided at the route and is
  never rewritten here.

**2 · Producer side (`tools/brain-ingest`)**

- New `src/verify/attest.ts`: `buildAttestation` (undefined when no response; `attested` only for
  `provider-response` AND a non-sentinel string), `posturefor` ('live' only for an attested
  record), `canonicalJson` / `recordContentHash` (`sha256:<64 hex>` over the record's canonical
  bytes with `artifact` excluded), `buildArtifactRef`, and `NON_PROVIDER_MODEL_MARKERS`.
- `src/verify/verifier.ts`: **`verifierModel` is no longer overwritten with `response.model`.**
  That assignment was the collapse the issue names — one string that could mean either a
  configured id or a returned one. The returned identity now travels in `record.attestation`.
- `src/verify/enforce.ts` / `src/verify/types.ts`: records may carry `artifact` + `attestation`
  (mirrors of the shared `ArtifactRef` / `ModelAttestation`); the artifact ref is stamped last,
  over the finished record, so the hash covers the attestation too.
- `src/cli.ts`: the static sentinel `'router:verifier-node'` became `config:<configured model>` —
  still a config echo, but one that says so. New `--artifact-revision <id>`; **without it no
  artifact ref is stamped and the CLI warns loudly** that the resulting records can never pass the
  serving gate. A revision is operator knowledge and is never invented.

**3 · Loader (`tools/edge-loader`)**

- `lib/artifacts.mjs` + `load_edges.mjs`: claim rows now carry `artifact_revision`,
  `artifact_content_hash`, `artifact_posture`; verification rows carry those plus
  `attestation_returned_model`, `attestation_returned_version`, `attestation_family`,
  `attestation_decorrelated`, `attestation_attested` — the exact names/types from
  `20260728030000_r4u4_artifact_trust_and_revision_bound_disposition.sql`. Values are projected
  **verbatim or NULL**: nothing is derived, back-filled, or defaulted (`?? null`, never `?? false`
  and never `?? true`), because the loader cannot know whether a provider was ever called.
- `--check` / `--dry-run` now prints a per-edge `trust:` line, so an operator staging a demo sees
  "no artifact ref" / "no attestation captured" *before* the serving run rather than inferring it
  from an empty `insight_cards`.

**4 · Serving side (`supabase/functions/generate-insights`)**

- `index.ts`: the `verified_edges` select now includes `verification` **and** the eleven U4 view
  columns. This is the second half of the blocker: the columns existed and the loader could fill
  them, but the fetch selected neither, so the gate saw absence for every row.
- `composer.ts`: `ServableEdge` gained the flat U4 columns; `composeTrustPosture` prefers them
  (DB-constrained) over the jsonb, taking each group **atomically** — a partial group yields null
  rather than a hybrid artifact that never existed. New `trustInputsFor` + `edgeTrustFailures`
  move the view-row → `TrustInputs` mapping out of `index.ts` (where nothing could test it) into
  one testable place, and add sentinel-model rejection.
- `evaluators.ts` was **not** changed: it holds pure rule-condition evaluators and windowed
  baselines and has no trust surface. The trust plumbing lives in `composer.ts`/`index.ts`.

## Decided

- **Attestation and decorrelation stay separate fields.** A TEST-MODE run through a real provider
  still gets a genuine attestation; what test mode switches off is decorrelation. Collapsing them
  would either forgive a correlated verifier or discard a real attestation.
- **The serving path re-checks sentinel model strings** (`config:`, `router:`, `unset-`, `MOCK`,
  `INTERIM:`, `fixture:`, `TEST-MODE`) even though the producer already refuses to mark them
  attested. `attestation_attested` is a plain boolean in a database that also accepts hand-inserted
  rows; a row claiming attestation for "MOCK" is self-contradictory, and the conservative reading
  of a self-contradictory trust claim is "not attested".
- **`composeTrustPosture` keeps the stored `attested` value verbatim**; the sentinel correction is
  applied only in the gate. What lands on a card must still say what the row said, so a curator
  reading provenance sees the contradiction rather than a laundered value.
- The list of sentinels is duplicated between `tools/brain-ingest/src/verify/attest.ts` and the
  Deno `composer.ts` (an edge function may not import from `tools/`). Two drift-guard tests pin
  both copies against the router's real `TEST_MODE_LABEL`.
- **The demand-key input surface was left unchanged.** `computeDemandKey` still serializes edge
  identity + score + band, not the trust columns. Adding them would change `demand_key` for every
  existing row and is not needed for this unit (a trust change in practice arrives with a new
  verification row). Recorded here as a deliberate omission, not an oversight.
- **No new migration is needed.** The U4 columns hold everything this unit persists; the loader
  matches their names and types exactly.

## Left

- **Issue #240 steps 4–5 remain open** and are the orchestrator's: one genuinely provider-attested
  monotonic verification, then the full 14+7 / provenance / reject / B-PL15 rerun. Until an
  artifact carries a real `attestation` block *and* an `--artifact-revision`, the gate correctly
  produces zero `producer='edge'` cards — that is the honest state, not a regression.
- The operator running step 4 must pass `--artifact-revision <id>` to `brain-ingest verify`, or the
  record will carry no artifact ref and be blocked at the gate regardless of attestation.

## Blockers

- **The deploy attestation now disagrees with the tree, and this unit was forbidden to fix it.**
  `supabase/deploy-attestation.json` pins `generate-insights`' `entrypointSha256`
  (`a0d799be…`) and `moduleGraphSha256`; step 3 necessarily edits `index.ts` (now
  `76bcad727d32ba09eee1d7b12cd0f44b3b0849cd436836b0e7252fb366e5d91c`) and `composer.ts`, which is
  in its module graph. CI's `run4-release` attest step will therefore fail on this branch until
  someone regenerates the attestation with
  `node tools/run4_release_gate.mjs record-attestation`. This session's brief explicitly barred
  touching `supabase/deploy-attestation.json`, `tools/run4_release_gate*.mjs`, `ci.yml`, and
  `RUN4_UNIT_BASE_SHA`, so the conflict is reported rather than resolved. **A decision is needed
  before this branch can go green.**
- Pre-existing, unrelated to this change: the checked-in router config's single-provider/`testMode`
  conflict was left exactly as found, per the brief.

## Verification

Everything below was **actually executed** in this session unless stated otherwise.

- `node tools/context_sync.mjs --check` → passed ("sessions, memory, decisions, index, and
  couplings are consistent"; session-coverage reported "nothing to push" as the log was not yet
  committed at that point).
- `tsc --noEmit` (each package's own pinned TypeScript): `tools/llm-router`, `tools/brain-ingest`,
  `tools/edge-loader`, `tools/rules` — all four clean, no output.
- `npm test` under Node **v26.5.0** (the version `engines` requires): llm-router **78/78**,
  brain-ingest **380/380**, edge-loader **67/67**, rules **172/172** — 697 passed, 0 failed.
- Under the sandbox's default Node **v20.20.0**, edge-loader and rules each report 6 failures, all
  in CLI-subprocess tests (`load_edges.mjs` / `load_rules.mjs` spawned as a child), all with
  `ERR_REQUIRE_CYCLE_MODULE` on `shared/brain/relationships.schema.ts`. **Confirmed pre-existing**:
  the same 6 edge-loader failures reproduce on the unmodified base (55 pass / 6 fail before my
  changes, 56 / 6 after), and `tools/rules` contains only a new test file from this session.
- `deno check --config deno.json --lock ../../deno.lock --frozen index.ts` on
  `supabase/functions/generate-insights` (Deno 2.8.1, CI's pinned version, fetched via npx) →
  `Check index.ts`, clean. This is CI's `deno-check` step for the one function this unit edits.
- Loader smoke run: `node tools/edge-loader/load_edges.mjs --from-dir
  tools/edge-loader/tests/fixtures/edges --check` under Node 26 → 4 claims + 4 verifications valid,
  and each edge now prints `trust: posture no-artifact-ref; no attestation captured` — the correct
  answer for fixtures that assert no provenance.
- New tests: `tools/rules/tests/edge_trust_gate.test.ts` (32 assertions — 5 positive incl. an
  end-to-end classify→`rendersCard`→gate walk, 21 negative vectors, 3 drift guards),
  `tools/brain-ingest/tests/attestation.test.ts` (16), `tools/llm-router/tests/modelIdentity.test.ts`
  (7), plus 5 loader-projection tests appended to `tools/edge-loader/tests/edge_artifacts.test.ts`
  and a U4-column coupling test in `edge_table_schema.test.ts`.
- The negative matrix covers: missing attestation; attestation columns undefined (pre-U4 row);
  half-populated attestation; null posture; no artifact ref; partial artifact group; malformed
  content hash; unrecognised posture; TEST-MODE sentinel; MOCK / INTERIM / fixture stamps;
  `config:<model>`; the legacy `router:verifier-node`; `unset-verifier-model`; `attested: false`;
  `attested: null`; fixture-in-production; and `decorrelated` false/null in production.
- **Not run** (no Flutter or Dart file was touched): `flutter analyze`, `flutter test`.
- **Not run**: the U3 SQL harness, the release gate, and any hosted/database step — all need a live
  stack or provider access this unit had no authority for. The DB projection of the new columns is
  covered by the loader's row-shape tests and the migration-coupling guard, not by an applied
  migration.

memory: none
