import { classifyPattern, type ServableEdge } from "./composer.ts"

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
