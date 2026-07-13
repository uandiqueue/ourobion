> **ARCHIVED 2026-07-13 — superseded / historical. Do not build from this; kept for provenance.** Current source of truth: [phase-2-plan.md](../../shared/phase-2-plan.md).

# The Phase 2 plan — in plain language

**Date:** 2026-06-11 · **Status:** ⛔ **Superseded snapshot** — the current plan is [`../PHASE2-PLAN.md`](../../shared/PHASE2-PLAN.md) (demo scope; 100-metric expansion; brain pipeline + nao). Kept as a dated snapshot.

## The shape

Phase 2 runs **two months** (~mid-June to ~mid-August 2026) in **two parallel tracks** after a
shared start:

1. **Everyone first clears the housekeeping** (~2 weeks): finishing the incomplete data contracts,
   making the placeholder tests real, replacing the dev home screen, building the three missing
   logging flows (standing water, symptoms, antibiotics).
2. **Then graphify** — the knowledge-graph tool that keeps the codebase navigable for AI assistants.
   Internal tooling, quick, and the last thing both tracks share.
3. **Then the work splits:**
   - **Track A (app & data):** environmental data first (Singapore weather, UV, dengue clusters —
     the "One Health" differentiator), then Android health integration verified on a real device,
     then the first community layer — patterns across **all users** (no region splitting yet; we're
     testing the app) plus a simple chat.
   - **Track B (engine):** the insights engine — rules become reviewable data files, the engine
     evaluates them, including rules that combine signals, with each card able to explain itself.
4. **The tracks merge** in week 8: baselines extend over the new wearable and environmental data,
   and the first combined rules go live (e.g. rainfall × mosquito sightings).
5. **Week 9 is the stress test** — the gate to Phase 3: rules loading purely from data, single and
   cross-metric cards generating from real users on Android, the nightly cycle running 7 straight
   days untouched.

## What was decided

- **Environment is in** (it makes the best combined insights), scoped small: Singapore, 2–3 sources.
- **Android only for now.** The Apple question (US$99/yr developer account + Mac) is decided at the
  end of Phase 2; if approved, it's built before Phase 3 starts.
- **Community is global, not regional, for now** — we're testing the app, not launching it. Regional
  privacy thresholds come back when there are enough users to need them.
- **Gamification is Phase 3 and much bigger than badges**: conceptually an entire game inside the
  health app (open-world, pixel-art, D&D playstyle — nothing confirmed yet), alongside a full UI
  redesign with Blender-rendered, AI-assisted visuals. None of it starts until the stress test passes.

## Still pending

The research paper(s) that feed the rule-extraction step. The engine ships either way — the first
rules can be written by hand.
