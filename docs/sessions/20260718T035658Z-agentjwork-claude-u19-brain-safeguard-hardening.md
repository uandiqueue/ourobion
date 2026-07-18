# Session 20260718T035658Z — agentjwork — claude — u19-brain-safeguard-hardening

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U19) · **Branch:**
  `fix/shared-brain/safeguard-hardening` (cut from the chain tip `chore/run/chain-recovery-docs-move`) ·
  **Issue:** #74 · **PR:** #75 (stacked on the chain tip; **shared/ retro-review** flag B8)
- **Type:** audit-fix unit U19 — **shared/brain safeguard-seam hardening**, findings A1 (medium),
  A2/A3 (low), A4/A5 (nit) from `docs/temp/phase2-audit/audit-findings-register.md`. Touches `shared/`
  ⇒ the PR carries the **shared/ retro-review** flag (B8). The seam being hardened is "the shared
  zod schema is the only gate on foreign/re-loaded artifacts (edge-loader), and it was weaker than
  brain-ingest's own `enforce()`".

## Attempted
- Extended the shared brain/rules zod contracts so the schema-level gate matches the in-repo
  producer's own checks for the five findings, then added rejection/acceptance tests at the existing
  validator test homes (edge-loader, rules) and a compile-time self-test for the drift guard.

## Changed (committed)
- `shared/brain/relationships.schema.ts`:
  - **A1 (per D16):** the grounding safeguard now fires for `partial` as well as
    `supported`/`contradicted` — every SERVABLE verdict (`SERVABLE_VERDICTS = {supported, partial}`,
    unchanged in `index.ts`) must have `independentRetrieval.performed === true`. Renamed the local
    `affirms` boolean to `requiresGrounding`.
  - **A2:** new superRefine cross-check — `corroboration.supporting ≤ count(sources whose stance ∈
    {supports, mixed})` and `corroboration.contradicting ≤ count(sources whose stance = refutes)`.
    Stance vocabulary ported from `citationSchema.stance` in this file (`supports|refutes|mixed|
    mentions`). Upper-bound only, so it never rejects a legitimate brain-ingest output (enforce()
    counts only `supports`, a subset of the bound).
  - **A3:** quoteCheck invariant changed to `allPresent === (spansTotal > 0 && spansFound ===
    spansTotal)` — matches `tools/brain-ingest/src/verify/quoteCheck.ts:312` exactly, killing the
    vacuous 0/0 pass (and, per the AU3 addendum, resolving the code/schema *disagreement*: the schema
    previously REJECTED the zero-span block the code produces and ACCEPTED the vacuous one).
  - **A4:** `Citation.title` → `.min(1)`; `synthesisedAt`/`verifiedAt` → `z.string().datetime({
    offset: true })`.
  - **A5:** local `Exact<A,B>` replaced with the conditional-generic identity form.
- `shared/rules/rule.schema.ts` (**A4**): `deprecatedAt` → `z.string().datetime({ offset: true })
  .nullable()` (was any string incl. empty — an empty string used to satisfy the "set ⟺ deprecated"
  XOR check with no usable date).
- `shared/rules/_assert.ts` (**A5**): `Equals<A,B>` replaced with the conditional-generic identity
  form `(<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false`.
  `AssertExact` is unchanged (it aliases `Equals`).
- `shared/rules/_assert.typetest.ts` (NEW): compile-time-only self-test — two `@ts-expect-error`
  lines prove an `any`-poisoned type and optional-vs-`| undefined` drift no longer satisfy `Equals`,
  plus one positive line proving a genuinely-identical pair still passes. Included by
  `shared/tsconfig.json` via `rules/**/*.ts`; never run by `node --test`.
- `tools/edge-loader/tests/edge_artifacts.test.ts`: +6 tests (A1 reject/accept, A2 reject/accept,
  A3 vacuous-reject / zero-span-accept), mutating the real fixtures against the real shared validators.
- `tools/rules/tests/rule_blueprint.test.ts`: +2 tests (empty-string `deprecatedAt` rejected; a valid
  ISO-datetime `deprecatedAt` on a deprecated blueprint accepted).

## Decided / judgment calls
- **Datetime validator choice.** Confirmed against the actual in-repo producers before picking one:
  edge-loader fixtures emit `…T00:00:00Z`, the live L6 corpus artifact emits `…T06:00:00.000Z`, the
  brain-ingest tests use both. `z.string().datetime({ offset: true })` (zod 4.3.6, verified by a quick
  eval) accepts all three forms and offset forms, and rejects the empty string. Chose it over a bespoke
  regex to also accept the `+HH:MM` offset forms A13 flags as latent — widening the *format* gate here
  does not change A13's dedup/ordering seam (a separate, deferred finding in U24).
- **A2 bound includes `mixed`.** brain-ingest `enforce()` counts only `stance === 'supports'` as
  supporting; the schema cross-check is an *upper bound*, so counting `supports`+`mixed` as
  "could-support" keeps the bound loose enough to never reject a legit enforce() output while still
  catching invented corroboration (the failure scenario: 1 `mentions` source, `supporting: 3`).
- **A5 demonstrated at compile time, not runtime.** The codebase had no `@ts-expect-error` precedent;
  a runtime test can't observe a type-identity failure. A dedicated `.typetest.ts` under `rules/`
  (which `shared/tsconfig.json` already compiles) is the natural home — `tsc --noEmit` is the assertion.
- **Where a finding's suggested fix didn't survive contact with the code:** the register's A4 phrasing
  implied `deprecatedAt` should get an ISO *datetime*; the sibling `effectiveFrom/To` fields use a
  date-only (`YYYY-MM-DD`) regex. There is no in-repo producer emitting a non-null `deprecatedAt`
  (every shipped blueprint + the registry use `null`), so no existing artifact constrains the choice;
  I followed the register's "ISO datetime" wording (semantically `deprecatedAt` is an instant, not a
  calendar day) rather than mirroring the date-only regex. Noted so a reviewer can flip it to date-only
  if product wants day-granularity.

## Gate results (all green)
- `npx tsc --noEmit` in `shared/` — clean (incl. the A5 typetest asserting the guard).
- `npm run typecheck` in `tools/edge-loader`, `tools/rules`, `tools/brain-ingest` — clean.
- `tools/edge-loader` **27/27** (was 21, +6), `tools/rules` **52/52** (was 50, +2),
  `tools/brain-ingest` **320/320** (verify/synth suites exercise these schemas, unchanged),
  `tools/llm-router` **42/42** (untouched-green).
- `flutter analyze` — no issues; `flutter test` — **48/48** (registry untouched).
- `node tools/context_sync.mjs --check` — consistent (docs/temp index-exempt; no `--fix-index` run).

## Left / follow-ups (not this unit)
- A13 (verifiedAt string-vs-timestamptz dedup/ordering) and A14 (empty-input prune guard) are U24.
- The remaining audit units U20–U28 are unchanged and queued.

## Blockers
- None.

memory: none
