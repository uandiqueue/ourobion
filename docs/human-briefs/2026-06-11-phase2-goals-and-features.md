# What Phase 2 of biotope is — in plain language

**Date:** 2026-06-11 · **Detail:** [`../PHASE2-GOALS-AND-FEATURES.md`](../PHASE2-GOALS-AND-FEATURES.md)

## The problem

Biotope's goals were scattered across a dozen technical documents using four different phase
labels ("Phase 1 Stage 2", "Phase 2", "Phase 3", "Phase 0 backlog"). Nobody could read one page
and know what we're building next. This brief and its detail doc fix that: every past and present
goal is now consolidated in one place, and "Phase 2" has a clear shape.

## What the app does today

You log a few health signals (gut, hydration, mosquito exposure) in under 30 seconds a day. The
app computes your personal baselines and shows simple pattern cards — "your hydration has been
trending down this week" — never a diagnosis. Streaks and titles keep you logging. That loop works
end to end.

## What Phase 2 adds

1. **Your watch and phone join in.** Apple Health and Android Health Connect feed sleep, heart
   rate, and similar signals automatically — verified working on real devices.
2. **Insights get genuinely smart.** Today's six hardcoded patterns become an engine that reads
   rules written as reviewable data files — including rules that *combine* signals ("sleep down
   AND gut comfort down"), each card able to explain why it appeared. Rules can come from research
   papers via an AI-assisted, human-reviewed extraction step. The engine itself stays fully
   deterministic.
3. **Your region appears next to you.** The first community layer: privacy-safe regional patterns
   ("your area this week"), published only when enough users exist in a region, opt-in only.
4. **Logging stays rewarding.** Missions and challenges beyond the daily streak; rewards for
   engaging with insights, not just logging.
5. **Housekeeping that makes it possible.** Finishing MVP loose ends first (incomplete data
   contracts, placeholder tests, three unbuilt logging flows), and a knowledge-graph tool
   (graphify) that keeps the growing codebase navigable for AI assistants — internal tooling, not
   a user feature.

## Decisions we need

- **Environmental data (weather, dengue rates) in Phase 2 or later?** It's the "One Health"
  differentiator and makes the best combined insights — recommended in, scoped small.
- **Buy the US$99/yr Apple Developer account now?** It unblocks both iPhone health testing and
  Apple Sign-In; otherwise Phase 2 ships Android-first.
- **How big is the first community slice** — view-only regional patterns, or leaderboards too?
- **The research paper(s)** for rule extraction still need to be provided.
