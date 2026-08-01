import {
  classifyPattern,
  CO_MOVEMENT_RELATIONS,
  coMovementEdgeFor,
  gapStatusFor,
  MONOTONIC_RELATIONS,
  rendersCard,
  type CandidatePattern,
  type PersonalSignalRow,
  type ServableEdge,
} from "./composer.ts"
import {
  CO_MOVEMENT_EDGE_CARD_TEMPLATE,
  CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL,
  coMovementEdgeCardTemplate,
  directionalTermsIn,
  renderCoMovementCard,
} from "./render.ts"

const pattern = {
  patternKey: "rule:gut-comfort-mood",
  kind: "coincidence" as const,
  metricKeys: ["gut_comfort_score", "mood_score"],
  states: { gut_comfort_score: "up" as const, mood_score: "up" as const },
  stats: {},
}

function edge(caveat?: string | null): ServableEdge {
  return {
    edge_id: "gut_comfort_score|increases|mood_score",
    subject: "gut_comfort_score",
    object: "mood_score",
    relation: "increases",
    verified_at: "2026-08-01T00:00:00Z",
    edge_score: 0.81,
    serving_band: "mid",
    caveat,
    claim: { citations: [{ paperId: "doi:10.1000/example" }] },
  }
}

Deno.test("composer preserves a verifier caveat verbatim on its edge ref", () => {
  const caveat =
    "The evidence comes from one observational cohort, so the relationship may not transfer to every setting."
  const result = classifyPattern(pattern, [edge(caveat)], () => null, {
    qMax: 0.05,
    nEffMin: 10,
  })

  if (result?.edges[0]?.caveat !== caveat) {
    throw new Error("composer changed or dropped the verifier caveat")
  }
})

Deno.test("composer keeps a pre-caveat verification explicitly unqualified", () => {
  const result = classifyPattern(pattern, [edge()], () => null, {
    qMax: 0.05,
    nEffMin: 10,
  })

  if (result?.edges[0]?.caveat !== null) {
    throw new Error("missing caveat must remain null")
  }
})

// ─── the co-movement edge card ────────────────────────────────────────────────────────
//
// THE DEFECT THESE VECTORS PIN: 13 of 14 verified edges carry `relation: 'correlates'`, which the
// monotonic `agree` rule can never match, so every correlational edge fell to `research-context`
// (gap-only) and NO `producer='edge'` card was reachable. The acceptance set is exactly the three
// cases that distinguish "a correlational edge can be cited" from "a direction was invented":
//   (a) correlational edge + coincidence pattern  ⇒ a card renders, with no directional language
//   (b) correlational edge + single-metric signal ⇒ still NO card
//   (c) a contradiction over the same pair        ⇒ contradiction still wins

const GATES = { qMax: 0.05, nEffMin: 10 }

/** The real demo edge: gut_comfort_score --correlates--> mood_score, band mid, trusted live. */
function correlatesEdge(partial: Partial<ServableEdge> = {}): ServableEdge {
  return {
    edge_id: "gut_comfort_score|correlates|mood_score",
    subject: "gut_comfort_score",
    object: "mood_score",
    relation: "correlates",
    verified_at: "2026-08-01T00:00:00Z",
    edge_score: 0.62,
    serving_band: "mid",
    caveat: "The evidence comes from observational cohorts, so the pairing may not transfer to every setting.",
    claim: {
      citations: [{ paperId: "doi:10.1000/gut-brain" }],
      claimKind: "correlational",
    },
    verification: { claimKindCheck: { matchesClaim: true, supportedKind: "correlational" } },
    ...partial,
  }
}

function personalRow(partial: Partial<PersonalSignalRow> = {}): PersonalSignalRow {
  return {
    metric_a: "gut_comfort_score",
    metric_b: "mood_score",
    rho: 0.778,
    n_eff: 29.6,
    q_value: 0,
    stable: true,
    ...partial,
  }
}

function firedSignal(metricKey: string): CandidatePattern {
  return {
    patternKey: `signal:${metricKey}:up`,
    kind: "signal",
    metricKeys: [metricKey],
    states: { gut_comfort_score: "up", mood_score: "up" },
    stats: {},
  }
}

Deno.test("co-movement (a) correlational edge + coincidence pattern renders a cited co-movement card", () => {
  const result = classifyPattern(pattern, [correlatesEdge()], () => personalRow(), GATES)
  if (result === null) throw new Error("a servable correlational edge must not classify to null")
  if (result.branch !== "agree") throw new Error(`expected agree, got ${result.branch}`)
  if (result.coMovementEdge?.edge_id !== "gut_comfort_score|correlates|mood_score") {
    throw new Error("the correlational edge must be carried as coMovementEdge")
  }
  // The DIRECTIONAL seam must stay empty — `cardEdge` is what drives relationPhrase(), which
  // throws for a non-monotonic relation.
  if (result.cardEdge !== null) throw new Error("a correlational edge must never become cardEdge")
  if (!rendersCard(result)) throw new Error("rendersCard must admit the co-movement path")
  if (gapStatusFor(result) !== null) throw new Error("a served co-movement card is not a gap")
  // The edge ref keeps direction null and monotonic false — nothing downstream can read a sign.
  if (result.edges[0]?.direction !== null) throw new Error("a correlational edge ref must carry direction null")
  if (result.edges[0]?.monotonic !== false) throw new Error("a correlational edge ref must not be monotonic")
  // The caveat and the citation — the whole point of a cited card — survive onto the ref.
  if (result.edges[0]?.caveat !== correlatesEdge().caveat) throw new Error("caveat lost")
  if (result.edges[0]?.citations[0]?.paperId !== "doi:10.1000/gut-brain") {
    throw new Error("citation lost")
  }

  const rendered = renderCoMovementCard(
    coMovementEdgeCardTemplate(result.personal !== null),
    { metric_a_label: "Gut comfort", metric_b_label: "Mood", posture_disclosure: "" },
    { effectiveKind: "correlational" },
  )
  if (!rendered.ok) throw new Error(`co-movement copy was rejected: ${JSON.stringify(rendered)}`)
  const expectedTitle = "Research-linked pattern: Gut comfort and Mood moved together"
  const expectedBody = "Your Gut comfort and Mood data moved together in your recent logs, and " +
    "published research reports that these two move together. The same pairing also holds " +
    "across your own longer history. Direction of influence was not established. Worth " +
    "watching, not a verdict."
  if (rendered.copy.title !== expectedTitle) throw new Error(`title drifted: ${rendered.copy.title}`)
  if (rendered.copy.body !== expectedBody) throw new Error(`body drifted: ${rendered.copy.body}`)
  // NO DIRECTIONAL LANGUAGE, asserted on the final copy rather than on the template.
  for (const field of ["title", "body"] as const) {
    const terms = directionalTermsIn(rendered.copy[field])
    if (terms.length > 0) throw new Error(`co-movement ${field} states a direction: ${terms.join(",")}`)
  }
})

// THE INDEPENDENCE VECTOR. Only 3 of the demo pairs have a gate-passing personal signal, so if the
// co-movement path silently depended on one, every other servable correlational pair would still
// produce nothing and the surface would stay empty. `agree` treats `personal` as OPTIONAL (branch
// rule 2/2b attach it when it passes the gate and null otherwise), and that must hold here.
Deno.test("co-movement renders WITHOUT a gate-passing personal signal (personal is optional)", () => {
  for (const personalFor of [
    () => null, // no personal_signals row for the pair at all
    () => personalRow({ q_value: 0.4 }), // present but fails the q gate
    () => personalRow({ n_eff: 4 }), // present but fails the n_eff gate
    () => personalRow({ stable: false }), // present but not stable
  ]) {
    const result = classifyPattern(pattern, [correlatesEdge()], personalFor, GATES)
    if (result?.branch !== "agree") throw new Error(`expected agree, got ${result?.branch}`)
    if (result.coMovementEdge === null) throw new Error("the co-movement edge must still be selected")
    if (result.personal !== null) throw new Error("a non-gate-passing personal row must not attach")
    if (!rendersCard(result)) throw new Error("a card must render with no gate-passing personal signal")

    // A21 honesty split: the copy must then NOT claim the user's own history corroborates it.
    const rendered = renderCoMovementCard(
      coMovementEdgeCardTemplate(result.personal !== null),
      { metric_a_label: "Gut comfort", metric_b_label: "Mood", posture_disclosure: "" },
      { effectiveKind: "correlational" },
    )
    if (!rendered.ok) throw new Error(`unbacked co-movement copy was rejected: ${JSON.stringify(rendered)}`)
    if (rendered.copy.body.includes("your own longer history")) {
      throw new Error("the unbacked variant must not claim personal corroboration")
    }
    if (
      rendered.copy.body !==
        "Your Gut comfort and Mood data moved together in your recent logs, and published " +
        "research reports that these two move together. Direction of influence was not " +
        "established. Worth watching, not a verdict."
    ) {
      throw new Error(`unbacked body drifted: ${rendered.copy.body}`)
    }
  }
})

Deno.test("co-movement (b) correlational edge + single-metric signal pattern still renders NO card", () => {
  // Only ONE endpoint fired. "These two moved together" would state movement the run never
  // observed for the other metric — the same rule as O16, applied to co-movement wording.
  for (const metricKey of ["gut_comfort_score", "mood_score"]) {
    const result = classifyPattern(firedSignal(metricKey), [correlatesEdge()], () => personalRow(), GATES)
    if (result?.branch !== "research-context") {
      throw new Error(`single-metric signal must stay research-context, got ${result?.branch}`)
    }
    if (result.coMovementEdge !== null) throw new Error("a signal pattern must never get a coMovementEdge")
    if (rendersCard(result)) throw new Error("a single-metric correlational pattern must render no card")
    if (gapStatusFor(result) !== "blocked-completeness") {
      throw new Error("research-context must still write its gap event")
    }
  }
})

Deno.test("co-movement (c) contradiction still wins over the co-movement path", () => {
  // The pair carries BOTH a correlational edge and a monotonic one, and the user's own
  // gate-passing signal opposes the monotonic edge. A co-movement card must not paper over that.
  const monotonic: ServableEdge = {
    ...correlatesEdge(),
    edge_id: "gut_comfort_score|increases|mood_score",
    relation: "increases",
    edge_score: 0.9,
  }
  const result = classifyPattern(
    pattern,
    [correlatesEdge(), monotonic],
    () => personalRow({ rho: -0.7 }),
    GATES,
  )
  if (result?.branch !== "contradiction") throw new Error(`expected contradiction, got ${result?.branch}`)
  if (result.coMovementEdge !== null) throw new Error("contradiction must carry no coMovementEdge")
  if (result.cardEdge !== null) throw new Error("contradiction must carry no cardEdge")
  if (rendersCard(result)) throw new Error("contradiction must never render a card")
  if (gapStatusFor(result) !== "needs-review") throw new Error("contradiction must stay needs-review")
})

Deno.test("co-movement the co-movement relation set stays disjoint from the monotonic one", () => {
  for (const relation of CO_MOVEMENT_RELATIONS) {
    if (MONOTONIC_RELATIONS.has(relation)) {
      throw new Error(`relation "${relation}" cannot be both a direction and a co-movement carrier`)
    }
  }
  // `modulates` is asymmetric, `confounds` is a reason NOT to show a pairing, `no_effect` denies
  // one — none may render a co-movement card.
  for (const relation of ["modulates", "confounds", "no_effect", "increases", "decreases"]) {
    const out = coMovementEdgeFor(pattern, [correlatesEdge({ relation })])
    if (out !== null) throw new Error(`relation "${relation}" must not qualify as co-movement`)
  }
})

Deno.test("co-movement opposite-direction endpoints are not co-movement", () => {
  const opposed = { ...pattern, states: { gut_comfort_score: "up" as const, mood_score: "down" as const } }
  if (coMovementEdgeFor(opposed, [correlatesEdge()]) !== null) {
    throw new Error("an up/down pairing is not co-movement — `correlates` carries no sign to license it")
  }
  const result = classifyPattern(opposed, [correlatesEdge()], () => personalRow(), GATES)
  if (result?.branch !== "research-context") throw new Error("opposed endpoints must fall to research-context")
  if (rendersCard(result)) throw new Error("opposed endpoints must render no card")
})

Deno.test("co-movement an edge that only touches the pair does not qualify", () => {
  const elsewhere = correlatesEdge({
    edge_id: "mood_score|correlates|hrv_sdnn_ms",
    subject: "mood_score",
    object: "hrv_sdnn_ms",
  })
  if (coMovementEdgeFor(pattern, [elsewhere]) !== null) {
    throw new Error("a co-movement edge must span EXACTLY the fired pair")
  }
})

Deno.test("co-movement the A21 honesty split holds for the co-movement variants", () => {
  const CLAUSE = "The same pairing also holds across your own longer history."
  if (CO_MOVEMENT_EDGE_CARD_TEMPLATE.body.includes(CLAUSE)) {
    throw new Error("the unbacked variant must not claim the user's own history matches")
  }
  if (!CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL.body.includes(CLAUSE)) {
    throw new Error("the backed variant must state the personal corroboration")
  }
  if (CO_MOVEMENT_EDGE_CARD_TEMPLATE.title !== CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL.title) {
    throw new Error("both variants must share the title so the upsert identity is stable")
  }
  if (coMovementEdgeCardTemplate(false) !== CO_MOVEMENT_EDGE_CARD_TEMPLATE) {
    throw new Error("no gate-passing personal signal must select the unbacked variant")
  }
  if (coMovementEdgeCardTemplate(true) !== CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL) {
    throw new Error("a gate-passing personal signal must select the backed variant")
  }
})

Deno.test("co-movement the co-movement templates cannot express a direction at all", () => {
  for (const template of [CO_MOVEMENT_EDGE_CARD_TEMPLATE, CO_MOVEMENT_EDGE_CARD_TEMPLATE_WITH_PERSONAL]) {
    for (const field of ["title", "body"] as const) {
      for (const forbidden of ["{{direction_phrase}}", "{{relation_phrase}}"]) {
        if (template[field].includes(forbidden)) {
          throw new Error(`the co-movement template must have no ${forbidden} slot`)
        }
      }
    }
  }
})

Deno.test("co-movement the directional-copy gate DROPS co-movement copy that states a direction", () => {
  const leaky = {
    title: "Research-linked pattern: {{metric_a_label}} and {{metric_b_label}}",
    body: "Your {{metric_a_label}} data rose and your {{metric_b_label}} data rose with it.",
  }
  const out = renderCoMovementCard(
    leaky,
    { metric_a_label: "Gut comfort", metric_b_label: "Mood" },
    { effectiveKind: "correlational" },
  )
  if (out.ok) throw new Error("copy stating that each metric rose must not ship on a co-movement card")
  if (out.failure.reason !== "directional-copy-gate") {
    throw new Error(`expected directional-copy-gate, got ${out.failure.reason}`)
  }
})

Deno.test("co-movement a co-movement card with no established claim kind is dropped", () => {
  const out = renderCoMovementCard(
    coMovementEdgeCardTemplate(false),
    { metric_a_label: "Gut comfort", metric_b_label: "Mood", posture_disclosure: "" },
    { effectiveKind: null },
  )
  if (out.ok) throw new Error("a cited card must not render without an established claim kind")
  if (out.failure.reason !== "claim-kind-missing") {
    throw new Error(`expected claim-kind-missing, got ${out.failure.reason}`)
  }
})
