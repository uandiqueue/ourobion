# shared/rules — the rule-blueprint contract

**THE contract for insight rules as data** (rules-engine-design §B1, [memory 0007](../../docs/memory/0007-rules-as-data-two-tier.md)).
Insight rules are git-tracked JSON **blueprints** — not TypeScript — validated against this package
and projected into the Postgres `rules` table by the loader.

- `rule.ts` — hand-authored types (the readable contract).
- `rule.schema.ts` — zod mirror + structural invariants + `AssertExact` drift guards (`tsc` fails if
  the two files diverge).
- `_assert.ts` — the `Equals` / `AssertExact` type-equality helpers.
- `index.ts` — accessors (`conditionMetricKeys`, `isInForce`, `blueprintRelPath`, …).

## Two-tier placement

| Tier | What | Where |
|---|---|---|
| **TRUTH** | this contract + the blueprint JSONs | `shared/rules/`, `data/rules/{single,cross}/<category>/<rule_id>.json` (one file per rule) |
| **DERIVED** | the `rules` table | populated ONLY by `tools/rules/load_rules.mjs` (full-rebuild upsert + prune); never hand-edited |

To change a rule: edit its blueprint, PR it, re-run the loader. Never write to the table.

## Blueprint shape (schemaVersion 1)

Identity + lifecycle: `ruleId` (== `insight_cards.rule_id`, the upsert key), `schemaVersion`,
`status` (`active|deprecated`) + `deprecatedAt`, `effectiveFrom`/`effectiveTo` (in-force window),
`enabledPhase` (engine phase gate), `cooldownDays` (re-fire suppression; null = none),
`expiryDays` (card `expires_at` horizon; the MVP's hardcoded 7).

Classification: `category` and `severity` — **character-identical to the `insight_cards` CHECK
sets** (`hydration|gut|vector|behaviour|descriptive`; `info|notice|watch`). `scope`
(`single|cross`) mirrors `metricKeys.length` (1 vs 2+). Every `metricKeys[]` entry must resolve in
`shared/metrics/registry.ts` (active or deprecated — never unknown; enforced by loader + guard, not
the schema, so the contract stays self-contained).

Provenance: `{ tier: 'hand_authored'|'extracted', sourceNote, citation }` — `extracted` rules come
from the B4 paper-extract CLI and are human-promoted out of `data/rules/_candidates/`.

Copy: `template { title, body }` with optional snake_case `{{placeholder}}`s, rendered by the
engine. **Every template must pass `validateCopyString`** (non-diagnostic,
[memory 0003](../../docs/memory/0003-non-diagnostic-copy.md)) — enforced three times: schema/load,
blueprint guard, render.

## Condition AST

A zod `discriminatedUnion` on `type`; the deterministic edge-function evaluator implements each
currently registered leaf.

- `trend` — `{ metricKey, equals: rising|falling|stable, minConfidence }`
- `threshold` — `{ metricKey, field: mean|std_dev|min|max, op: lt|lte|gt|gte|eq, value, minConfidence }`
- `coincidence` — `{ metricKeys: [K1, K2], both: [leaf-on-K1, leaf-on-K2], lagDays, minConfidence }` —
  the cross-metric conjunction over two `baseline_snapshots` rows. Named **coincidence, not
  correlation** (insight-engine-architecture §S4): real cross-metric relations are D1/D2 territory.
  `lagDays` (null = same window) is implemented by aligning the two metric windows before evaluating
  the child leaves; the shipped lag-1 blueprint exercises it.

`minConfidence` (`low|medium|high`) generalizes the MVP's scattered `notInsufficient(s)` checks —
the snapshot's confidence must be at or above the floor. `deviation`/`all`/`any` leaves are
deferred until a real rule needs them.

## Invariants (schema-enforced)

snake_case ids/keys; unique `metricKeys`; scope ⟺ key-count ⟺ condition shape (cross ⟺
`coincidence`, whose keys must equal the blueprint's and whose leaf *i* tests key *i*, keys
distinct); `deprecated` ⟺ `deprecatedAt`; `effectiveFrom ≤ effectiveTo`; copy gate + placeholder
syntax on both template strings.

## Guards

Registered in [`docs/graph/couplings.yaml`](../../docs/graph/couplings.yaml): blueprint↔schema +
templates↔copy-guidelines (`tools/rules/tests/rule_blueprint.test.ts`), schema↔rules-table
(`tools/rules/tests/rules_table_schema.test.ts`), rules-table↔insight_cards CHECK parity
(`apps/biotope/test/guards/rules_table_contract_test.dart`), blueprint↔engine condition coverage
(`tools/rules/tests/engine_condition_coverage.test.ts`).

**TS-only by design** (rules-engine-design open item 2): the app renders `insight_cards`, never raw
rule metadata, so there is no Dart mirror. This package is a `shared/` contract surface — changes
need a **2-reviewer PR** ([memory 0002](../../docs/memory/0002-shared-contract-two-reviewers.md)).
