---
title: docs/memory — durable cross-device memory index
summary: Index of durable one-fact records for architectural decisions, product and security boundaries, domain gotchas, and schema rationale; measured run state belongs elsewhere.
type: index
scope: repo
status: canonical
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T22:08:41Z
---
# docs/memory — durable, cross-device memory

One durable fact per file (architectural decisions, domain gotchas, security boundaries, schema
rationale), git-tracked so
it travels across machines and agent CLIs — the in-repo equivalent of device-local `~/.claude` /
`~/.gemini` memory, which does **not** travel.

These records are distilled from owner decisions, executable boundaries, authored architecture, and
session learnings. They are quick-reference pointers, not substitutes for their owning code,
migrations, contracts, or design documents.

A memory belongs here only when it is expected to guide future work across sessions and is costly or
dangerous to rediscover incorrectly. Current counts, spend, deployment status, run outcomes, temporary
blockers, branch state, and delivery milestones belong in dated session/run evidence instead. Exact
commands and setup walkthroughs belong in their owning README or runbook. When a fact can age, the
memory points to the executable or authored authority that must be rechecked.

> **Enforcement:** `node tools/context_sync.mjs --check` (run by the pre-push hook + CI) fails on a
> dangling link here or an unindexed `*.md` in this directory. Keep this index and the files in
> lockstep — add a line here whenever you add a fact file.

## Index

<!-- BEGIN GENERATED -->
- [Two-tier truth, including mixed records](0001-two-tier-truth.md) — Preserve authored inputs and user choices; rebuild analytical outputs. Insight cards are mixed records whose generated content is projection but whose user-controlled lifecycle state is truth.
- [Shared contract changes normally need two reviewers](0002-shared-contract-two-reviewers.md) — Shared-contract changes normally need two team reviewers; when one is genuinely unavailable, Jayden may explicitly authorize an exception as project lead, with the exception recorded in the issue or PR.
- [Non-diagnostic language is mandatory for all user-facing copy](0003-non-diagnostic-copy.md) — User-facing copy remains observational and non-diagnostic while exposing evidence strength, uncertainty, disagreement, and provenance so users can judge the evidence chain rather than receiving a hidden or inflated conclusion.
- [HRV SDNN is iOS-only](0004-hrv-sdnn-ios-only.md) — hrv_sdnn_ms comes only from Apple HealthKit and stays null on Android (Health Connect exposes RMSSD) by design — treat it as a nullable, platform-dependent signal, never gate on it.
- [Scheduled internal calls separate routing credentials from authorization](0005-pgcron-config-prereqs.md) — Scheduled calls use a low-privilege project key for gateway routing and a separate rotatable internal secret for authorization; the service-role key must never travel in the request.
- [Wearable sync is best-effort](0006-wearable-sync-best-effort.md) — Wearables are optional confidence inputs, never product gates; missing rows or nullable platform-specific fields represent unavailable data rather than a user or pipeline failure.
- [Verified rules auto-project; humans retain revocation authority](0007-rules-as-data-two-tier.md) — Insight rules are data, not a hardcoded condition array — hand-authored blueprints are git-tracked truth and gated paper-extracted brain artifacts may auto-project into a rebuildable Postgres rules table; human review is an audited revocation layer rather than a pre-publication bottleneck, and serving stays deterministic.
- [Graphify is optional derived context](0008-graphify-context-tool.md) — Graphify is an optional, rebuildable semantic index for context discovery; it never outranks code, contracts, migrations, curated architecture, or enforced coupling guards.
- [Simulated backdated data tests time-based behaviour](0009-local-test-data-seeding.md) — Time-based behaviour is tested with explicitly simulated, backdated raw observations for a disposable user, followed by the current canonical projection pipeline; provenance and user scope remain enforced.
- [iOS and HealthKit require Apple hardware and provisioning](0010-ios-build-needs-mac-and-paid-account.md) — Native iOS builds require macOS and Xcode, while meaningful HealthKit validation requires a physical iPhone and the appropriate paid Apple programme; Android remains the cross-platform development path.
- [Local Supabase defaults to email/password auth](0011-local-supabase-auth-email-only.md) — The checked-in local Supabase configuration uses immediate email/password auth; OAuth requires real provider credentials and hosted callback configuration, while database reset remains distinct from ordinary stop/start.
- [Brain synthesis and verification use different provider families](0012-brain-adversarial-edge-verification.md) — Every brain edge is synthesised and then checked adversarially by an LLM from a different provider family with independent retrieval; the router refuses same-family pairing and grounding failures resolve to uncertain.
- [Brain build, persistence, rule promotion, and serving boundaries](0013-brain-pipeline-and-support-models-decision.md) — The brain separates deterministic ingestion, different-family synthesis and verification, canonical R2 artifacts, automatic verified-rule and edge projections, human revocation truth, deterministic serving, and isolated research models.
- [Documentation roles and lifecycle](0015-docs-taxonomy-and-enforcement.md) — Implemented, development, session, memory, hackathon, graph, and archive documents have distinct authority; generated indexes and structural checks do not substitute for owner verification or executable evidence.
- [Support-model dataset corrections](0017-support-model-dataset-corrections.md) — BioRED does not supervise direction, MEDLINE PublicationType cannot label evidence tiers 1–3 by itself, and Cochrane Crowd's terms do not support the proposed training use; do not restore those recipes.
- [Cloud Agnes verification is authorized through an audited nao dispatch](0018-cloud-verifier-authorization.md) — Live brain-pipeline verification receives a short-lived finite Agnes authorization tied to nao's authenticated curator control event; it builds a real retrieval corpus and excludes every cited paper so quote checking still uses canonical R2 text.
- [Runtime and storage topology](0019-runtime-and-storage-topology.md) — GitHub is Ourobion's versioned source and automation bridge: Nao dispatches GitHub Actions for long-running jobs whose runners connect Cloudflare R2/D1 and Supabase, while normal app data paths remain direct to their runtime stores.
- [Five-model research programme is non-serving by default](0020-five-custom-model-research-programme.md) — Ourobion's custom-model programme contains Zebra, Giraffe, Salmon, Viceroy, and Leafcutter; each has a narrow research task, and no checkpoint may influence product output without separate validation, licensing, and serving approval.
- [Nao membership is not health-data authority](0021-nao-membership-is-not-health-data-authority.md) — Biotope and Nao share Supabase identity, but an effective nao_members row is required for Nao; viewer, curator, and admin are Nao capability tiers and never grant cross-user personal-health access.
- [Owner verification is an authority boundary](0022-owner-verification-is-an-authority-boundary.md) — Agents may draft or revise governed documents only as unverified; only Jayden may promote and stamp a reviewed revision, and structural automation cannot certify semantic truth.
- [Hosted state and measurements expire](0023-hosted-state-is-timestamped-evidence.md) — Counts, spend, deployment state, card state, provider usage, and other hosted observations are timestamped evidence rather than durable memory; remeasure them or label them recorded-not-reproduced.
- [Training compute is local Apple Silicon, not sponsor GPU](0024-training-compute-is-local.md) — The requested GMI Cloud H100 container never arrived and the sponsor credit did not cover custom training, so both trained checkpoints ran on local Apple Silicon — plan model work against a laptop budget until a GPU container is actually in hand.
- [Ourobion team composition and canonical roles](0025-team-composition.md) — The current team is Jayden (Project Lead & Systems Architect), Alton (Product Design & Submission Lead), and Janson (Development Enablement & Technical Support); two-person references are origin history only.
<!-- END GENERATED -->
