# Ourobion

**An agentic research system for health evidence.** Ourobion reads open-access scientific literature
and turns it into relationships between health measures — each one traceable back to the paper it
came from and to an independent review by a model from a different company. Two products consume
that evidence: **Biotope**, the phone app, and **Nao**, the research workbench.

**Biotope is a One Health personal ecological health monitor for the ASEAN market.** It connects
daily observations about a person's body and behaviour with environmental context, then presents
descriptive patterns without making diagnostic claims. **One Health** is the principle that the
health of people, animals, and the environment is interconnected; Biotope applies the part an
individual can observe and act on — personal physiology, daily behaviour, and environmental exposure
— and does not claim that every One Health domain is implemented. Environmental collection is a
placeholder in the current build.

> This README is the human front door: where to go, what the two products do, and how to run them
> from source. AI coding agents start with [`AGENTS.md`](AGENTS.md).

## Where to go

| You want to… | Start here |
|---|---|
| **Judge the Launchpad 2026 submission** | [`docs/hackathon/the_launchpad_challenge/submission/`](docs/hackathon/the_launchpad_challenge/submission/) — write-up, appendix, references |
| **Install Biotope on Android** | [Install Biotope on Android](#install-biotope-on-android) below — sideloadable demo APK, no toolchain needed |
| **Open Nao without installing anything** | [nao.ourobion.com](https://nao.ourobion.com) — live; sign in with the shared test account |
| **Sign in and look around** | [Shared test account](#shared-test-account) below — `test@ourobion.com` / `test123`, one credential for both apps |
| See the project at a glance | [www.ourobion.com](https://www.ourobion.com) — the showcase site, or [`apps/site/`](apps/site/) for its source |
| Take a guided reviewer route through the repository | [`docs/repository-guide.md`](docs/repository-guide.md) |
| Understand the product, origin, and two-system design | [`docs/project-overview.md`](docs/project-overview.md) |
| Review what is actually implemented and measured | [`docs/implemented/system-truth.md`](docs/implemented/system-truth.md) |
| Read the research-model results (Zebra, Viceroy) | [Research models](#research-models) below, then [`model-training/evidence/publication-results/`](model-training/evidence/publication-results/) |
| See what we got wrong along the way | [`docs/development/what-we-got-wrong.md`](docs/development/what-we-got-wrong.md) |
| Build and run Biotope locally *(not needed to review it — use the APK)* | [`apps/biotope/README.md`](apps/biotope/README.md) |
| Build and run Nao locally *(not needed to review it — use the hosted app)* | [`apps/nao/README.md`](apps/nao/README.md) |
| Understand the full insight-engine architecture | [`docs/implemented/shared/insight-engine-architecture.md`](docs/implemented/shared/insight-engine-architecture.md) |
| Navigate all active documentation | [`docs/INDEX.md`](docs/INDEX.md) |
| Understand the engineering practice | [`docs/engineering-practice.md`](docs/engineering-practice.md) |
| Work as an AI coding agent | [`AGENTS.md`](AGENTS.md) |
| Review third-party credits and licences | [`ATTRIBUTION.md`](ATTRIBUTION.md) |

### Launchpad 2026 submission

| Document | What it holds |
|---|---|
| [`writeup.txt`](docs/hackathon/the_launchpad_challenge/submission/writeup.txt) | The 1,000-word write-up, five pillars, plain text as the portal requires |
| [`project-summary.md`](docs/hackathon/the_launchpad_challenge/submission/project-summary.md) | A short prose overview — what Ourobion is, why it is built this way, and what it does not claim |
| [`appendix.md`](docs/hackathon/the_launchpad_challenge/submission/appendix.md) | Evidence table, the prebuild-versus-delta commit boundary, and what is explicitly not claimed |
| [`references.md`](docs/hackathon/the_launchpad_challenge/submission/references.md) | External works cited by the write-up |

Prior work versus the challenge delta is stated in the appendix and checkable in commit dates: **115**
commits predate 3 July 2026, and **737** at revision `7b5a064` are the delta. The prior-work figure is
permanent; the delta keeps growing, so the appendix pins the exact command and revision.

## Two products, different users

### Biotope — the personal mobile app

**Biotope** is the Flutter app used by the person whose health is being observed. It keeps daily
logging brief, records signals such as digestion, hydration, and wellbeing, and presents trends and
descriptive insight cards in non-diagnostic language.

The insights are important because logging alone only returns a person's data to them. Ourobion is
designed to connect observations across time, show when a pattern has enough support to be worth
surfacing, and say plainly when it does not.

### Nao — the research and operations interface

**Nao** is the Next.js operator dashboard used by the people maintaining Ourobion's evidence layer.
It exposes the paper corpus, relationship claims, independent verification, ingestion gaps, pipeline
controls, and model status. It is not the consumer health app.

Nao makes the research process inspectable: operators can see which evidence produced a relationship,
how it was reviewed, and why it is accepted, held, or rejected before it is allowed to influence the
product. Nao is intended for authorised operators, not as a general interface for browsing private
health histories; its production-grade role and row-level-security boundary remains pending
verification.

## How they connect

```text
scientific literature
        │
        ▼
paper ingestion → relationship synthesis → independent verification
        │                                      │
        └──────────── inspected through Nao ───┘
                                               │
                                               ▼
                                   governed evidence and rules
                                               │
daily observations → personal baselines ───────┤
                                               ▼
                              descriptive insights in Biotope
```

The **brain** is the research and reasoning layer behind this flow, not a third user-facing product.
One model proposes relationships from scientific literature; a verifier from a different vendor
family checks them against independently retrieved evidence. The resulting graph is graded and
rebuildable rather than treated as unquestionable truth.

Not every verified research relationship is automatically serving a Biotope card today. The current
measured implementation and explicit gaps are recorded in
[`docs/implemented/system-truth.md`](docs/implemented/system-truth.md).

Brain design: [`brain-synthesis-design.md`](docs/implemented/nao/brain-synthesis-design.md) ·
[`brain-ingestion-design.md`](docs/implemented/nao/brain-ingestion-design.md) ·
[`shared/brain/`](shared/brain/).

## Research models

Two small research checkpoints were trained during the challenge. **Neither serves the product**, and
that is a deliberate decision rather than an unfinished one — evidence is not serving permission. Both
were trained on **local Apple Silicon** after the requested GPU container did not arrive.

| Model | What it classifies | Result | Verdict |
|---|---|---|---|
| **Zebra v1** | whether evidence supports a claim | macro-F1 **0.599 ± 0.008** against a **pre-registered bar of 0.70** | **Failed its own bar.** The code refuses to promote it. |
| **Viceroy v0** | causal versus correlational wording | macro-F1 **0.866** against a keyword baseline of **0.507** | Beat its baseline, on **one frozen holdout** — not completed cross-validation. |

Three further models — Giraffe, Salmon and Leafcutter — remain planned and untrained. Both checkpoints
carry `validated=false`, `serving_ready=false`, `public_weights_cleared=false`. Weights are never
committed; only manifests, hashes and evaluation artifacts are tracked here.

| To read | Go to |
|---|---|
| The canonical reports, aggregate metrics, provenance hashes | [`model-training/evidence/publication-results/`](model-training/evidence/publication-results/) |
| Why the models exist and why they are not wired in | [`research-models.md`](docs/hackathon/the_launchpad_challenge/plan/research-models.md) — Part 2 |
| **The caveat we most want read** — same-paper leakage is unsolved, so Viceroy's number carries an unquantified optimistic bias | [`LEAKAGE.md`](docs/development/model-training/viceroy-training/LEAKAGE.md) |
| What we chose to train, what we did not, and why | [`model-roster.md`](docs/development/model-training/model-roster.md) |
| Approvals still gating any real training run | [`human-gates.md`](docs/development/model-training/human-gates.md) |
| The training/evaluation workspace itself | [`model-training/README.md`](model-training/README.md) |

Both models were also compared against Claude Haiku 4.5 on 96 real papers. That comparison has **no
adjudicated ground truth**, so it measures disagreement, not accuracy.

## Install Biotope on Android

Reviewers can install the universal
[`ourobion-biotope-demo.apk`](https://github.com/uandiqueue/ourobion/releases/download/biotope-demo-v1/ourobion-biotope-demo.apk)
without Flutter, Android Studio, or a local backend. Android may ask the browser or file manager for
permission to **Install unknown apps** before opening the download.

The APK connects to Ourobion's hosted demo Supabase project — sign in with the
[shared test account](#shared-test-account) below.

Built from `c9ea97b`, and verifiable before you install it:

```text
SHA-256: 861824d1ecd6be50faf10f4aa21b10fe4a5e5ecae358ac731695894bd52cbd29
```

```bash
# macOS / Linux
shasum -a 256 ourobion-biotope-demo.apk
# Windows PowerShell
Get-FileHash ourobion-biotope-demo.apk -Algorithm SHA256
```

This hackathon APK is debug-signed for sideloading and is **not** a Play Store artifact. Demo APK
updates must be built on the same Windows host; if Android reports an incompatible signature,
uninstall the older demo first (which deletes its local app data) and then install the new APK. iOS
distribution is out of scope because it requires a Mac and a paid Apple Developer account. The
source-build and release process is in [`apps/biotope/README.md`](apps/biotope/README.md).

## Open Nao in a browser

**Nao is live at [nao.ourobion.com](https://nao.ourobion.com) — nothing to install.** Sign in with the
[shared test account](#shared-test-account) below. It is the fastest way to see the brain: the paper
corpus, every drafted relationship, the verification verdict behind each one, and the loader.

## Shared test account

Use the following account for the Android APK and for the hosted Nao:

```text
Email:    test@ourobion.com
Password: test123
```

- **In Nao**, the account has **viewer authority**. It can inspect the read-only research and
  evidence surfaces but does not grant curator or administrator operations.
- **In Biotope**, the same account is also **view-only**. It opens a preseeded demonstration health
  profile so reviewers can inspect trends and existing insight cards without first entering days of
  observations. The seeded data is demonstration data, not a real person's health record.
- A Biotope user may instead register a separate account and build their own private profile.

This is a public shared account. Do not enter personal or sensitive information into it. A fully
local Supabase stack has a separate authentication database, so the account is available only when
the app points to the configured demo environment unless it is provisioned locally as well.

## Building from source

Nothing here has to be built to review it — install the APK, or open the hosted Nao. If you do want
to build, configure, run or test either product locally, those instructions live with the product
they belong to, which is the authority for prerequisites, environment variables, troubleshooting,
verification and deployment:

| Product | Local build, run and test |
|---|---|
| **Biotope** (Flutter) | [`apps/biotope/README.md`](apps/biotope/README.md) |
| **Nao** (Next.js) | [`apps/nao/README.md`](apps/nao/README.md) |

Repository-wide documentation and context checks are the exception, since they belong to no single
app and run from the root:

```bash
npm run context:check
```

## Repository guide

For a map of every top-level directory and a guided reviewer route, see
[`docs/repository-guide.md`](docs/repository-guide.md). The shortcuts are in
[Where to go](#where-to-go) at the top of this file.

## Team and contact

| Member | Role | Responsibility |
|---|---|---|
| **Jayden** | **Project Lead & Systems Architect** | Leads product direction, system architecture, technical strategy, project planning, and final decision-making. |
| **Alton** | **Product Design & Submission Lead** | Leads UI/UX design and prepares the public-facing product experience, submission materials, and presentation deliverables. |
| **Janson** | **Development Enablement & Technical Support** | Supports implementation, provides technical assistance, and provisions access to development tooling, AI services, and project accounts. |

- **Project contact:** agent.j.work@gmail.com
- **Technical questions and reproducible defects:** use the repository's GitHub Issues.
- **Want a populated account?** The shared demo account `test@ourobion.com` is view-only, so nothing
  one visitor does changes what the next one sees. If you would prefer a **separate account
  pre-loaded with seeded health data** — enough history for baselines, trends and insight cards to
  appear straight away, instead of logging for weeks — email **agent.j.work@gmail.com** and we will
  set one up. That data is seeded and marked as simulated in the database, exactly as the shared
  demo account's is.

Third-party services, models, datasets, frameworks, fonts, and generated assets are credited in
[`ATTRIBUTION.md`](ATTRIBUTION.md). Team membership is recorded here rather than mixed into
third-party attribution.

---

Ourobion is non-diagnostic by construction. It describes patterns in the available data; it does not
provide medical diagnosis or replace professional care.

**Reviewed and re-signed by Jayden**

2 August 2026
