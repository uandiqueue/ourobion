---
id: "0018"
title: Cloud Agnes verification is authorized through an audited nao dispatch
summary: Live brain-pipeline verification receives a short-lived finite Agnes authorization tied to nao's authenticated curator control event; it builds a real retrieval corpus and excludes every cited paper so quote checking still uses canonical R2 text.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T22:08:41Z
---

# 0018 — Cloud Agnes verification is authorized through an audited nao dispatch

The unattended live path in `.github/workflows/brain-pipeline.yml` does not weaken Agnes's
acceptance-only router guard. A curator must dispatch from nao and type `RUN`. Nao records that
authenticated action in `nao_control_events`, then sends only the validated operation UUID to
GitHub. The workflow creates a fresh descriptor whose `authorizationBasis` points to that event and
also records `github.actor`; raw curator identity remains only in the admin-readable audit table.

The descriptor is effective for three hours. Its verifier allowances are finite: Agnes receives 60
aggregate POST starts per submitted paper (nao accepts at most 20 papers, so at most 1,200 starts),
with zero reserved USD; Anthropic and OpenAI receive zero verifier starts and zero reserved USD. The
router's compiled three-start maximum per logical claim remains stricter and cannot be raised by the
descriptor. The authorization JSON and hash-chained attempt journal are retained with the workflow
run. Dry runs issue no descriptor and dispatch no verifier.

Live retrieval is built inside the same runner from the hydrated real paper manifest. Every paper ID
cited by the claims under review is excluded from that retrieval corpus. This prevents abstract text
from shadowing the cited paper's canonical R2 text during `quoteCheck`, while the remaining corpus is
still available for independent corroboration. Nao callers cannot select a fixture or arbitrary
corpus path.

This resolves the operational policy question in GitHub issue #369. Hosted acceptance still requires
a merged live dispatch and an observed increase in `verified_edges`; code and offline tests alone do
not claim that outcome.
