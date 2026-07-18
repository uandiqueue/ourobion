# Session 20260716T031048Z — agentjwork — claude — s6-edge-store-a11-loader

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U8) · **Branch:**
  `feat/brain/s6-edge-store-a11-loader` (cut from `feat/m5a-engine/s4-signals-s5-evaluator`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** the brain's truth-tier → Postgres projection seam, stages S6 + A11 of
  `docs/shared/insight-engine-architecture.md`: the D1 edge read store
  (`relationship_claims` + `edge_verifications` + `verified_edges`) and the deterministic
  edge loader. No synthesized edges exist yet (A8/A10 are later sessions) — exercised
  end-to-end against hand-authored fixture artifacts that validate against the real contract.

## Attempted
- §S6 migration (near-verbatim from the doc sketch, adapted to the shipped contract), the A11
  loader as a `tools/` package (validate → join → gate → transactional upsert + prune), fixture
  edge artifacts, node guard tests, the two deferred brain guards, and a full live exercise
  (load / idempotent re-run / prune / cross-run supersede / RLS) against the local stack.

## Changed
- `supabase/migrations/20260716031048_create_brain_edge_read_store.sql` (NEW) — §S6 DDL:
  `relationship_claims` (edge_id PK, subject/object/relation, full-claim jsonb, prompt_version,
  synthesised_at) + `edge_verifications` ((edge_id, verified_at) PK, full-verification jsonb,
  verdict, status, precomputed `edge_score numeric(4,3)` + `serving_band`) +
  `verified_edges` view (distinct-on newest ACTIVE verification per edge,
  `with (security_invoker = true)` — house S2-view style). Adaptations vs the doc sketch:
  (1) CHECK sets on relation/verdict/status/serving_band + a 0..1 edge_score CHECK (rules-table
  house style; guard-coupled to the contract enums); (2) `loaded_at timestamptz default now()`
  on both tables (rules precedent — load observability; the one column the loader never sets);
  (3) `on delete cascade` on the verification FK (prune order safety); (4) the two §S6 1-hop
  btree indexes on subject/object; (5) projection-tier COMMENTs naming the R2 artifacts as
  TRUTH. RLS: on, `for select to authenticated using (true)` per §S6 ("population data, no user
  rows") — a recorded deviation from the rules-table precedent (no read policy there, because
  only service_role reads rules; here the app/S7 read path is authenticated).
- `tools/edge-loader/` (NEW package, tools/rules pattern): `load_edges.mjs` CLI +
  `lib/artifacts.mjs` pure pipeline + package/tsconfig. Loader semantics: reads
  `claims.jsonl` + `verifications.jsonl` from `--from-dir <dir>` (a local mirror of the R2
  `edges/` prefix — offline-first) or `--from-r2` (env `R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/
  `R2_SECRET_ACCESS_KEY`/`R2_BUCKET`, brain-ingest names; same S3-client settings as
  `tools/brain-ingest/src/storage/r2.ts`); zod-validates EVERY line via the real
  `shared/brain/relationships.schema.ts` validators (tsx ESM loader, schema imported directly
  — the U5 CJS-barrel gotcha) with HARD line-numbered fail (deviation from §A11's
  "quarantine + continue" — with no synthesis pipeline yet, every invalid line is authored
  truth that must be fixed, not routed around; quarantine can return with A8); additionally
  hard-fails endpoints that aren't ACTIVE registry metrics (relationships.ts header
  invariant); joins verifications→claims by edgeId (unclaimed edgeId = error); computes
  `edge_score`/`serving_band` with `shared/brain` `edgeScore`/`servingBand` — never re-derived;
  per-edge newest-active-wins supersede computed in-memory; claims upsert on edge_id,
  verifications upsert on (edge_id, verified_at), then prune both tables to the artifact set —
  one transaction. `--dry-run`/`--check`. BOM-tolerant JSONL (PowerShell 5.1 mirrors).
- `tools/edge-loader/tests/fixtures/edges/{claims,verifications}.jsonl` + `README.md` (NEW) —
  4 hand-authored FIXTURE edges over seeded registry metrics: sleep→HRV (2 verifications:
  older active 0.765/mid superseded by newer 0.900/high), sleep→resting-HR (partial,
  0.560/mid), steps→sleep (uncertain, 0/hold — never served), stool-form→gut-comfort (claim
  with NO verification — absent from verified_edges). Provenance marks every record
  `fixture:hand-authored (NOT a synthesis/verifier model)`, every paperId `fixture:`, every
  derivation "FIXTURE … NOT LLM-synthesised"; kept under tests/fixtures (never data/) so they
  cannot be mistaken for synthesized edges.
- `tools/edge-loader/tests/edge_artifacts.test.ts` (14 tests) — line-numbered rejection paths
  (bad JSON, base-shape zod, edgeId-invariant superRefine, the safeguard invariant
  supported-without-retrieval, non-registry endpoint, unclaimed verification), score/band
  equality with shared/brain functions + hand-computed constants, join semantics
  (claim-without-verification not servable; newest-active-wins with jsonb kept verbatim;
  duplicate-line first-wins == on-conflict semantics; re-synthesised-claim last-line-wins),
  determinism.
- `tools/edge-loader/tests/edge_table_schema.test.ts` (5 tests) — the **brain-edge-to-schema**
  guard: migration columns == loader row keys (+ loaded_at) per table; relation/verdict/status
  CHECKs character-identical to the shared/brain zod enums; serving_band CHECK ==
  EDGE_GATES bands + hold; view asserts security_invoker / active-only / newest-first.
- `tools/edge-loader/tests/edge_endpoints_registry.test.ts` (2 tests) — the
  **brain-endpoint-to-registry** guard: fixture endpoints resolve via `isActiveMetric`, and the
  loader's enforcement path rejects unknown keys.
- `docs/graph/couplings.yaml` — `brain-edge-to-schema` + `brain-endpoint-to-registry`
  registered active with the real guard paths (the deferred guards from
  brain-synthesis-design "Guards (deferred)", now implementable because the graph is persisted).
- Root `package.json` — `edges:load` / `edges:check` / `edges:test`.

## Decided
- **Loader home: `tools/edge-loader/`** (tools/rules `load_rules.mjs` pattern). §A11 says the
  production loader runs in nao (cron / A3 write-back) — that wiring is a later session; the
  deterministic core ships as a repo tool exactly like the rules loader so nao can invoke it
  (or its lib) when the transport lands. Recorded as the "prefer tools/" call the doc leaves
  ambiguous.
- **Verifications upsert (`do update`), not the doc's `on conflict do nothing`** — found live:
  with do-nothing, the status column of a row landed by a PRIOR run went stale when the newest
  active verification changed (and a separate SQL supersede pass fixed only the forward
  direction). Upsert + prune makes the tables a pure function of the current artifact set
  (full rebuild every run), which is what two-tier truth demands; artifact content is
  append-only so the upsert only ever moves the computed status/gating columns + loaded_at.
- **Supersede lives in the status COLUMN; the verification jsonb stays verbatim** — the
  artifact copy is truth-tier evidence; the column is the serving lifecycle (COMMENTed).
- **Hard fail vs §A11 quarantine** — recorded above; revisit when A8 synthesis produces
  machine-authored lines at volume.
- **Claims: last line wins per edgeId** — append-only artifact ⇒ later line is the re-synthesis
  (mirrors upsert-on-edge_id); verifications: duplicate (edgeId, verifiedAt) first-wins.
- **Missing verifications.jsonl is a legitimate early state** (claims synthesised, verifier not
  yet run) — warn + load claims only; a missing claims.jsonl is a hard error (dir typo guard).
- **Fixture gating spread by construction**: high (0.900), mid (0.560 partial), hold
  (uncertain ⇒ 0), superseded (0.765), and not-servable (no verification) — every serving band
  and both non-serving paths exercised with realistic seeded-domain content.

## Left
- S7 composer reads `verified_edges` — later session (L5); nao cron/A3-callback invocation of
  the loader — later session (the CLI stays DB-credential-free on the R2 side until then).
- `--from-r2` is implemented against the brain-ingest client settings but cannot be exercised
  live until A8/A10 write real artifacts to the bucket; fixtures cover the parse/load surface.
- CI still doesn't run node tool-package tests (`edges:test` joins `rules:test`/`view:test`/
  `stats:test` in that gap — standing orchestrator decision); couplings guards + pre-push cover.
- A12 coverage, gap-ledger wiring, and the quarantine question return with the synthesis loop.

## Blockers
- None. Gate: `tools/edge-loader` **21/21** + `tsc --noEmit` clean · shared `npx tsc --noEmit`
  clean · `flutter analyze` clean · `flutter test` **46/46** · `npx supabase db reset` — all 14
  migrations apply · **functional (really run, local stack):** fixture load →
  `verified_edges` = 3 rows (0.900/high, 0.560/mid, 0.000/hold; claim-without-verification
  absent; older verification stored superseded @ 0.765); idempotent re-run — content checksum
  `a4b9289f…` identical before/after; prune — shrunken artifact dir removed 2 claims +
  1 verification, full reload restored the exact original checksum; cross-run supersede —
  older-only load served mid/0.765 as active, full reload flipped it superseded and served
  high/0.900; RLS — `set role authenticated` reads 3 verified edges, `set role anon` reads 0 ·
  `context_sync --fix-index` + `--check` pass.

memory: none
