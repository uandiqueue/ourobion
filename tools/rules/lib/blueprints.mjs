// tools/rules/lib/blueprints.mjs
//
// Pure blueprint pipeline shared by the loader CLI (../load_rules.mjs) and the blueprint guard
// tests (../tests/): discover data/rules/** files → parse → validate against the shared/rules zod
// contract → enforce path/rule agreement + registry-key membership + the non-diagnostic copy gate →
// flatten to `rules`-table rows with a canonical content hash. No database access here.
//
// Deterministic: same blueprint files → same rows (stable file order, stable key order, stable
// sha256 content hash). The only load-time-varying column, loaded_at, is set by the DB.
//
// The shared contract is TypeScript; this stays an .mjs Node script (house tools/ style, per the
// design doc's `load_rules.mjs`), so it registers the tsx ESM loader once and imports the TS
// sources directly — no build step, one source of truth.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

const TSX_REGISTERED = Symbol.for('ourobion.tsx-esm-registered');
if (!globalThis[TSX_REGISTERED]) {
  register();
  globalThis[TSX_REGISTERED] = true;
}

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const RULES_DIR = path.join(REPO_ROOT, 'data', 'rules');

const sharedUrl = (rel) => pathToFileURL(path.join(REPO_ROOT, 'shared', rel)).href;
// shared/ compiles as CommonJS, so `export * from` re-exports in rules/index.ts are not statically
// visible through the ESM interop — import each shared module directly instead of via the barrel.
const ruleSchema = await import(sharedUrl('rules/rule.schema.ts'));
const ruleAccessors = await import(sharedUrl('rules/index.ts'));
const metrics = await import(sharedUrl('metrics/index.ts'));
const { validateCopyString } = await import(sharedUrl('constants/copy_guidelines.ts'));
const rules = { ...ruleSchema, ...ruleAccessors };

export { rules as rulesContract, metrics as metricsRegistry };

/**
 * Self-emptying QUARANTINE (rules-engine-design §B3): paths relative to data/rules (POSIX
 * separators) of seed blueprints temporarily allowed to fail validation. Quarantined files are
 * NEVER loaded; one that VALIDATES (or no longer exists) is itself an error, so entries can only
 * ever disappear. Currently empty — keep it that way.
 */
export const QUARANTINE = new Set([]);

/** All blueprint JSON files under data/rules/{single,cross}, as sorted POSIX-relative paths. */
export function discoverBlueprintFiles(rulesDir = RULES_DIR) {
  const found = [];
  for (const scope of ['single', 'cross']) {
    const scopeDir = path.join(rulesDir, scope);
    if (!existsSync(scopeDir)) continue;
    for (const entry of readdirSync(scopeDir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const abs = path.join(entry.parentPath, entry.name);
      found.push(path.relative(rulesDir, abs).split(path.sep).join('/'));
    }
  }
  return found.sort();
}

function formatZodIssues(error) {
  return error.issues
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('; ');
}

/** Every problem with one blueprint file (empty array = fully valid). */
function validateFile(rulesDir, relPath) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path.join(rulesDir, ...relPath.split('/')), 'utf8'));
  } catch (e) {
    return { blueprint: null, problems: [`invalid JSON: ${e.message}`] };
  }

  const parsed = rules.ruleBlueprintSchema.safeParse(raw);
  if (!parsed.success) {
    return { blueprint: null, problems: [`schema: ${formatZodIssues(parsed.error)}`] };
  }
  const blueprint = parsed.data;
  const problems = [];

  // Path agreement: data/rules/<scope>/<category>/<ruleId>.json (surgical, conflict-free diffs).
  const expected = rules.blueprintRelPath(blueprint);
  if (relPath !== expected) {
    problems.push(`file path must be ${expected} (scope/category/ruleId agreement)`);
  }

  // Registry membership: every key the rule declares or its condition reads must be a known
  // (active or deprecated — never unknown) shared/metrics key.
  const referenced = new Set([
    ...blueprint.metricKeys,
    ...rules.conditionMetricKeys(blueprint.condition),
  ]);
  for (const key of referenced) {
    if (metrics.byKey(key) === undefined) {
      problems.push(`metric key "${key}" is not in shared/metrics/registry.ts`);
    }
  }

  // Non-diagnostic copy gate, re-run explicitly (memory 0003) — HARD FAIL.
  for (const field of ['title', 'body']) {
    if (!validateCopyString(blueprint.template[field])) {
      problems.push(`template.${field} fails validateCopyString (diagnostic language)`);
    }
  }

  return { blueprint, problems };
}

/**
 * Read + fully validate every blueprint. Returns { blueprints, errors }: blueprints is
 * [{ relPath, blueprint }] sorted by ruleId; errors is [{ relPath, message }] and any entry means
 * the set must not be loaded. Beyond per-file validation (zod invariants + copy gate + path +
 * registry keys), enforces globally-unique ruleIds and the self-emptying QUARANTINE.
 */
export function loadBlueprints(rulesDir = RULES_DIR) {
  const errors = [];
  const blueprints = [];
  const byRuleId = new Map();
  const files = discoverBlueprintFiles(rulesDir);

  for (const quarantined of QUARANTINE) {
    if (!files.includes(quarantined)) {
      errors.push({ relPath: quarantined, message: 'QUARANTINE entry no longer exists — remove it' });
    }
  }

  for (const relPath of files) {
    const { blueprint, problems } = validateFile(rulesDir, relPath);

    if (QUARANTINE.has(relPath)) {
      if (problems.length === 0) {
        errors.push({
          relPath,
          message: 'quarantined blueprint now validates — remove it from QUARANTINE',
        });
      }
      continue; // quarantined files are never loaded
    }

    if (problems.length > 0) {
      for (const message of problems) errors.push({ relPath, message });
      continue;
    }

    const dup = byRuleId.get(blueprint.ruleId);
    if (dup) {
      errors.push({ relPath, message: `duplicate ruleId "${blueprint.ruleId}" (also in ${dup})` });
      continue;
    }
    byRuleId.set(blueprint.ruleId, relPath);
    blueprints.push({ relPath, blueprint });
  }

  blueprints.sort((a, b) => a.blueprint.ruleId.localeCompare(b.blueprint.ruleId));
  return { blueprints, errors };
}

/** JSON.stringify with recursively sorted object keys — the canonical form the hash is taken over. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Stable sha256 of a blueprint's canonical JSON — the `rules.content_hash` column. */
export function contentHash(blueprint) {
  return createHash('sha256').update(canonicalJson(blueprint), 'utf8').digest('hex');
}

/**
 * Flatten one validated blueprint into a `rules`-table row (rules-engine-design §B2/§B3): the
 * condition splits into its `type` discriminator + a params jsonb; provenance splits into
 * `provenance_tier` + a `source_citation` jsonb. Keys here == migration columns minus `loaded_at`
 * (DB-defaulted) — guarded by tests/rules_table_schema.test.ts.
 */
export function flattenRule(blueprint) {
  const { type: conditionType, ...conditionParams } = blueprint.condition;
  return {
    rule_id: blueprint.ruleId,
    schema_version: blueprint.schemaVersion,
    scope: blueprint.scope,
    metric_keys: [...blueprint.metricKeys],
    condition_type: conditionType,
    condition_params: conditionParams,
    title_template: blueprint.template.title,
    body_template: blueprint.template.body,
    severity: blueprint.severity,
    category: blueprint.category,
    enabled_phase: blueprint.enabledPhase,
    provenance_tier: blueprint.provenance.tier,
    source_citation: {
      sourceNote: blueprint.provenance.sourceNote,
      citation: blueprint.provenance.citation,
    },
    effective_from: blueprint.effectiveFrom,
    effective_to: blueprint.effectiveTo,
    status: blueprint.status,
    deprecated_at: blueprint.deprecatedAt,
    cooldown_days: blueprint.cooldownDays,
    expiry_days: blueprint.expiryDays,
    content_hash: contentHash(blueprint),
  };
}

/**
 * The full pure pipeline: load + validate + flatten. Returns { rows, errors }; rows are sorted by
 * rule_id and safe to upsert only when errors is empty.
 */
export function buildRows(rulesDir = RULES_DIR) {
  const { blueprints, errors } = loadBlueprints(rulesDir);
  return { rows: blueprints.map(({ blueprint }) => flattenRule(blueprint)), errors };
}
