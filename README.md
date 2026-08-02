# Ourobion

**A One Health personal ecological health monitor for the ASEAN market.** Ourobion connects daily
observations about a person's body and behaviour with environmental context, then presents
descriptive patterns without making diagnostic claims.

**One Health** is the principle that the health of people, animals, and the environment is
interconnected. Ourobion currently starts with the part an individual can observe and act on:
personal physiology, daily behaviour, and environmental exposure. It does not claim that every One
Health domain is already implemented.

> This README is the human front door: where to go, what the two products do, and how to run them
> from source. AI coding agents start with [`AGENTS.md`](AGENTS.md).

## Where to go

| You want to… | Start here |
|---|---|
| **Judge the Launchpad 2026 submission** | [`docs/hackathon/the_launchpad_challenge/submission/`](docs/hackathon/the_launchpad_challenge/submission/) — write-up, appendix, references |
| **Install Biotope on Android** | [Install Biotope on Android](#install-biotope-on-android) below — sideloadable demo APK, no toolchain needed |
| **Sign in and look around** | [Shared test account](#shared-test-account) below — `test@ourobion.com` / `test123`, one credential for both apps |
| See the project at a glance | [www.ourobion.com](https://www.ourobion.com) — the showcase site, or [`apps/site/`](apps/site/) for its source |
| Take a guided reviewer route through the repository | [`docs/repository-guide.md`](docs/repository-guide.md) |
| Understand the product, origin, and two-system design | [`docs/project-overview.md`](docs/project-overview.md) |
| Review what is actually implemented and measured | [`docs/implemented/system-truth.md`](docs/implemented/system-truth.md) |
| Read the research-model results (Zebra, Viceroy) | [Research models](#research-models) below, then [`model-training/evidence/publication-results/`](model-training/evidence/publication-results/) |
| See what we got wrong along the way | [`docs/development/what-we-got-wrong.md`](docs/development/what-we-got-wrong.md) |
| Run Biotope | [`apps/biotope/README.md`](apps/biotope/README.md) |
| Run Nao | [`apps/nao/README.md`](apps/nao/README.md) |
| Understand the full insight-engine architecture | [`docs/implemented/shared/insight-engine-architecture.md`](docs/implemented/shared/insight-engine-architecture.md) |
| Navigate all active documentation | [`docs/INDEX.md`](docs/INDEX.md) |
| Understand the engineering practice | [`docs/engineering-practice.md`](docs/engineering-practice.md) |
| Work as an AI coding agent | [`AGENTS.md`](AGENTS.md) |
| Review third-party credits and licences | [`ATTRIBUTION.md`](ATTRIBUTION.md) |

### Launchpad 2026 submission

| Document | What it holds |
|---|---|
| [`writeup.txt`](docs/hackathon/the_launchpad_challenge/submission/writeup.txt) | The 1,000-word write-up, five pillars, plain text as the portal requires |
| [`appendix.md`](docs/hackathon/the_launchpad_challenge/submission/appendix.md) | Evidence table, the prebuild-versus-delta commit boundary, and what is explicitly not claimed |
| [`references.md`](docs/hackathon/the_launchpad_challenge/submission/references.md) | External works cited by the write-up |

Prior work versus the challenge delta is stated in the appendix and checkable in commit dates: 117 of
817 commits predate 3 July 2026; the remaining 700 are the delta.

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

This hackathon APK is debug-signed for sideloading and is **not** a Play Store artifact. Demo APK
updates must be built on the same Windows host; if Android reports an incompatible signature,
uninstall the older demo first (which deletes its local app data) and then install the new APK. iOS
distribution is out of scope because it requires a Mac and a paid Apple Developer account. The
source-build and release process is in [`apps/biotope/README.md`](apps/biotope/README.md).

## Run from source

Biotope also runs from source on an Android emulator or physical device, and Nao runs locally with
Node.js. The app-specific READMEs remain the authority for prerequisites, environment variables,
troubleshooting, verification, and deployment.

### Shared test account

Use the following account when the apps are connected to Ourobion's configured demo environment:

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

### Run Biotope

Full instructions: [`apps/biotope/README.md`](apps/biotope/README.md).

At minimum, install Flutter, Node.js, Docker, and an Android toolchain. From the repository root:

```bash
# Linux/macOS project setup. Windows uses .\scripts\setup.ps1 instead.
chmod +x scripts/setup.sh
./scripts/setup.sh

# Public client configuration: fill in the URL and anon key after Supabase starts.
cp apps/biotope/.env.public.example apps/biotope/.env.public
npx supabase start
npx supabase db reset

cd apps/biotope
flutter pub get
flutter run
```

For an Android emulator, set `SUPABASE_URL=http://10.0.2.2:54321` in
`apps/biotope/.env.public`. A physical phone uses the development machine's LAN address. Never place
private backend secrets in this file; it is bundled into the app.

### Run Nao

Full instructions: [`apps/nao/README.md`](apps/nao/README.md). Nao requires Node.js **26 or newer**.

From `apps/nao/`:

```bash
cp .env.public.example .env.public
cp .env.example .env
# Fill in the selected Supabase project values. R2 credentials are needed for ETL.

npm install
npm run dev
# http://localhost:3000
```

The interface can start without rebuilding the paper index, but corpus search and paper detail depend
on the documented D1/R2 setup. Follow the app README to initialise D1, run the ETL, or exercise the
Cloudflare path.

### Verify the applications

```bash
# Biotope
cd apps/biotope
flutter analyze
flutter test

# Nao
cd ../nao
npm run typecheck
npm test
```

Repository context and documentation checks run from the root:

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
