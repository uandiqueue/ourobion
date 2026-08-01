// shared/rules/rule.ts
//
// THE rule-blueprint contract — the TRUTH-tier shape of one insight rule (rules-engine-design §B1,
// memory 0007). On-disk truth lives at repo-root `data/rules/{single,cross}/<category>/<rule_id>.json`,
// one file per rule; the loader (`tools/rules/load_rules.mjs`) projects blueprints into the derived
// Postgres `rules` table, and the engine (generate-insights, refactor step C) evaluates the table —
// never this file's instances. To change a rule, edit its blueprint JSON and re-run the loader.
//
// TRUTH vs DERIVED: this *contract* and the blueprint JSONs are TRUTH — git-tracked, 2-reviewer PR
// (docs/memory/0002-shared-contract-two-reviewers). The `rules` table rows are the rebuildable
// projection (docs/memory/0001-two-tier-truth).
//
// TS-only by design (rules-engine-design "Open items" #2): the app renders `insight_cards` (already
// a shared contract); raw rule metadata is never rendered client-side, so there is no Dart mirror
// and no ts-dart parity guard. Revisit only if the app ever renders rule definitions directly.
//
// Keep rule.ts and rule.schema.ts in lockstep — the AssertExact drift guard in rule.schema.ts
// fails `tsc` if they diverge.

/** Canonical snake_case metric key — must resolve to a shared/metrics registry entry. */
export type MetricKey = string;

/** Card category — character-identical to the `insight_cards.category` CHECK set. */
export type RuleCategory = 'hydration' | 'gut' | 'vector' | 'behaviour' | 'descriptive';

/** Card severity — character-identical to the `insight_cards.severity` CHECK set (memory 0003). */
export type RuleSeverity = 'info' | 'notice' | 'watch';

/** single = 1 metric; cross = 2+ metrics (the `coincidence` conjunction). Mirrors metricKeys.length. */
export type RuleScope = 'single' | 'cross';

/** Lifecycle — mirrors the metrics registry's status vocabulary. `deprecated` ⟺ deprecatedAt set. */
export type RuleStatus = 'active' | 'deprecated';

/**
 * Where the rule came from. `hand_authored` = written by a human (incl. the MVP ports);
 * `extracted` = produced by the B4 extract CLI from a paper, then human-promoted out of
 * `data/rules/_candidates/`.
 */
export type RuleProvenanceTier = 'hand_authored' | 'extracted';

/** Baseline confidence floor a snapshot must clear — generalizes the MVP's `notInsufficient(s)`. */
export type MinConfidence = 'low' | 'medium' | 'high';

/** Trend states — character-identical to `baseline_snapshots.trend`. */
export type TrendDirection = 'rising' | 'falling' | 'stable';

/** Numeric fields of a baseline snapshot a threshold may test. */
export type ThresholdField = 'mean' | 'std_dev' | 'min' | 'max';

/** Comparison operators for a threshold leaf. */
export type ThresholdOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';

// ─── Condition AST (rules-engine-design §B1 condition union) ────────────────────
// Three leaves cover all 6 MVP rules plus the cross-metric requirement; `deviation`/`all`/`any`
// are deferred until a real rule needs them. One pure evaluator per type lands with the engine
// refactor (step C).

/** Fires when the metric's baseline trend equals `equals`. Replaces the 4 MVP trend rules. */
export interface TrendCondition {
  type: 'trend';
  metricKey: MetricKey;
  equals: TrendDirection;
  minConfidence: MinConfidence;
}

/**
 * Fires when `<field> <op> <value>` holds on the metric's baseline snapshot (a null field never
 * fires). Replaces gut_form_stable (std_dev ≤ 1.0) / gut_form_variable (std_dev > 2.0).
 */
export interface ThresholdCondition {
  type: 'threshold';
  metricKey: MetricKey;
  field: ThresholdField;
  op: ThresholdOp;
  value: number;
  minConfidence: MinConfidence;
}

/** A per-metric test usable inside a `coincidence` conjunction. */
export type CoincidenceLeaf = TrendCondition | ThresholdCondition;

/**
 * The cross-metric primitive: both leaves hold for one user (reads two `baseline_snapshots` rows).
 * Named `coincidence` — NOT `correlation` — per insight-engine-architecture §S4: this is a
 * rule-blueprint conjunction; genuine cross-metric relations are exclusively D1/D2 territory.
 * `both[0]` tests `metricKeys[0]`, `both[1]` tests `metricKeys[1]`.
 */
export interface CoincidenceCondition {
  type: 'coincidence';
  metricKeys: readonly [MetricKey, MetricKey];
  both: readonly [CoincidenceLeaf, CoincidenceLeaf];
  /**
   * Lag window in days: `both[1]` is evaluated over a window lagged this many days behind
   * `both[0]`; null = same window (the only mode the current 7-day snapshots support — lagged
   * evaluation needs the engine to compute windowed baselines, deferred to the engine refactor).
   */
  lagDays: number | null;
  /** Floor applied to BOTH snapshots' confidence. */
  minConfidence: MinConfidence;
}

/** The condition union — discriminated on `type`. */
export type RuleCondition = TrendCondition | ThresholdCondition | CoincidenceCondition;

// ─── Blueprint ──────────────────────────────────────────────────────────────────

/** Provenance — who authored the rule and on what evidence. */
export interface RuleProvenance {
  tier: RuleProvenanceTier;
  /** Human-readable origin note (e.g. which MVP rule was ported, or which paper section). */
  sourceNote: string;
  /** Paper citation for `extracted` rules; null for hand-authored ones. */
  citation: { paperId: string; locator: string | null } | null;
}

/**
 * Card copy templates. `{{placeholder}}`s (snake_case) are filled at render time (engine step C);
 * static strings are valid templates. Every template must pass `validateCopyString`
 * (shared/constants/copy_guidelines.ts) — enforced at load (B3), in the blueprint guard (B5),
 * and at render (C).
 */
export interface RuleTemplate {
  title: string;
  body: string;
}

/** One git-tracked rule blueprint — the unit of `data/rules/**` (one file per rule). */
export interface RuleBlueprint {
  /** == `insight_cards.rule_id` — the upsert key, snake_case, unique across all blueprints. */
  ruleId: string;
  /** Version of THIS contract the blueprint was authored against. Currently 1. */
  schemaVersion: number;
  category: RuleCategory;
  severity: RuleSeverity;
  /** single|cross — must agree with metricKeys.length (1 vs 2+). */
  scope: RuleScope;
  /** Engine phase gate: rows are evaluated only while `enabled_phase` matches the active phase. */
  enabledPhase: string;
  /** Every metric the rule reads — 1 = single, 2+ = cross. Each must be a registry key. */
  metricKeys: readonly MetricKey[];
  provenance: RuleProvenance;
  /** ISO date (YYYY-MM-DD) the rule comes in force; null = always. */
  effectiveFrom: string | null;
  /** ISO date (YYYY-MM-DD) the rule lapses; null = never. */
  effectiveTo: string | null;
  status: RuleStatus;
  /** ISO datetime the rule was deprecated; set ⟺ status === 'deprecated'. */
  deprecatedAt: string | null;
  /** Days a fired card is suppressed from re-firing after expiry/snooze; null = no cooldown (MVP behaviour). */
  cooldownDays: number | null;
  /** Days until a generated card's `expires_at` — the MVP hardcoded 7. */
  expiryDays: number;
  condition: RuleCondition;
  template: RuleTemplate;
}
