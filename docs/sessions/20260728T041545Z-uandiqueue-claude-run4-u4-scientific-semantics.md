---
title: "Run 4 U4 — scientific provenance semantics and artifact trust posture (O27/O38)"
summary: "Carried source and verifier claim kind through serving so a correlational claim can no longer render as causal, added fail-closed artifact trust posture and attestation, bound expert disposition to artifact revision plus content hash, and gave the trust vocabulary a parity-guarded Dart mirror."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U4 — scientific provenance semantics and artifact trust posture (O27/O38)

Issue #196. Unit base `ff0546434f081cadc3e5683217d484f250c19139` (then-current
`origin/dev-phase2-run4` — the tip had advanced past the `ad8ef17` anchor in the dispatch brief
because PR #194's cockpit refresh merged during startup; re-verified at unit start). Branch
`feat/brain/run4-u4-scientific-semantics` in an isolated worktree.

**Environment note.** The dispatch brief described a macOS checkout at `/Users/alton/MVP
project/biotope` with graphify absent. This session ran on the WSL2 Linux box at
`/home/uandiqueue/project/ourobion` (device `uandiqueue`). Same repo, different machine; the
toolchain differences below are load-bearing for what could and could not be verified.

## Attempted

Implement R4-U4 only: preserve scientific meaning and artifact trust posture unbroken from stored
artifact to rendered card, rename the evidence-tier vocabulary, make trust labels agree across
TS and Dart without a cross-language import, and wire contradiction into `needsReview()`.

## Changed

- **`shared/brain/relationships.ts`** — added `ArtifactPosture`, `ArtifactRef` (revision +
  `sha256:<64 hex>` content hash + posture) and `ModelAttestation` (provider-**returned**
  model/version, family, decorrelated, attested). Added optional `artifact` to `RelationshipClaim`
  and optional `artifact` + `attestation` to `EdgeVerification` — additive optional-with-default per
  the accepted-contract rule.
- **`shared/brain/provenance.ts`** (new) — the serving-side rules: `claimKindPosture` /
  `effectiveClaimKind` (verifier's `supportedKind` **caps** the synthesised kind), `trustFailures` /
  `isTrustedForServing` / `assertTrustedForServing` (fail-closed), `provenanceGaps` (chain
  completeness incl. foreign-paper), `verifyExactQuote` (offset-exact), and `resolveDisposition`
  (B-BR7 revision binding).
- **`shared/brain/trust_labels.ts`** (new) + **`trust_labels.dart`** (new) — the user-facing
  vocabulary and its hand-maintained Dart mirror. B-SCI2: "evidence tier" → **study-design tier**;
  the composite is a **prototype support rank**, never confidence or certainty; every rank/tier
  surface carries "Certainty is not assessed."
- **`shared/brain/trust_labels.typetest.ts`** (new) — compile-time proof that the unions
  `trust_labels.ts` restates are exactly the contract unions.
- **`shared/brain/index.ts`** — re-exports the two new modules; `needsReview()` gained an optional
  `ReviewSignals` and a new `reviewReasons()` (B-BR10).
- **`supabase/functions/generate-insights/composer.ts`** — `ServableEdge` no longer narrows away
  `claim.claimKind`; added `composeClaimKind` / `composeTrustPosture` and carried
  `claimKind` / `trust` / `studyDesignTier` onto `ComposedEdgeRef`.
- **`supabase/functions/generate-insights/render.ts`** — `relationPhrase(relation, effectiveKind)`
  now selects wording by claim kind; `renderCard` gained the **causal-verb gate** and
  `claim-kind-missing` failure; templates lead with `{{posture_disclosure}}` (B-UI9).
- **`supabase/functions/generate-insights/index.ts`** — artifact trust gate before render;
  `SERVING_ENVIRONMENT` from `OUROBION_SERVING_ENV`, **defaulting to `production`**; enriched
  `edge_refs`.
- **`supabase/migrations/20260728030000_r4u4_artifact_trust_and_revision_bound_disposition.sql`**
  (new) — artifact/attestation columns on both S6 tables, artifact binding columns on
  `edge_human_verdicts`, and a dropped-and-recreated `verified_edges` with an explicit column list.
- **`apps/biotope/test/guards/brain_trust_labels_parity_test.dart`** (new) + `guard_support.dart`
  helpers — the O38 parity guard.
- **Tests** — `tools/brain-ingest/tests/scientific_provenance.test.ts` (38),
  `tools/rules/tests/causal_copy_gate.test.ts` (18); updated 3 existing render/orientation tests
  that encoded the pre-fix behaviour.
- **Docs** — `shared/SHARED-CONTEXT.md` brain section; `docs/graph/couplings.yaml` gained
  `brain-trust-labels-ts-dart-parity`.
- **`shared/tsconfig.json`** — added `brain/**/*.ts` to `include` (closes **B-PL8**: shared/brain
  had no typecheck of its own) and `allowImportingTsExtensions` (safe under `noEmit`).

## Decided

- **The B-SCI1 root cause was a type narrowing, not a missing column.** `verified_edges` already
  carried `claimKind` inside the claim jsonb; `ServableEdge` declared
  `claim: { citations?: ... }` and the field was simply never read, so every edge rendered
  "tends to raise"/"tends to lower". The fix is to read it and let the verifier's `supportedKind`
  cap it.
- **Unknown claim kind fails closed.** When either kind is missing, `effective` is `null` and the
  render path refuses to emit directional wording. Defaulting to `correlational` would have *looked*
  safe while fabricating a scientific judgment nobody made.
- **`OUROBION_SERVING_ENV` defaults to `production`.** An unset variable must be the strict case, so
  a deployment that forgot to configure it fails closed rather than silently serving fixtures.
  **Local/demo runs must now set `OUROBION_SERVING_ENV=demo`.** Since the edge-loader does not yet
  populate the artifact columns, the production path currently blocks every edge card — that is the
  intended posture and is inert in Run 4, where production serving is not authorized.
- **`trust_labels.ts` has no imports at all.** Deno resolves specifiers literally and the rest of
  shared/brain uses extensionless imports, so an import here would make the file unloadable from an
  edge function. It restates seven unions; `trust_labels.typetest.ts` makes drift a `tsc` failure.
- **Bare `lower` is deliberately absent from `CAUSAL_VERBS`.** It is the comparative adjective in
  this vocabulary's own non-causal phrasing ("is associated with lower"), so listing it would make
  correlational copy fail the very gate meant to permit it. `lowers` / `lowering` / `tends to lower`
  are listed instead. The parity guard asserts this and says why.
- **No `accept`/`restore` action was added** to `edge_human_verdicts`. That table's O13 header
  locks those semantics; B-BR7 changes what a verdict is BOUND to, not what actions exist.
  `human_verdict_applies` is the primitive a future accept path would consult.
- **Reject stays conservative under staleness; approval is never inherited.** A stale `reject` keeps
  excluding an edge; a stale verdict never resolves as approval.
- **`SUPPORT_RANK_DISCLOSURE` was reworded** from "not a score of how certain a finding is" to
  "does not measure how well established a finding is". The original was a *denial* of certainty and
  semantically fine, but a blunt word-ban is the drift-proof invariant, and the sentence works
  without the word.
- **Reverted an unintended `pubspec.lock` transitive downgrade** (`meta` 1.18.0→1.17.0, `test`
  1.31.0→1.30.0) introduced by a local `flutter pub get`. Not this unit's change, and it would
  collide with the concurrent UI session.

## Left

- **B-UI3 and the Flutter half of B-UI9 are NOT done.** Both require `apps/biotope/lib/**`, which
  this unit was explicitly forbidden to touch (the canonical UI session owns it). The serving data,
  the migration columns, and the parity-guarded Dart vocabulary are all in place for that session to
  wire; the rendering itself is deferred, not delivered. **O27 is therefore not fully closed.**
- **The edge-loader does not populate the new artifact/attestation columns.** Until it does, every
  record is honestly untrusted and blocks on a trust-requiring path. Follow-on unit.
- `parseClaimKind` / `effectiveClaimKind` were intentionally not mirrored into Dart — the effective
  kind is computed server-side and carried on the card.
- B-BR7's curator-RPC and re-review/restore history remain open; only the revision-binding slice
  landed.

## Blockers

- **`apps/nao` test suite could NOT be run on this machine.** Its `package.json` declares
  `engines: {"node": ">=26"}` and relies on Node's native TS type-stripping; only Node v20.20.0 is
  installed here (no other version under nvm). It is **unrun locally** — but it **passed in CI**,
  which runs Node 26. No `apps/nao` source was modified by this unit.
- **The migration could not be executed locally.** Docker is unavailable in this WSL distro and
  `npx supabase status` fails. It **shadow-applied green on postgres:17 in CI**, so the DDL is
  verified — just not by this machine.
- **Pre-existing failures, unrelated to this unit, confirmed against a clean base worktree at
  `ff05464`:** `tools/rules` 6 failures and `tools/edge-loader` 5 failures, all
  `ERR_REQUIRE_CYCLE_MODULE` from Node 20.20's `require(esm)` cycle when a CLI spawns a subprocess.
  Base and branch counts are identical. Not fixed — out of scope and environment-dependent.
- The **Run 4 release-evidence / Run 4 Gate** checks are expected red on this PR: the checked-in
  `RUN4_UNIT_BASE_SHA` is stale and charges this unit for already-merged work. Not touched.

## Verification actually run

Final local state, after the first CI run exposed three real failures (see "First CI run" below):

| Command | Result |
|---|---|
| `node tools/context_sync.mjs --check` | passed |
| `npx tsc -p shared/tsconfig.json` (now incl. `brain/**`) | exit 0 |
| `tools/brain-ingest` `tsc --noEmit` | exit 0 |
| `tools/brain-ingest` `node --import tsx --test tests/**/*.test.ts` | **353 / 353 pass** |
| `tools/rules` `tsc --noEmit` | exit 0 |
| `tools/rules` `node --import tsx --test tests/*.test.ts` | 140 tests, 134 pass, **6 pre-existing fail** |
| `tools/edge-loader` `node --import tsx --test tests/*.test.ts` | 56 tests, 51 pass, **5 pre-existing fail** |
| `deno check --config deno.json --lock ../../deno.lock --frozen index.ts` (generate-insights) | exit 0 |
| `apps/biotope` `flutter analyze` | No issues found |
| `apps/biotope` `flutter test` | **134 / 134 pass** |
| `apps/biotope` `flutter test test/guards/` | **62 / 62 pass** (incl. the new O38 parity guard) |
| `apps/nao` test suite | **NOT RUN locally** — requires Node ≥26, machine has 20.20.0. **Passed in CI.** |
| migration against live Postgres | **NOT RUN locally** — no Docker/Supabase. **Shadow-applied green on postgres:17 in CI.** |

Deno was not installed at the start of the session; it was installed mid-session
(`deno 2.9.4`, to `/tmp`, not into the repo) precisely so the edge-function check could be run
locally instead of guessed at.

## First CI run — three real failures, all mine, all fixed

The first push produced three failures beyond the two expected gate checks. None was pre-existing;
each is recorded here because the diagnosis is the useful part.

1. **`Deno — generate-insights` failed.** `deno check` *does* follow `import type` specifiers, so
   `provenance.ts`'s extensionless `import type … from './relationships'` was unresolvable. My
   original assumption — that type-only imports are erased before Deno builds the module graph —
   was simply wrong.
2. **`Node tools — tools/brain-ingest` failed** with `TS1287`/`TS1295` across `shared/brain`.
   Root cause: `tools/brain-ingest` had only ever referenced `shared/brain` **in comments**
   (its `src/*/types.ts` keep structural mirrors), so those modules had never once entered its
   `tsc` program. The new test imported them for real and exposed a **latent** incompatibility —
   `shared/package.json` has no `"type": "module"`, so under `NodeNext` those files are CommonJS,
   and `verbatimModuleSyntax` rejects top-level value `export`s in a CommonJS file.
3. **`Node tools — tools/edge-loader` failed** — same root cause, at runtime.

**Resolution, without weakening anything.** The whole fail-closed trust gate moved into
`trust_labels.ts`, the only shared/brain module with **zero imports**, which is therefore the only
one Deno can load; `provenance.ts` re-exports it, so there is still exactly one implementation.
All `.ts` extensions were reverted and `allowImportingTsExtensions` was removed from
`shared/tsconfig.json`. The provenance test moved from `tools/brain-ingest/tests/` to
`tools/rules/tests/`, whose tsconfig does not set `verbatimModuleSyntax`. `verbatimModuleSyntax`
was **not** disabled anywhere, and no assertion was relaxed.

**Latent issue now documented:** any future Node package that sets `verbatimModuleSyntax` and
imports a value-exporting `shared/brain` module will hit the same wall. The real fix is deciding
whether `shared/` should declare `"type": "module"` — deliberately out of scope here, since it
would change module resolution for every consumer at once.

The O38 parity guard was proven to fail on drift (a deliberately tampered label failed it, then
was reverted), and the causal-copy gate ships negative fixtures that genuinely fail — a test that
cannot fail is not a test.

memory: none
