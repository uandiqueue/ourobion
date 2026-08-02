---
id: "0023"
title: Hosted state and measurements expire
summary: Counts, spend, deployment state, card state, provider usage, and other hosted observations are timestamped evidence rather than durable memory; remeasure them or label them recorded-not-reproduced.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:00:58Z
---

# Hosted state and measurements expire

Hosted databases, provider ledgers, deployment dashboards, user-controlled statuses, and workflow
runs change independently of repository prose. Their observations must include the environment,
revision where relevant, command/query, and observation time.

Do not store current card totals, API calls or spend, test totals, corpus counts, deployment status,
branch state, model-run progress, or user archive/saved state as durable memory. Put them in a dated
session/run record or the measured-system document. Before using them in current-facing copy, rerun
the authoritative check; if reproduction is unavailable, label the value **recorded, not reproduced**.

Different fields may answer different questions—such as a card's producer, citation references, and
user lifecycle status—so equal-looking counts must not be treated as interchangeable without checking
their definitions.
