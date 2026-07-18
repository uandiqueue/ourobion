// supabase/functions/generate-insights/render.ts
//
// S8 · card producer rendering (docs/shared/insight-engine-architecture.md §S8), pure:
// deterministic template fill + the RENDER-TIME copy gate. The deterministic template is the
// SHIPPED path — the §S8 phrasing LLM (Claude Haiku 4.5, cached, copy-gated) is a later,
// optional layer that this session deliberately leaves unwired; when it lands it only rephrases
// what these templates already say, and these templates remain its fallback.
//
// Copy gate: validateCopyString is imported STRAIGHT from the shared contract
// (shared/constants/copy_guidelines.ts is dependency-free TS, importable by Deno and node
// alike) — no vendored FORBIDDEN_WORDS copy, so the render gate can never drift from the
// load-time gate. A card whose final copy fails the gate, or whose template still contains an
// unresolved {{placeholder}}, is DROPPED and logged (defense in depth — the loader and the
// engine's load-time gate already block bad templates; rules-engine-design §C render.ts).
//
// Deno-free + dependency-free (beyond the shared contract) so tools/rules tests import it
// directly via tsx.

import { validateCopyString } from "../../../shared/constants/copy_guidelines.ts"

// ─── Producers (must stay character-identical to the insight_cards producer CHECK) ────────

export const PRODUCERS = ["rules", "edge", "personal"] as const
export type Producer = (typeof PRODUCERS)[number]

/** The composer cards' category — the value the §S8 migration added to the category CHECK. */
export const RELATIONSHIP_CATEGORY = "relationship"

/** rule_id namespaces (§S8: one table, three producers, disjoint key spaces). */
export function edgeRuleId(edgeId: string): string {
  return `edge:${edgeId}`
}
export function personalRuleId(metricA: string, metricB: string): string {
  return metricA < metricB ? `personal:${metricA}|${metricB}` : `personal:${metricB}|${metricA}`
}

// ─── Template fill ─────────────────────────────────────────────────────────────────────────

const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g

export interface FillResult {
  text: string
  /** Placeholders the values map could not resolve — any entry drops the card. */
  missing: string[]
}

/** Fill `{{snake_case}}` placeholders from a values map; unknown names are left and reported. */
export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): FillResult {
  const missing: string[] = []
  const text = template.replace(PLACEHOLDER, (raw, name: string) => {
    const value = values[name]
    if (value === undefined) {
      missing.push(name)
      return raw
    }
    return String(value)
  })
  return { text, missing }
}

// ─── Render + gate ─────────────────────────────────────────────────────────────────────────

export interface RenderedCopy {
  title: string
  body: string
}

export type RenderFailure =
  | { reason: "unresolved-placeholder"; field: "title" | "body"; placeholders: string[] }
  | { reason: "copy-gate"; field: "title" | "body" }

export type RenderResult =
  | { ok: true; copy: RenderedCopy }
  | { ok: false; failure: RenderFailure }

/**
 * Fill both templates and run the render-time copy gate on the FINAL text (not the raw
 * template — filled values are part of what the user reads). Any failure drops the card;
 * the caller logs it (§S8 failure mode: copy-gate failure -> card dropped + logged).
 */
export function renderCard(
  template: { title: string; body: string },
  values: Readonly<Record<string, string | number>>,
): RenderResult {
  const fields = ["title", "body"] as const
  const out: Record<string, string> = {}
  for (const field of fields) {
    const filled = fillTemplate(template[field], values)
    if (filled.missing.length > 0) {
      return {
        ok: false,
        failure: { reason: "unresolved-placeholder", field, placeholders: filled.missing },
      }
    }
    if (!validateCopyString(filled.text)) {
      return { ok: false, failure: { reason: "copy-gate", field } }
    }
    out[field] = filled.text
  }
  return { ok: true, copy: { title: out.title!, body: out.body! } }
}

// ─── The composer producers' deterministic templates (§S8 card variants) ───────────────────
//
// These are the SHIPPED copy for edge ("cited") and personal ("still researching") cards.
// Grounded by construction: every placeholder is filled from the ComposedInsight payload —
// no number or relation can appear that is not in the deterministic input. Causal wording
// appears only inside the quoted-citation framing ("published research reports ...") per the
// §S8 claim register; the personal variant states plainly that it is an unverified personal
// observation and carries no citation-like wording.

export const EDGE_CARD_TEMPLATE = {
  title: "Research-linked pattern: {{metric_a_label}} and {{metric_b_label}}",
  body:
    "Your {{metric_a_label}} data shifted {{direction_phrase}} today, and published research " +
    "reports that {{metric_a_label}} {{relation_phrase}} {{metric_b_label}}. Your own recent " +
    "data shows a matching pattern — worth watching, not a verdict.",
} as const

export const PERSONAL_CARD_TEMPLATE = {
  title: "Still researching: {{metric_a_label}} and {{metric_b_label}}",
  body:
    "Your {{metric_a_label}} and {{metric_b_label}} data have moved together in your recent " +
    "logs. This is an unverified personal observation from your own data only — we have not " +
    "found published research for this pairing yet and are still researching it.",
} as const

/** Human phrase for a monotonic relation, used inside the citation framing. */
export function relationPhrase(relation: string): string {
  return relation === "decreases" ? "tends to lower" : "tends to raise"
}

/** Human phrase for a signal direction. */
export function directionPhrase(state: "up" | "down"): string {
  return state === "up" ? "upward" : "downward"
}
