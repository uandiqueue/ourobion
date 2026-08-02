---
title: Model-training code build — human gates
summary: Human approvals and external-access gates for custom-model runs, including the owner-recorded GMI credit redemption and 27 July H100 entitlement request that did not yield container access within the challenge window.
type: plan
scope: model-training
status: draft
updated: 2026-08-02
---

# Model-training code build — human gates

Nothing in this document is resolved by the MT0 code build. `model-training/` code fails closed
whenever one of these approvals or an expected hash is absent; it never resolves the question itself.
Each row: what is needed, who decides, what it blocks.

**Where "fails closed" is enforced, precisely.** `JobSpec.execute()` (`job.py`) is the single door every
model-scoped subcommand goes through — `preflight`, `dry-run`, `smoke`, `train`, `evaluate`,
`build-release` — and it runs the licence-approval and data-manifest gates *before* dispatching to model
code:

- a model that declares `requires_licence_approval` cannot run without an artifact recording
  `status: "approved"` (`LicenceApprovalError` → CLI exit 2);
- a model that declares `requires_dataset_manifest` cannot run without a loadable manifest whose pinned
  SHA-256 digests all still match (`DataManifestError` / `HashMismatchError` → exit 2);
- a config that *supplies* a `licence_approval_path` or `dataset_manifest_path` has it checked even when
  the model does not require one, so a pending approval or a stale digest can never be silently ignored;
- `JobSpec.__init_subclass__` refuses to build a model class that overrides `execute()` or the gate
  methods, so a model cannot opt out of the gate by forgetting to call it.

This was **not** true before the 2026-07-27 remediation pass: the gate functions existed but had no call
sites, so a pending licence still exited 0 on five of the six subcommands. See
[`code-build-log.md`](./code-build-log.md) for what the evaluator found and what was changed.

Two things this gate deliberately does **not** do: it does not decide any licence question (it only
reads a decision a human recorded as a file), and it does not verify that the *right* dataset was
approved — matching an approval artifact to the dataset a model actually trains on stays a human review
step.

## GMI platform gates (GMI-H1-H8)

Defined once in [`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) §3.1
and shared by every model that needs a GPU (all except Leafcutter's recommended CPU-only path). The
MT0 build did not provision any GMI resource. The owner subsequently actioned the credit and access
steps: the sponsor credit code was redeemed, and the NVIDIA H100 contact-sales form was submitted on
**2026-07-27**. No reference number or confirmation email was issued, no reply was received, and no
container entitlement became available within the challenge window. No GMI container, SSH key, or
bucket was created.

| Gate | What is needed | Owner-recorded status | Who decides | What it blocks |
|---|---|---|---|---|
| GMI-H1 | Create/select a dedicated Ourobion GMI organization; verify account, 2FA | Account exists; dedicated-organization and 2FA evidence not recorded | Jayden | Any GPU provisioning for any model |
| GMI-H2 | Redeem sponsor/credit code or add an approved balance; auto-reload off unless Jayden sets a limit | **Actioned:** sponsor code redeemed. Available credit covers CPU or GMI-hosted third-party inference, not the needed custom-model GPU container | Jayden | Any paid compute |
| GMI-H3 | Contact GMI Support, request Container (+ Cold Storage if used) entitlement, confirm SKU/region/price | **Actioned but unresolved:** NVIDIA H100 contact-sales form submitted 2026-07-27; no reference, confirmation, reply, entitlement, SKU, region, or live price received | Jayden (or delegate with recorded evidence) | Container/bare-metal provisioning |
| GMI-H4 | Import a project-specific Ed25519 SSH key, keep the private key outside git/chat | Pending; no GMI key created | Jayden | SSH access to any container |
| GMI-H5 | Choose durable storage (GMI Cold Storage or an approved R2 prefix); scoped read/write credential | Pending; no GMI bucket created | Jayden | Any checkpoint/artifact persistence |
| GMI-H6 | Confirm this repo's `model-training/` workspace (MT0, done) as code location; grant only the identity needed per model | Repo workspace exists; execution identity approval remains unrecorded | Jayden | Which agent/human may run a given model's execution |
| GMI-H7 | Approve the frozen licence manifest for **that model's** dataset(s); re-approved per model, stricter for Viceroy (§4.2 of its plan) | Pending per model | Jayden, per model | Any training run for that model |
| GMI-H8 | Approve GPU-hour and total-cost stop limits after viewing the live console estimate | Pending; no live container price was available | Jayden | Any GPU-hour spend |

**Challenge-window outcome.** We requested container entitlement on 27 July and did not receive
access within the challenge window. The redeemed credit covered CPU and hosted third-party inference,
neither of which was the custom-model training need. Zebra and Viceroy were therefore trained inside
a local Apple Silicon compute envelope instead; this is an adaptation to the access constraint, not
a claim that GMI training occurred.

## Per-model licence approvals

| Model | Licence gate | Status | Blocks |
|---|---|---|---|
| Leafcutter | PubMed 200k RCT / MEDLINE licence manifest (GMI-H7 equivalent even though no GPU is expected) | Not approved | Any training, even CPU-only |
| Giraffe | MEDLINE annual baseline + StudyTypeTeller (CC-BY 4.0) manifest | Not approved | Any training |
| Zebra | SciFact (CC BY 4.0 claims/evidence, ODC-By 1.0 abstracts) + `scifact_entailment` (`cc-by-nc-2.0`) manifest | Not approved | Any training |
| Salmon | BioRED + DrugProt + ChemProt manifests (all clean) | Not approved | Relation-type training (direction is separately gated below) |
| Viceroy | Yu/Li/Wang causal-language corpus | Blocked on the GPL-3.0 determination below, in addition to the manifest itself | Any training |

## BioREDirect data licence — unresolved (gates Salmon's direction head)

**What is needed:** a written determination of BioREDirect's reusable-data licence (currently
**unverified** — see [`model-roster.md`](./model-roster.md) §6). Without it, Salmon's direction head
(`e1→e2` / `e2→e1` / `symmetric`) has no supervision at all, because plain BioRED is explicitly
non-directional (the roster's finding #1). **Who decides:** Jayden, after the BioREDirect maintainers
or an equivalent authoritative source clarify the licence. **What it blocks:** Salmon's direction
head specifically; relation-type training on BioRED/DrugProt/ChemProt alone is not blocked by this
item, but `salmon_relation_direction`'s code must still fail closed on the direction head absent an
approved artifact (per the orchestrator prompt's MT4 instructions) — no relation-only mode may be
assumed complete without a separate, explicit decision to ship it that way.

## Yu/Li/Wang GPL-3.0 determination — unresolved (gates Viceroy)

**What is needed:** a legal/licensing determination of whether GPL-3.0's copyleft propagates to
model weights trained on GPL-3.0 data, specific to the Yu/Li/Wang causal-language corpus. **Who
decides:** Jayden (with legal input if he seeks it) — explicitly **not** this codebase; the
orchestrator prompt states "the code must refuse real data/training unless a signed decision artifact
permits the intended use... Do not encode a legal conclusion into the implementation." **What it
blocks:** all of Viceroy (`viceroy-claim-kind-v0`) — training, evaluation on real data, and release.

## Frozen human audit-set labels

**What is needed:** each model that evaluates against an "independently labelled Ourobion-domain audit
set" (Zebra, Salmon, Viceroy) needs that set frozen via blinded dual review and hashed, per each
plan's own execution order (e.g. Zebra T3, Salmon T3, Viceroy — see each plan §"Execution order").
**Who decides:** whoever Jayden assigns as the dual reviewers; Jayden approves the freeze.
**What it blocks:** the "evaluate untouched test split + frozen audit set" step for each of those three
models — none of it has happened.

## Storage retention posture

**What is needed:** a decision on whether the "private, append-only release namespace with hashes"
(Zebra plan §3 pilot contract) is backed by an actually-enforced storage retention/versioning/
deny-overwrite control, or whether it is only conventionally append-only. The Zebra plan is explicit
that it should only be called immutable once this is verified. **Who decides:** Jayden, in
consultation with whoever administers the chosen GMI Cold Storage / R2 prefix (GMI-H5). **What it
blocks:** calling any model's release artifacts "immutable" rather than merely "not yet overwritten."

## GPU-hour / cost caps

**What is needed:** Jayden's approval of a GPU-hour cap and an all-in USD cap, per model, after
viewing the live GMI console price (GMI-H8). The roster's combined budget estimate (`≤14 GPU-hours and
≤USD 55 all-in` across the four newer plans) is a planning estimate, not an approved cap. **Who
decides:** Jayden. **What it blocks:** any GPU-hour spend on any model.

## Live console prices

**What is needed:** the actual GMI console SKU/region price at the time of provisioning (the plans
record catalog prices as of 2026-07-26 — H100 from USD 2.00/GPU-hour, H200 from USD 2.60/GPU-hour —
but GMI states the console price is authoritative, not the catalog page). **Who decides:** whoever
provisions the container records it; Jayden approves the cap it's checked against (GMI-H8). **What it
blocks:** treating any planning-stage price in a `*-training-plan.md` as authoritative for an actual
spend decision.

## D4 — hash-pinned lock gap

**What is needed:** a network-enabled machine to actually resolve `model-training/pyproject.toml`'s
`ml`/`dev` extras into a hash-pinned lock (`pip-compile --generate-hashes`, `uv lock`, or equivalent),
so `pip install --require-hashes` becomes possible. This build environment has no network for
dependency resolution and no `uv`, so `constraints.txt` is an exact-`==`-pin manifest only — see D4 in
[`code-build-decisions.md`](./code-build-decisions.md). **Who decides:** whoever runs the next
network-enabled build session; no human policy decision is needed here, only network access and time.
**What it blocks:** treating any install from `constraints.txt` as supply-chain-verified rather than
merely version-pinned. Fabricating hashes to close this gap is explicitly out of bounds (the brief:
"Fabricating hashes would be worse than admitting the gap").
