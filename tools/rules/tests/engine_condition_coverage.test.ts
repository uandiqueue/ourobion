// Coupling guard: rules-blueprint-to-engine-coverage (docs/graph/couplings.yaml). Will assert that
// every condition `type` used by a data/rules blueprint has an evaluator branch in the refactored
// generate-insights engine (`evaluators.ts`), so an unevaluatable rule can never ship.
//
// status: planned — a runnable, skipped placeholder (couplings.yaml convention). The real
// assertions land with the engine refactor (rules-engine-design step C), which creates
// supabase/functions/generate-insights/evaluators.ts; until then there is no evaluator surface to
// check against.

import { test } from 'node:test';

test(
  'every blueprint condition_type has an evaluator branch in generate-insights',
  { skip: 'planned: evaluators.ts lands with the engine refactor (rules-engine-design step C)' },
  () => {},
);
