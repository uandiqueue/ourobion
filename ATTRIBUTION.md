# Third-Party Attribution

Ourobion uses the services, models, datasets, software, and assets below. Product and service names
remain the property of their respective owners. Inclusion here does not imply endorsement.

## AI services and models

| Provider / work | Use in Ourobion | Licence or terms |
|---|---|---|
| [OpenAI](https://openai.com/) — `gpt-5`, `gpt-5-mini` | Research-pipeline synthesis, seeding, and supporting LLM nodes | OpenAI API terms |
| [Agnes AI](https://agnes-ai.com/) — `agnes-2.5-flash` | Independent, adversarial verification of synthesised claims | Agnes AI platform/API terms |
| [Anthropic](https://www.anthropic.com/) — Claude family, Claude Code, Claude Design | Declared router-provider support and development/design assistance; Claude is not the current pipeline verifier | Anthropic commercial terms |
| [GMI Cloud](https://www.gmicloud.ai/) | Challenge sponsor platform. Sponsor credit was redeemed and H100 container entitlement was requested; no GMI training run occurred within the challenge window | GMI Cloud platform terms |
| [Microsoft BiomedNLP-BiomedBERT](https://huggingface.co/microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext) | Base checkpoint for the Zebra and Viceroy research classifiers | MIT |

The router's configured model/provider table is recorded in
[`tools/llm-router/router.config.json`](tools/llm-router/router.config.json). API usage and spend are
reported separately and do not alter this attribution.

## Training datasets

| Dataset | Use | Licence / restriction |
|---|---|---|
| [SciFact `scifact_entailment`](https://huggingface.co/datasets/allenai/scifact_entailment) | Zebra NLI research checkpoint only | CC BY-NC 2.0; non-commercial restriction applies |
| [Yu, Li & Wang causal-language corpus](https://github.com/junwang4/causal-language-use-in-science), EMNLP 2019 | Viceroy causal-language research checkpoint only | Repository marked GPL-3.0; applicability to trained weights remains unresolved, so the checkpoint is not distributed or served |

Zebra uses SciFact only. It does **not** use HealthVer, PUBHEALTH, or SciNLI. Neither Zebra nor
Viceroy is wired into product serving.

## Literature discovery and retrieval

The research pipeline obtains identifiers, metadata, open-access locations, or full text from:

- [OpenAlex](https://openalex.org/)
- [PubMed and PubMed Central](https://pubmed.ncbi.nlm.nih.gov/)
- [Europe PMC](https://europepmc.org/)
- [CORE](https://core.ac.uk/)
- [Crossref](https://www.crossref.org/)
- [Semantic Scholar](https://www.semanticscholar.org/product/api)
- [Unpaywall](https://unpaywall.org/)
- [arXiv](https://arxiv.org/)
- [DOAJ](https://doaj.org/), [Lens](https://www.lens.org/), and [OpenAIRE](https://www.openaire.eu/)

Each paper retains source identifiers and provenance. Copyright and reuse terms remain those of the
individual paper and source; discovery or retrieval does not transfer ownership to Ourobion.

## Platforms, frameworks, and third-party code

- [Cloudflare](https://www.cloudflare.com/) — R2 object storage, D1 search index, Workers, and
  Wrangler/OpenNext tooling.
- [Supabase](https://supabase.com/) — Postgres, Auth, row-level security, Storage, and Edge Functions.
- [Flutter](https://flutter.dev/) and [Dart](https://dart.dev/) — biotope mobile application.
- [Next.js](https://nextjs.org/), [React](https://react.dev/), and
  [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) — nao operator application.
- [Node.js](https://nodejs.org/), [TypeScript](https://www.typescriptlang.org/), and
  [Deno](https://deno.com/) — repository tooling and backend runtimes.

Complete direct and transitive dependency inventories, including pinned versions and package licence
metadata, are maintained by the package manifests and lockfiles at `package.json`, `package-lock.json`,
`apps/nao/package.json`, `apps/biotope/pubspec.yaml`, `apps/biotope/pubspec.lock`, and
`model-training/pyproject.toml`.

## Visual assets and fonts

- The 25 shipped biomechanical-botanical PNGs under
  `apps/biotope/assets/images/generated/biomech_botanical/` were generated directly with OpenAI Codex
  image generation, then selected and edited through the prompt/review workflow in
  `assets/ui-generation/biomech-botanical/`.
- The biotope redesign used an Anthropic Claude Design prototype as a visual reference. Ourobion's
  logo and identity marks are team-owned assets, not third-party marks.
- [Manrope](https://github.com/sharanda/manrope) is used in biotope under the SIL Open Font License
  1.1. nao uses [Outfit](https://fonts.google.com/specimen/Outfit) and
  [JetBrains Mono](https://www.jetbrains.com/lp/mono/), each under the SIL Open Font License 1.1.
- Flutter Material Icons and Cupertino Icons are used through their respective Flutter packages and
  licences.

## Development assistance

OpenAI Codex and Anthropic Claude / Claude Code assisted with research, implementation, review,
documentation, and asset generation. Human maintainers remain responsible for all architecture,
licensing decisions, verification, and submitted claims.

Signed by Jayden.  
Date: 2 August 2026.
