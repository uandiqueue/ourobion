---
id: "0009"
title: Simulated backdated data tests time-based behaviour
summary: Time-based behaviour is tested with explicitly simulated, backdated raw observations for a disposable user, followed by the current canonical projection pipeline; provenance and user scope remain enforced.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T22:08:41Z
---

# Simulated backdated data tests time-based behaviour

Features keyed by `log_date` can be exercised with explicitly simulated, backdated observations;
nobody needs to wait through real calendar days. Inserting raw rows alone is not an end-to-end test:
rebuild every projection through the current canonical pipeline after seeding. Do not preserve a
stage list here—read it from the pipeline implementation or its current runbook.

The target auth user must already exist because RLS and ownership remain real during simulation.
Simulated rows must carry a registered provenance marker and must never be confused with personal or
production observations. The existing local seeder uses `seed:local-test-data`.

Destructive replacement modes may clear the selected user's truth and projections, so use them only
for a dedicated disposable test account. The current script and migrations—not this note—own the exact
guard sequence and full-pipeline invocation.
