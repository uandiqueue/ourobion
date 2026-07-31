/**
 * #300 §D + G3 · Rule-blueprint emission, dedupe, and merge.
 *
 * §D makes synthesis a NEW PRODUCER of rule blueprints, not just of edges. This is
 * what gives `rules` and `personal` cards paper lineage, and it is why card count
 * scales with papers processed rather than with human authoring. Everything it needs
 * already exists in `shared/rules/rule.schema.ts`:
 *   - `provenance.tier: 'extracted'`  (vs the 8 hand-authored blueprints' 'hand_authored')
 *   - `provenance.citation: { paperId, locator }`
 * Both have NEVER been written to. Same zod gate, same loader (`rules:load`), same
 * engine — a new producer, not an architectural change.
 *
 * G3 · DEDUPE IS MANDATORY, NOT A NICETY. Twenty papers WILL produce overlapping
 * rules for the same metric pairs. Without a dedupe key you get 50 near-identical
 * cards, which is a WORSE demo than 15 distinct ones. This mirrors
 * `claimDedupeKey`/`dedupeAgainst` in `artifact.ts` for blueprints, and the policy on
 * collision is MERGE CITATIONS onto one blueprint (two papers supporting the same rule
 * is corroboration and belongs on one card) rather than emit a second near-identical
 * rule.
 *
 * House pattern: this package does NOT statically import `shared/`. The real zod
 * `validateBlueprint` gate is loaded at runtime via `synth/load.ts`; the shapes below
 * are the minimal STRUCTURAL MIRRORS the dedupe key and merge policy read.
 *
 * Pure: no I/O.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { RejectedBlueprint, SynthBlueprintRecord } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal structural mirrors of shared/rules/rule.ts (dedupe + merge read only these)
// ─────────────────────────────────────────────────────────────────────────────

interface MirrorTrendLeaf {
  type: 'trend';
  metricKey: string;
  equals: string;
}

interface MirrorThresholdLeaf {
  type: 'threshold';
  metricKey: string;
  field: string;
  op: string;
}

type MirrorLeaf = MirrorTrendLeaf | MirrorThresholdLeaf;

interface MirrorCoincidence {
  type: 'coincidence';
  metricKeys: readonly [string, string];
  both: readonly [MirrorLeaf, MirrorLeaf];
  lagDays: number | null;
}

type MirrorCondition = MirrorLeaf | MirrorCoincidence;

interface MirrorCitation {
  paperId: string;
  locator: string | null;
}

interface MirrorBlueprint {
  ruleId?: unknown;
  scope?: unknown;
  metricKeys?: unknown;
  condition?: unknown;
  provenance?: { tier?: unknown; sourceNote?: unknown; citation?: unknown };
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The DIRECTION component of one condition leaf — what the rule actually asserts about
 * the metric. `trend` contributes its direction ('rising'/'falling'/'stable'); `threshold`
 * contributes its comparison ('mean/gt'). Two rules that test the same metric in opposite
 * directions are genuinely different rules and MUST NOT collapse together.
 */
function leafShape(leaf: unknown): string {
  const l = asRecord(leaf);
  const type = asString(l['type']);
  if (type === 'trend') return `trend:${asString(l['equals'])}`;
  if (type === 'threshold') return `threshold:${asString(l['field'])}/${asString(l['op'])}`;
  return `unknown:${type}`;
}

/**
 * G3 · The blueprint dedupe key: **metric pair + condition shape + direction**, exactly as
 * #300 G3 specifies.
 *
 * Deliberate properties:
 *  - The metric pair is ORDER-INSENSITIVE for the *identity* of the pair (the same two
 *    metrics are the same pair), but each metric keeps its OWN direction, so
 *    `gut_comfort rising × mood rising` and `gut_comfort rising × mood falling` stay
 *    distinct. Sorting `metricKey:direction` units achieves both at once.
 *  - `lagDays` participates: a same-day coincidence and a 3-day-lagged one are different
 *    findings and both deserve a card.
 *  - `ruleId` deliberately does NOT participate. The model picks `ruleId` freely, so two
 *    papers stating the same rule would otherwise never collide — which is the exact
 *    failure G3 exists to prevent.
 *  - `paperId` deliberately does NOT participate, for the same reason. Cross-paper
 *    collision IS the point.
 */
export function blueprintDedupeKey(blueprint: unknown): string {
  const bp = blueprint as MirrorBlueprint;
  const condition = asRecord(bp.condition);
  const type = asString(condition['type']);

  if (type === 'coincidence') {
    const c = condition as unknown as MirrorCoincidence;
    const both = Array.isArray(c.both) ? c.both : [];
    const units = both
      .map((leaf) => `${asString(asRecord(leaf)['metricKey'])}@${leafShape(leaf)}`)
      .sort();
    const lag = c.lagDays === null || c.lagDays === undefined ? 'none' : String(c.lagDays);
    return `coincidence\0${units.join('|')}\0lag:${lag}`;
  }

  const metricKey = asString(condition['metricKey']);
  return `${type}\0${metricKey}@${leafShape(condition)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge policy on collision (#300 G3: "merge citations onto one blueprint, or supersede")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a blueprint's citations as a list. The shared contract holds a SINGLE
 * `provenance.citation`, so corroborating papers are merged into `provenance.sourceNote`
 * (a `string`, part of the accepted contract) while `citation` keeps the FIRST paper —
 * the one whose verbatim quote was gated. That keeps the strong guarantee intact: the
 * paper named in `citation` is always the paper whose quote passed the quote gate.
 */
function citationOf(blueprint: unknown): MirrorCitation | null {
  const provenance = asRecord(asRecord(blueprint)['provenance']);
  const citation = provenance['citation'];
  if (citation === null || citation === undefined) return null;
  const c = asRecord(citation);
  const paperId = asString(c['paperId']);
  if (paperId === '') return null;
  return { paperId, locator: typeof c['locator'] === 'string' ? c['locator'] : null };
}

/** Papers already credited in a merged blueprint's sourceNote, plus its primary citation. */
export function creditedPapers(blueprint: unknown): string[] {
  const provenance = asRecord(asRecord(blueprint)['provenance']);
  const note = asString(provenance['sourceNote']);
  const primary = citationOf(blueprint);
  const found = new Set<string>();
  if (primary) found.add(primary.paperId);
  for (const match of note.matchAll(/\bcorroborated by ([^;]+)/g)) {
    for (const id of asString(match[1]).split(',')) {
      const trimmed = id.trim();
      if (trimmed !== '') found.add(trimmed);
    }
  }
  return [...found];
}

export interface BlueprintDedupeResult {
  /** Blueprints to write — one per distinct dedupe key, citations merged. */
  toWrite: SynthBlueprintRecord[];
  /** Records folded into an earlier blueprint rather than written separately. */
  merged: Array<{ record: SynthBlueprintRecord; intoDedupeKey: string; mergedPaperId: string }>;
}

/**
 * G3 · Collapse blueprints sharing a dedupe key into ONE, merging corroborating paper ids
 * into `provenance.sourceNote`.
 *
 * `existing` carries dedupe keys already present in the target artifact so a re-run does not
 * re-emit a rule that previously landed (this is the blueprint half of G2's "never pay twice"
 * — the call is already spent, but the OUTPUT still must not duplicate).
 *
 * First occurrence wins for every field except `sourceNote`, so the surviving blueprint is
 * always one that passed the full gate in its own right.
 */
export function dedupeBlueprints(
  existing: ReadonlySet<string>,
  records: readonly SynthBlueprintRecord[],
): BlueprintDedupeResult {
  const toWrite: SynthBlueprintRecord[] = [];
  const merged: BlueprintDedupeResult['merged'] = [];
  const byKey = new Map<string, SynthBlueprintRecord>();

  for (const record of records) {
    const key = record.dedupeKey;

    // Already landed in a previous run — neither write nor merge.
    if (existing.has(key)) {
      merged.push({ record, intoDedupeKey: key, mergedPaperId: record.paperId });
      continue;
    }

    const winner = byKey.get(key);
    if (winner === undefined) {
      byKey.set(key, record);
      toWrite.push(record);
      continue;
    }

    // Collision within this batch: corroboration, not a second card.
    const credited = new Set(creditedPapers(winner.blueprint));
    if (!credited.has(record.paperId)) {
      const provenance = asRecord(winner.blueprint['provenance']);
      const note = asString(provenance['sourceNote']);
      const others = [...credited].filter((id) => id !== citationOf(winner.blueprint)?.paperId);
      const all = [...others, record.paperId].sort();
      const base = note.replace(/;?\s*corroborated by [^;]+/g, '').trimEnd().replace(/;$/, '');
      winner.blueprint = {
        ...winner.blueprint,
        provenance: { ...provenance, sourceNote: `${base}; corroborated by ${all.join(', ')}` },
      };
    }
    merged.push({ record, intoDedupeKey: key, mergedPaperId: record.paperId });
  }

  return { toWrite, merged };
}

/** Dedupe keys already present in a blueprint JSONL artifact (bad lines tolerated). */
export function existingBlueprintKeysFromText(text: string): Set<string> {
  const keys = new Set<string>();
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const line of clean.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const record = JSON.parse(line) as { dedupeKey?: unknown; blueprint?: unknown };
      if (typeof record.dedupeKey === 'string' && record.dedupeKey !== '') {
        keys.add(record.dedupeKey);
      } else if (record.blueprint !== undefined) {
        keys.add(blueprintDedupeKey(record.blueprint));
      }
    } catch {
      // tolerate a bad line — dedupe just won't match it
    }
  }
  return keys;
}

/** Convenience re-export shape for callers logging blueprint rejections. */
export type { RejectedBlueprint };
