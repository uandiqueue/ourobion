---
title: Nao production build contract and local OpenNext evidence
summary: Declared and guarded the Nao build/runtime binding split, replaced the obsolete service-role client canary, and measured a fresh local Next/OpenNext build without claiming deployment.
type: session
scope: run4
status: canonical
updated: 2026-07-30
---

# Nao production build contract and local OpenNext evidence

Issue: #227 · branch: `fix/nao/production-build-contract` · base: `1caea13aeb61ab3cee1c3d3831b43142ceb75338`

## Attempted

- Make Nao's production-build contract explicit without deploying, accessing a hosted provider,
  reading real secret values, or adding a service-role dependency.
- Run fresh installed-only Next and OpenNext builds with synthetic values; inspect client canary
  absence, output-trace scope, Worker/tree bytes, and warnings observationally.
- Preserve the Run 4 frozen release gate while changing the synthetic client canary in lockstep.

## Changed

- Declared the Worker runtime names `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `OUROBION_INTERNAL_SECRET`, and `GH_ACTIONS_TOKEN` under Wrangler `secrets.required`; retained
  `GH_REPO` plus the already-landed `GH_ACTIONS_REF=dev-phase2-run4` as ordinary vars and retained
  the native `CORPUS` R2 / `DB` D1 bindings.
- Preserved `compatibility_date: 2024-12-01` and explicitly enabled
  `nodejs_compat_populate_process_env` alongside `nodejs_compat`, because this date predates the
  default and Nao's server routes consume the declared text bindings through `process.env`.
- Typed that exact runtime surface, removed the service-role pseudo-config from Nao's server env
  template, and documented the separate Next build-time public, Worker runtime, ordinary-var, and
  native-binding surfaces.
- Added a focused production-build contract guard for the exact config, env templates, binding
  types, and `outputFileTracingRoot: import.meta.dirname` pin.
- Added `OUROBION_INTERNAL_SECRET` to the server-only scanner names and changed the CI client bundle
  sentinel from the forbidden service-role variable to a synthetic internal-secret value. Re-froze
  the exact secret-scan workflow hash and expected environment in the release gate.
- Corrected the stale `NAO_INTERNAL_SECRET` register text and recorded the fresh measurements.

## Decided

- `SUPABASE_SERVICE_ROLE_KEY` is not part of Nao's build/runtime contract. The publishable key is a
  low-privilege transport key; the distinct internal secret is the relay's authorization input.
- Local artifact success is not Worker-secret delivery or deployment evidence. No byte or warning
  threshold was invented.
- Installed Wrangler 4.105.0 was the local schema authority. Its config/type generation produced all
  eight expected binding names with no missing names and generated the matching `NodeJS.ProcessEnv`
  picks for all six text bindings; no value was committed or read.
- The two apparent post-OpenNext trace escapes were generated Next runtime dependency copies caused
  by the validated external dependency junction: 31 files / 170,804 bytes, all under
  `node_modules`, with zero non-dependency source files. They were not source-scope escapes.

## Left

- Actual Cloudflare deployment, dashboard/runtime value delivery, hosted Supabase access, and hosted
  writes remain unproven and unauthorized here.
- Fresh local measurements: Next built all 19 routes plus middleware; OpenNext exited 0 and emitted a
  2,278-byte `.open-next/worker.js` in a 180-file / 8,740,393-byte tree. The synthetic internal-secret
  canary was absent from 47 Next client files, 59 OpenNext client files, and the Worker. Worker syntax
  passed and all eight emitted relative imports resolved to files inside `.open-next`.
- Observed OpenNext/build warnings: Windows compatibility caveat, `compatibility_date` age, expected
  absent local env templates under synthetic process env, two Webpack large-string cache advisories,
  Supabase browser-client Edge-runtime `process.version`, and an `EPERM` standalone-copy warning from
  the temporary dependency junction. All generated build, junction, env, and sibling-copy residue
  was removed after measurement.

## Blockers

- None for the approved local build-contract scope. Hosted delivery/deployment remains separate work.

memory: none
