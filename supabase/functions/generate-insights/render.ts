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
// R4-U4/O27: the claim-strength vocabulary and the causal-verb gate. Imported STRAIGHT from the
// shared contract for the same reason validateCopyString is — one definition, no vendored copy
// that could drift. trust_labels.ts is deliberately import-free so Deno can load it here.
import {
  causalCopyViolations,
  POSTURE_DISCLOSURES,
  relationPhraseFor,
} from "../../../shared/brain/trust_labels.ts"

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
  /** R4-U4/B-SCI1: the copy asserts causation the claim kind does not license. */
  | { reason: "causal-copy-gate"; field: "title" | "body"; terms: string[]; claimKind: string }
  /** R4-U4/B-SCI1: a cited card whose claim kind could not be established at all. */
  | { reason: "claim-kind-missing"; field: "title" | "body" }

export type RenderResult =
  | { ok: true; copy: RenderedCopy }
  | { ok: false; failure: RenderFailure }

/**
 * R4-U4/B-SCI1 · The claim-strength context a cited card renders under.
 *
 * `effectiveKind` is the weaker of the synthesised and verifier-supported kinds. It is
 * `string | null` rather than optional so a caller cannot forget it: passing null is an explicit
 * statement that the kind is unknown, and unknown BLOCKS a cited render.
 */
export interface ClaimKindContext {
  effectiveKind: string | null
}

/**
 * Fill both templates and run the render-time copy gates on the FINAL text (not the raw
 * template — filled values are part of what the user reads). Any failure drops the card;
 * the caller logs it (§S8 failure mode: copy-gate failure -> card dropped + logged).
 *
 * TWO gates now run, in order:
 *   1. the non-diagnostic copy gate (validateCopyString, docs/memory/0003) — unchanged;
 *   2. R4-U4/B-SCI1 the CAUSAL-VERB gate — when `claimKind` is supplied, copy whose effective
 *      claim kind is weaker than `causal` may contain no causal verb at all. This is defence in
 *      depth behind `relationPhrase`: even if a template, a metric label, or a future phrasing
 *      layer introduces causal wording by another route, a correlational card cannot ship with it.
 *
 * `claimKind` is omitted by the uncited "still researching" personal card, which makes no
 * research claim and therefore has no claim kind to honour. Every CITED card must pass it.
 */
export function renderCard(
  template: { title: string; body: string },
  values: Readonly<Record<string, string | number>>,
  claimKind?: ClaimKindContext,
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
    if (claimKind !== undefined) {
      // Fail closed: a cited card whose claim kind is unknown is dropped, never rendered on the
      // assumption that some weaker kind was meant.
      if (claimKind.effectiveKind === null) {
        return { ok: false, failure: { reason: "claim-kind-missing", field } }
      }
      const terms = causalCopyViolations(
        filled.text,
        claimKind.effectiveKind as Parameters<typeof causalCopyViolations>[1],
      )
      if (terms.length > 0) {
        return {
          ok: false,
          failure: {
            reason: "causal-copy-gate",
            field,
            terms,
            claimKind: claimKind.effectiveKind,
          },
        }
      }
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

// A21 honesty split: D14 lets the agree branch fire with the personal signal absent or
// non-gate-passing, so the "Your own recent data shows a matching pattern" clause ships ONLY
// when a gate-passing personal signal actually backs it (D15 posture: never claim corroboration
// the data does not hold). Both variants are deterministic templates; edgeCardTemplate picks.

// R4-U4/B-UI9: `{{posture_disclosure}}` leads the body so a fixture-derived card discloses that
// BEFORE it states the claim. It resolves to the empty string for a live artifact, so a live
// card reads exactly as it did before.

export const EDGE_CARD_TEMPLATE = {
  title: "Research-linked pattern: {{metric_a_label}} and {{metric_b_label}}",
  body:
    "{{posture_disclosure}}Your {{metric_a_label}} data shifted {{direction_phrase}} today, and " +
    "published research reports that {{metric_a_label}} {{relation_phrase}} {{metric_b_label}}. " +
    "Worth watching, not a verdict.",
} as const

export const EDGE_CARD_TEMPLATE_WITH_PERSONAL = {
  title: "Research-linked pattern: {{metric_a_label}} and {{metric_b_label}}",
  body:
    "{{posture_disclosure}}Your {{metric_a_label}} data shifted {{direction_phrase}} today, and " +
    "published research reports that {{metric_a_label}} {{relation_phrase}} {{metric_b_label}}. " +
    "Your own recent data shows a matching pattern — worth watching, not a verdict.",
} as const

/**
 * R4-U4/B-UI9 · The disclosure that leads a card's body.
 *
 * A FIXTURE-derived card says so before it says anything else. A live card adds nothing (an
 * unconditional "built from a live source" banner would be noise on every card). A NULL posture
 * never reaches here — the trust gate blocks an edge with no posture before rendering — so this
 * throws rather than inventing a disclosure for an unknown provenance.
 */
export function postureDisclosure(posture: string | null): string {
  if (posture === "fixture") return `${POSTURE_DISCLOSURES.fixture} `
  if (posture === "live") return ""
  throw new Error(
    `postureDisclosure: artifact posture ${JSON.stringify(posture)} is not disclosable — ` +
      `the trust gate must block this edge before render (B-UI9 fail-closed)`,
  )
}

/** The agree-branch edge-card template: pairwise corroboration copy only when it is backed. */
export function edgeCardTemplate(
  hasGatePassingPersonal: boolean,
): typeof EDGE_CARD_TEMPLATE | typeof EDGE_CARD_TEMPLATE_WITH_PERSONAL {
  return hasGatePassingPersonal ? EDGE_CARD_TEMPLATE_WITH_PERSONAL : EDGE_CARD_TEMPLATE
}

export const PERSONAL_CARD_TEMPLATE = {
  title: "Still researching: {{metric_a_label}} and {{metric_b_label}}",
  body:
    "Your {{metric_a_label}} and {{metric_b_label}} data have moved together in your recent " +
    "logs. This is an unverified personal observation from your own data only — we have not " +
    "found published research for this pairing yet and are still researching it.",
} as const

/**
 * Human phrase for a MONOTONIC relation, used inside the citation framing.
 *
 * R4-U4/B-SCI1 — THE FIX. This function used to return "tends to raise" / "tends to lower" for
 * every edge regardless of what the research actually claimed, so a purely CORRELATIONAL finding
 * ("X is associated with higher Y") was rendered to users as a causal one. The phrase is now
 * selected by the EFFECTIVE claim kind — the weaker of the synthesised kind and the kind the
 * verifier independently found supportable — from the shared, TS/Dart parity-guarded vocabulary.
 *
 * Throws in two cases, both fail-closed:
 *   * `effectiveKind` is null — the row could not establish a claim kind, so no directional
 *     wording may be emitted at all (a "safe" default would fabricate a judgment nobody made);
 *   * the relation is not monotonic (A23) — a context-only relation (`modulates`/`correlates`)
 *     must never be verbalised as a directional claim (§1.3 monotonic-only invariant).
 * Callers reach this only with an agree-branch cardEdge, which is monotonic by construction, so
 * a throw is a bug surfacing loudly rather than a runtime hazard.
 */
export function relationPhrase(relation: string, effectiveKind: string | null): string {
  if (effectiveKind === null) {
    throw new Error(
      `relationPhrase: relation "${relation}" has no established claim kind — refusing to emit ` +
        `directional wording (B-SCI1 fail-closed)`,
    )
  }
  return relationPhraseFor(
    effectiveKind as Parameters<typeof relationPhraseFor>[0],
    relation as Parameters<typeof relationPhraseFor>[1],
  )
}

/** Human phrase for a signal direction. */
export function directionPhrase(state: "up" | "down"): string {
  return state === "up" ? "upward" : "downward"
}
