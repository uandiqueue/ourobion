---
title: Run 4 provider-backed paper and Biotope insight test
summary: Exercised OpenAI passage synthesis after full local paper extraction, verifier-only Anthropic abstention, the fixed-edge 21-day local flow, and physical-Android rendering.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 provider-backed paper and Biotope insight test

Issue: #189
Branch: `test/brain/run4-provider-e2e`

## Attempted

- Reused the existing provider credentials under explicit SGD 20 OpenAI / SGD 2 Anthropic ceilings.
- Corrected the live-test roles to OpenAI main paper synthesis and Anthropic verifier-only.
- Extracted and canonicalized the complete 91,162-character DOI paper locally; the current synthesis
  path selected and sent 12 evidence passages to OpenAI, then ran deterministic claim gates.
- Ran one Anthropic verification with echo-controlled independent retrieval.
- Reset only local Supabase, loaded fixed edges plus 21 days of simulated health rows, ran the full
  pipeline, and inspected the installed app on the connected physical Android phone.

## Changed

- Added `docs/temp/run4/provider-e2e-status.md` and linked it from the Run 4 cockpit.
- Recorded the bounded provider-test exception in `human-decisions.md`.
- No product source, schema, shared contract, UI, model-training file or hosted system changed.

## Decided

- OpenAI is the main paper-synthesis provider; Anthropic has only the final verifier role. The current
  runtime's OpenAI prompt remains limited to 12 selected passages.
- The initial reversed-role calls are superseded evidence but remain counted in spend.
- One paper cannot independently corroborate itself; the resulting edge remains held.
- The fixed-edge path is the serving/render proof until independent real-paper support exists.

## Left

- Checked-in router config still runs OpenAI for both nodes and conflicts with the corrected provider
  ownership; this test used an isolated in-memory config.
- B-PL22 sentence provenance remains implementation-deferred.
- The provider run exposed an RCT -> evidence-tier-5 semantic mismatch not caught by current gates.
- Complete-paper provider prompt coverage was not achieved: extraction covered the complete paper, but
  the checked-in synthesis path sent 12 selected passages.
- Android UI rendering should be repeated after the separately owned final UI lands.

## Blockers

- Durable provider-role configuration requires reconciling the current verifier-non-Anthropic invariant
  and inaccurate fixed test-mode label.
- A servable real-paper edge requires at least one independent corroborating source.

memory: none
