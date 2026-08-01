---
title: Co-movement edge card — let a correlational edge render a cited card without inventing a direction
summary: 13 of 14 verified edges carry `relation: 'correlates'`, which the monotonic `agree` rule can never match, so every correlational edge fell to `research-context` (gap-only) and `producer='edge'` was unreachable — 43 of 45 live cards were `personal` and none was cited. Added branch rule 2b (`coMovementEdge`) plus a directionless co-movement template and a third render gate that rejects directional wording. MONOTONIC_RELATIONS, relationSign, `cardEdge`, the serving-band gate, the quote gate and the copy gate are all untouched; contradiction still returns first.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Co-movement edge card (M5b · S7/S8)

Branch: `feat/m5b/comovement-edge-card`; base and exact head at branch cut: `f132cc1`
(`origin/dev-phase2-run4`); device: `agent-j`; agent: `claude` (Opus 5, 1M context). Isolated git
worktree; the main checkout was not touched (a long ingest was running there).

Territory: `supabase/functions/generate-insights/{composer.ts,render.ts,index.ts,composer_test.ts}`,
`tools/rules/tests/{engine_composer_render,engine_orientation_gap}.test.ts`, this log.

## Attempted

Make a servable **correlational** edge able to render a user-facing insight card, without any part
of the system synthesising a direction the paper never stated. This was the last thing between a
working pipeline and a cited card on screen.

## Confirmed, before changing anything

The dispatch diagnosis held up exactly:

- `classifyPattern` reaches the card-rendering `agree` branch only through
  `MONOTONIC_RELATIONS.has(e.relation) && edgeDirectionConsistent(e, states) === "consistent"`, and
  `MONOTONIC_RELATIONS` is `{increases, decreases}`. A `correlates` edge therefore always fell to
  rule 3 (`research-context`), which `rendersCard` deliberately never surfaces (O18(a), §S7).
- Both live coincidence rules (`data/rules/cross/gut/gut_comfort_mood_comove.json`,
  `data/rules/cross/behaviour/hrv_rise_after_sleep_rise.json`) fire on two `trend`/`equals: rising`
  leaves, so `leafStates` sets **both** endpoints to `up`. The "both metrics observed, same
  direction" precondition the new path needs is satisfied by the rules that actually exist — it is
  not a hypothetical shape.
- **A new `Branch` value was not an option.** `composed_insights.branch` carries a four-value CHECK
  (`20260716050639_...`), and a fifth value would need a migration applied to a live database, in a
  demo window, to say something `agree` already says truthfully.
- **`edge_refs` is how a citation reaches the card.** `get_insight_provenance`
  (`20260801091500_surface_edge_verification_caveats.sql`) joins `edge_refs[].edgeId` back to
  `relationship_claims` and returns `citations` and `quoteSpans` verbatim; the card widget
  (`insight_card_visual.dart` `_DeckPaperEvidence`) renders paper title, year and the quoted span on
  the card itself, and the provenance screen renders `caveat` under EVIDENCE QUALIFICATION. So
  writing `edge_refs` is exactly what makes the citation and the caveat appear — no new plumbing.
- The pre-existing `producer='rules'` coincidence card would have been useless here even if the
  branch had flipped: its `edge_refs` are filtered to `direction === 'consistent'` edges (O18), which
  is empty for a correlational pair, and that path never calls the artifact trust gate.

## Changed

### `composer.ts` — branch rule 2b, a new field, no widened sets

- **`CO_MOVEMENT_RELATIONS = {correlates}`**, documented as disjoint from `MONOTONIC_RELATIONS`
  (asserted by a unit vector). `modulates` is excluded because it is *asymmetric* — "moved together"
  would mistranslate it, not weaken it; `confounds` is a reason **not** to show a pairing; and
  `no_effect` denies one.
- **`coMovementEdgeFor(pattern, edges)`** with five independent preconditions: the pattern is a
  `coincidence` pattern over exactly two metrics; the edge spans **exactly** that pair; the relation
  is a co-movement relation **and** not monotonic; `relationSign(relation) === null`; and both
  endpoints were observed moving the **same** way. The last one is what makes "moved together" a
  literal report of the user's own two series rather than a paraphrase of the research — an up/down
  pairing gets no card, because a sign-free relation licenses nothing about opposite movement.
- **`ClassifiedPattern.coMovementEdge`** — a new, required field. It is deliberately NOT `cardEdge`:
  `cardEdge` is the directional seam (`relationPhrase(cardEdge.relation, …)` throws for a
  non-monotonic relation), so keeping it null makes the directional template *structurally
  unreachable* from the new path. The two fields are mutually exclusive by construction, since rules
  2 and 2b return from different branches.
- Rule 2b is placed **after** rule 2 and **after** contradiction, so an already-serving directional
  pattern is bit-for-bit unaffected and a live disagreement still wins.
- `rendersCard` gained one disjunct (`cardEdge !== null || coMovementEdge !== null`) rather than a
  second gate at the call site — it is still the single surfacing policy. `gapStatusFor` returns
  `null` for a co-movement-served pattern, because logging unmet demand for a pair the same run just
  served would double-count it against the edge that satisfied it.

### `render.ts` — a directionless template and a THIRD copy gate

- **`CO_MOVEMENT_EDGE_CARD_TEMPLATE` / `…_WITH_PERSONAL`** with the same A21 honesty split as the
  directional pair: the personal-corroboration clause ships only when a gate-passing personal signal
  actually backs it, and both variants share the title so the `(user_id, rule_id)` upsert identity
  does not move when a personal signal appears or lapses. Neither `{{direction_phrase}}` nor
  `{{relation_phrase}}` appears, and no third slot could carry a direction — the only fillable slots
  are two metric labels and the fixture disclosure.
- **`DIRECTIONAL_TERMS` + `renderCoMovementCard`** — the causal-verb gate is necessary but *not*
  sufficient here: "your sleep rose and your HRV rose" contains no causal verb, passes that gate, and
  still attributes a direction to each endpoint that a sign-free relation never stated. So a
  co-movement card additionally may contain none of ~30 direction-of-movement / direction-of-influence
  terms, checked on the FINAL filled text so an interpolated label or a future phrasing layer cannot
  smuggle one in.
- Wording is taken from this repo's own correlational vocabulary
  (`trust_labels.CLAIM_KIND_DESCRIPTIONS.correlational`), so the card and the claim-strength label a
  reader sees beside it cannot say different things.

### `index.ts` — a separate production block in the coincidence-rule handler

Runs the **same** fail-closed artifact trust gate as the directional card before any copy exists,
then `renderCoMovementCard`, then pushes `producer: 'edge'`, `rule_id: 'edge:'||edge_id`,
`category: 'relationship'`, and `edge_refs: [{edgeId, verifiedAt, caveat, claimKind, trust,
studyDesignTier}]`. It `continue`s, so the rule's own template is bypassed. The signal-pattern path
is untouched and carries an explicit comment that `coMovementEdge` is always null there.

## Decided

- **No gate was weakened and no set was widened.** `MONOTONIC_RELATIONS` is still exactly
  `{increases, decreases}` (pinned by a `deepEqual` vector); `relationSign('correlates')` still
  returns `null`; `edgeDirectionConsistent` still returns `null`, so the composed edge ref carries
  `direction: null` and `monotonic: false` and no downstream reader can mistake it for directional.
  The serving-band filter, the quote gate, `validateCopyString`, the causal-verb gate, the
  claim-kind fail-closed check and the artifact trust gate all run unchanged — the new path adds a
  gate, it removes none.
- **`agree` was reused rather than a fifth branch invented** — see the CHECK-constraint finding
  above. The app renders `branch` as a raw `Branch: agree` string with no directional wording, so
  reuse leaks nothing into the UI.
- **The caveat and the citation are NOT interpolated into the body.** They travel on `edge_refs` and
  are surfaced verbatim by the RPC. Inlining verifier free text would push untrusted prose through
  three copy gates, where one word like "higher" in an otherwise perfect caveat would drop the whole
  card — losing the citation in order to protect the wording.
- **The path does not depend on a personal signal.** `agree` treats `personal` as optional, and a
  dedicated vector proves a card renders with the row absent and with each of the three gate
  failures (q, n_eff, stable) — selecting the unbacked template each time. Only 3 of the demo pairs
  have a gate-passing signal, so a hidden dependency would have kept the surface empty.
- **`producer='personal'` cards were left exactly as they are.** A mid-task instruction to suppress
  them arrived and was withdrawn before any edit; `rendersCard`'s `idiosyncratic` behaviour is
  unchanged. Those cards are titled "Still researching" and state outright that no published
  research was found for the pairing, so they make no literature claim to be dishonest about.
- **No issue number was invented.** An earlier draft tagged the work `#354`; `#354` is an unrelated
  merged nao PR, so every reference was retagged to a plain `co-movement` marker.

## Left

- **Deployment is required before anything renders.** This is edge-function source; the hosted
  function must be redeployed and `generate-insights` re-run for the first `producer='edge'` row to
  exist. The 43 existing `producer='personal'` cards are untouched and will age out on their own
  7-day expiry.
- **The card still depends on an establishable claim kind.** `renderCoMovementCard` requires a
  non-null effective kind (`claim.claimKind` ∧ `verification.claimKindCheck.supportedKind`). If a
  live edge row is missing either, the card is dropped as `claim-kind-missing` — correctly, but it is
  the most likely reason a real run still produces nothing, and it is visible in the response's
  `cards.droppedAtRender`. I did not verify the hosted rows carry both (no DB access from the
  worktree, and the brief said reading the main checkout only).
- **`DIRECTIONAL_TERMS` is checked against filled copy, so a future metric label containing e.g.
  "fall" or "drop" would silently drop its co-movement card.** I checked all 22 active registry
  labels and none trips the list today; there is no guard test pinning that, so it is a real (if
  small) future trap rather than a solved problem.
- **Only `correlates` is admitted.** `modulates` edges remain `research-context`. That is deliberate
  (asymmetry), but it means a `modulates`-heavy synthesis run would again have no card route.

## Gates

- `deno check` clean on all five `generate-insights` files (`composer.ts`, `composer_test.ts`,
  `evaluators.ts`, `index.ts`, `render.ts`).
- `deno test` on `composer_test.ts`: **13/13 pass**, including the three acceptance vectors —
  (a) correlational edge + coincidence pattern ⇒ card renders with zero directional terms in the
  final copy, (b) correlational edge + single-metric signal ⇒ still no card (`research-context`,
  gap written), (c) contradiction still wins.
- `tools/rules`: `tsc --noEmit` clean; **179/179 tests pass** (was 167 before; the 5 files that
  initially failed did so on a missing `zod` — the worktree had no `shared/node_modules` — not on any
  change here).
- The `metrics-registry-to-engine` coupling-guard patterns (`metricKey: '<literal>'`,
  `RULES: Rule[]`) are absent from all four engine files.
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.

## Blockers

None in code. Rendering a card in the live demo needs the function redeployed and re-run, and needs
the hosted correlational edge rows to carry both claim-kind fields.

memory: Co-movement edge card — a correlational (`correlates`) edge can now render a cited card via
branch rule 2b (`ClassifiedPattern.coMovementEdge`, `coMovementEdgeFor`), which requires a
`coincidence` pattern over exactly the edge's pair with BOTH endpoints observed moving the SAME way.
It does NOT widen `MONOTONIC_RELATIONS`, does not map `correlates` onto increases/decreases, and
never sets `cardEdge` — so the directional template is structurally unreachable and
`relationSign('correlates')` still returns null. New third render gate `renderCoMovementCard` /
`DIRECTIONAL_TERMS` rejects direction-of-movement and direction-of-influence wording on the FINAL
copy, because the causal-verb gate alone lets "your X rose and your Y rose" through. Contradiction
still returns first; `research-context` stays gap-only; the card renders WITHOUT a gate-passing
personal signal. Reused `agree` rather than a fifth branch because `composed_insights.branch` has a
four-value CHECK that would need a live migration.
