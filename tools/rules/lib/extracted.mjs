// Deterministic bridge from `edges/blueprints.jsonl` to rule rows.
// Generated blueprints stay derived artifacts; git-tracked `data/rules/**` remains hand-authored
// truth. An explicitly supplied bundle is gated against the validated claims/verifications that
// feed `verified_edges`, then combined with every hand-authored row before the full-rebuild prune.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { flattenRule, metricsRegistry, rulesContract } from './blueprints.mjs';

export const BLUEPRINTS_BASENAME = 'blueprints.jsonl';
export const CLAIMS_BASENAME = 'claims.jsonl';
export const VERIFICATIONS_BASENAME = 'verifications.jsonl';
export const EXTRACTED_RULE_PHASE = 'phase2_engine';
export const LEGACY_EXTRACTED_RULE_PHASE = 'phase_2';
export const RENDER_TEMPLATE_KEYS = new Set(['metric_a_label', 'metric_b_label', 'lag_days']);

function issue(line, ruleId, reason, detail) {
  return { line, ruleId, reason, detail };
}

function formatZodIssues(error) {
  return error.issues
    .map((entry) => `${entry.path.length ? entry.path.join('.') : '(root)'}: ${entry.message}`)
    .join('; ');
}

function pairKey(left, right) {
  return [left, right].sort().join('\n');
}

function placeholders(value) {
  return [...value.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map((match) => match[1]);
}

function templateCompatibilityProblem(blueprint) {
  const values = [blueprint.template.title, blueprint.template.body];
  const unsupported = [...new Set(values.flatMap(placeholders).filter((key) => !RENDER_TEMPLATE_KEYS.has(key)))];
  if (unsupported.length > 0) {
    const supplied = [...RENDER_TEMPLATE_KEYS].map((key) => `{{${key}}}`).join(', ');
    const found = unsupported.map((key) => `{{${key}}}`).join(', ');
    return {
      reason: 'unsupported-template-placeholder',
      detail: `renderer supplies only ${supplied}; found ${found}`,
    };
  }
  const leaked = blueprint.metricKeys.filter((key) => values.some((value) => value.includes(key)));
  if (leaked.length > 0) {
    return {
      reason: 'raw-metric-key-in-template',
      detail: `user-facing template contains raw metric key(s): ${[...new Set(leaked)].join(', ')}`,
    };
  }
  return null;
}

/** Read the three files that share the R2 `edges/` layout. Verification is optional but fail-closed. */
export function readExtractedArtifactSet(edgesDir) {
  const blueprintsPath = path.join(edgesDir, BLUEPRINTS_BASENAME);
  const claimsPath = path.join(edgesDir, CLAIMS_BASENAME);
  const verificationsPath = path.join(edgesDir, VERIFICATIONS_BASENAME);
  if (!existsSync(blueprintsPath)) throw new Error(`no ${BLUEPRINTS_BASENAME} in '${edgesDir}'`);
  if (!existsSync(claimsPath)) throw new Error(`no ${CLAIMS_BASENAME} in '${edgesDir}'`);
  return {
    blueprintsText: readFileSync(blueprintsPath, 'utf8'),
    claimsText: readFileSync(claimsPath, 'utf8'),
    verificationsText: existsSync(verificationsPath) ? readFileSync(verificationsPath, 'utf8') : '',
    verificationArtifactPresent: existsSync(verificationsPath),
  };
}

/**
 * Gate extracted blueprint JSONL against already-validated edge-loader rows.
 * Corrupt structure/provenance is an error. Expected fail-closed outcomes are withheld and
 * reported without preventing the hand-authored base from loading.
 */
export function buildExtractedRows({
  blueprintsText,
  claimRows,
  verificationRows,
  reservedRuleIds = /** @type {string[]} */ ([]),
}) {
  const errors = [];
  const withheld = [];
  const accepted = [];
  const reserved = new Set(reservedRuleIds);
  const seenExtracted = new Set();

  const claimByEdge = new Map(claimRows.map((row) => [row.edge_id, row]));
  const servablePairs = new Set();
  for (const verification of verificationRows) {
    if (verification.status !== 'active' || verification.serving_band === 'hold') continue;
    const claim = claimByEdge.get(verification.edge_id);
    if (claim) servablePairs.add(pairKey(claim.subject, claim.object));
  }

  const clean = blueprintsText.charCodeAt(0) === 0xfeff ? blueprintsText.slice(1) : blueprintsText;
  clean.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    if (rawLine.trim() === '') return;

    let record;
    try {
      record = JSON.parse(rawLine);
    } catch (error) {
      errors.push(issue(line, null, 'invalid-json', String(error.message ?? error)));
      return;
    }
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(issue(line, null, 'invalid-record', 'record must be an object'));
      return;
    }
    if (record.blueprint === null || typeof record.blueprint !== 'object' || Array.isArray(record.blueprint)) {
      errors.push(issue(line, null, 'invalid-record', 'record.blueprint must be an object'));
      return;
    }

    const rawBlueprint = structuredClone(record.blueprint);
    const ruleId = typeof rawBlueprint.ruleId === 'string' ? rawBlueprint.ruleId : null;
    const normalizations = [];
    if (rawBlueprint.enabledPhase === LEGACY_EXTRACTED_RULE_PHASE) {
      rawBlueprint.enabledPhase = EXTRACTED_RULE_PHASE;
      normalizations.push(`${LEGACY_EXTRACTED_RULE_PHASE}->${EXTRACTED_RULE_PHASE}`);
    } else if (rawBlueprint.enabledPhase !== EXTRACTED_RULE_PHASE) {
      withheld.push(
        issue(
          line,
          ruleId,
          'unsupported-phase',
          `enabledPhase must be '${EXTRACTED_RULE_PHASE}' (legacy '${LEGACY_EXTRACTED_RULE_PHASE}' is normalized)`,
        ),
      );
      return;
    }

    const parsed = rulesContract.ruleBlueprintSchema.safeParse(rawBlueprint);
    if (!parsed.success) {
      errors.push(issue(line, ruleId, 'schema-invalid', formatZodIssues(parsed.error)));
      return;
    }
    const blueprint = parsed.data;
    if (blueprint.provenance.tier !== 'extracted' || blueprint.provenance.citation === null) {
      errors.push(issue(line, blueprint.ruleId, 'invalid-provenance', 'extracted rule needs a paper citation'));
      return;
    }
    if (typeof record.paperId !== 'string' || record.paperId !== blueprint.provenance.citation.paperId) {
      errors.push(
        issue(
          line,
          blueprint.ruleId,
          'citation-mismatch',
          'record.paperId must equal blueprint.provenance.citation.paperId',
        ),
      );
      return;
    }
    const unknown = blueprint.metricKeys.filter((key) => metricsRegistry.byKey(key) === undefined);
    if (unknown.length > 0) {
      errors.push(
        issue(line, blueprint.ruleId, 'unknown-metric-key', `unknown metric key(s): ${unknown.join(', ')}`),
      );
      return;
    }
    if (blueprint.scope !== 'cross' || blueprint.metricKeys.length !== 2) {
      errors.push(
        issue(line, blueprint.ruleId, 'unsupported-scope', 'extracted promotion requires one cross-metric pair'),
      );
      return;
    }

    const templateProblem = templateCompatibilityProblem(blueprint);
    if (templateProblem) {
      withheld.push(issue(line, blueprint.ruleId, templateProblem.reason, templateProblem.detail));
      return;
    }
    if (!servablePairs.has(pairKey(blueprint.metricKeys[0], blueprint.metricKeys[1]))) {
      withheld.push(
        issue(
          line,
          blueprint.ruleId,
          'no-servable-verified-pair',
          `no active high/mid verification for ${blueprint.metricKeys.join(' + ')}`,
        ),
      );
      return;
    }
    if (reserved.has(blueprint.ruleId)) {
      withheld.push(
        issue(line, blueprint.ruleId, 'hand-authored-rule-id-collision', 'hand-authored rule keeps ownership'),
      );
      return;
    }
    if (seenExtracted.has(blueprint.ruleId)) {
      withheld.push(issue(line, blueprint.ruleId, 'duplicate-extracted-rule-id', 'first accepted record keeps ownership'));
      return;
    }

    seenExtracted.add(blueprint.ruleId);
    accepted.push({ line, ruleId: blueprint.ruleId, normalizations, row: flattenRule(blueprint) });
  });

  accepted.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  withheld.sort((left, right) => left.line - right.line || String(left.ruleId).localeCompare(String(right.ruleId)));
  return { rows: accepted.map((entry) => entry.row), accepted, withheld, errors };
}
