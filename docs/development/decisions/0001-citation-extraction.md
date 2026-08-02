---
id: "0001"
title: Citation Extraction & Reference-Graph Construction
summary: How stage A4b detects citation style, parses reference lists, maps in-text markers to citing claims, and clusters corroboration by independent root; pins down what insight-engine-architecture.md leaves open for A4b/A4/A6.
type: decision
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# Citation extraction & reference-graph construction — architecture decision
> **Status: authoritative ground truth** · Date: 2026-07-13 · Refines: A4b citation-block parse / A4 / A6
> Part of the insight-engine architecture — see [`../insight-engine-architecture.md`](../../implemented/insight-engine-architecture.md). Contracts: [`../../../shared/brain/`](../../../shared/brain/).

## Context (what doc-12 leaves open, why it matters)

Doc-12 stage **A4b ("citation-block parse")** commits to three outputs but names no implementation:

1. **Style detection** — classify each paper's citation convention as `numeric | author-year | mixed | unknown`.
2. **Reference-list parsing** — structured entries `{ refId, raw, doi, title, year }`.
3. **In-text mapping** — `claimCites: sentenceIdx -> refIds[]` with char offsets, so every citation marker binds to the citing sentence/claim.

These feed **A6** (build `refGraph`) and **A10** (corroboration by *independent evidential root*). Doc-12 only says "a citation-format library" does detection + parsing. It does not name the library, the DOI-resolution method, or — most consequentially — **how independent citation roots are computed**. Left unspecified, A10 would silently count "5 papers agree" when all 5 rest on one primary source, violating invariant 5 (independent-root clustering) and corrupting the reliability score.

The parsing problem is also bimodal: **JATS/XML** papers carry structured `<ref-list>`/`<xref>` (parseable deterministically in pure TS), while **PDF-only** papers have no structure and empirically require an ML parser to hit usable recall (ML recall 0.66 vs 0.22 for rule/regex-based extraction — Tkaczyk 2018). This forces a two-path decision that intersects the no-Python / sidecar invariant (4).

## Options considered

### Option A — Single ML parser for everything (GROBID for all papers)
Route every paper, JATS or PDF, through GROBID's TEI pipeline.
- **Pros:** one code path; best OOTB PDF accuracy (F1 ≈ 0.89 parse; 0.87–0.90 reference extraction); DOI/PMID consolidation F1 > 0.95 built in; Apache 2.0; already precedented as a sidecar in doc-12 A4.
- **Cons:** throws away the free, exact structure JATS already gives; 2–5 s/page cost on documents that need zero ML; introduces a probabilistic step where a deterministic IDREF join (`xref/@rid → ref/@id`) is available; char offsets index GROBID's extracted-text layer, so exact-offset fidelity is harder to guarantee than reading native XML.

### Option B — Pure-TS regex/rule parser for everything (no sidecar)
Keep the whole stage TS-native with a regex reference-string parser.
- **Pros:** fully TS-native, zero sidecar, trivially deterministic and cacheable.
- **Cons:** disqualified by evidence — rule/regex-based reference extraction averages **recall 0.22** (Tkaczyk 2018), roughly a third of ML recall (0.66). Even CRF-based string parsers (ParsCit) only reach F1 ≈ 0.75 out-of-the-box, and a plain-regex parser is weaker still. On heterogeneous PDF reference strings this misses too many refs, starving A6/A10. Invariant 6 (every claim traces to real papers) can't be met if a quarter of references never parse.

### Option C — Split by source format: pure-TS for JATS, GROBID sidecar for PDF (chosen)
Deterministic TS path for structured XML; ML sidecar only where structure is absent.
- **Pros:** uses the free JATS structure exactly and deterministically; applies ML only where it earns its cost; both parsers license-clean (native XML; GROBID Apache 2.0); GROBID gives DOI consolidation for free on the PDF path; matches doc-12's own "JATS gives ref-list/xref for free" framing.
- **Cons:** two code paths to maintain; two claimCites mappers to keep behaviorally identical (mitigated: both reduce to the same IDREF-join shape — `xref/@rid→ref/@id` for JATS, `ref[type=bibr]/@target→biblStruct/@id` for TEI).

### Option D (sub-choice) — Reference-string parser for the parse sub-task: AnyStyle vs GROBID
For parsing *reference strings only* (not layout), AnyStyle (Ruby CRF, BSD) scored best-overall in Cioffi & Peroni 2022 (56-PDF, 27-subject-area evaluation; AnyStyle first, CERMINE second), emits CSL-JSON/BibTeX/RIS, and is a lighter sidecar than the full GROBID stack.
- **Decision:** GROBID is primary because the PDF path needs *layout-aware* structure + reference extraction + DOI consolidation in one service, not just string parsing. **AnyStyle is the sanctioned fallback/second parser** (BSD, clean) for reference-list strings when a full GROBID deployment is undesirable. Both are out-of-process sidecars.

## Decision

**Adopt Option C with a format-routed pipeline. All work is OFFLINE (authoring); nothing here runs at serve time.**

**1. Style detection (A4b-i) — pure-TS, deterministic, cached.**
- JATS/TEI: **infer, don't detect.** Numbered `<label>` on `<ref>` ⇒ `numeric`; author-year content in `<mixed-citation>`/`<biblStruct>` ⇒ `author-year`.
- Raw text: small regex battery (following dhimmel's author-vs-numeric style analysis). Numeric = bracketed/superscript integers `[1]`, `[1,2]`, `(3)`; author-year = `(Surname 2019)`, `(Smith and Jones, 2019; …)`. Cross-check against the reference-list leading token (`[n]`/`n.` ⇒ numeric; `Surname, I. (year)` ⇒ author-year). Both signals above threshold ⇒ `mixed`; neither ⇒ `unknown`. Pure functions.

**2. Reference-list parsing (A4b-ii) — format-routed.**
- **JATS/XML → pure TS.** Stream with `fast-xml-parser`/`sax`. Extract `{ refId, raw, doi, title, year }` from `<ref>`/`<element-citation>`/`<mixed-citation>`. No ML, no sidecar, no API.
- **PDF-only → GROBID** (Apache 2.0, **out-of-process sidecar** — flagged non-TS, allowed under invariant 4, precedented in doc-12 A4). Reference entries from `<listBibl>/<biblStruct>`. ML PDF reference detection is the empirically necessary path here (recall 0.66 vs 0.22 rule-based, Tkaczyk 2018; layout-based detection likewise favored by Rizvi et al. 2019 / DeepBiRD).
- **Fallback for reference-string-only parsing:** **AnyStyle** (BSD, Ruby CLI sidecar), emitting CSL-JSON.

**3. In-text mapping `claimCites` (A4b-iii) — deterministic IDREF join in TS on both paths.**
- JATS: `<xref ref-type="bibr" rid="…">` → `<ref>/@id`; capture char offsets of the marker in the citing sentence (offsets index the source XML text — directly verifiable online, invariant 6).
- TEI (GROBID PDF): `<ref type="bibr" target="#b_n">` → `<biblStruct>/@id`; same offset capture, but offsets index GROBID's **frozen extracted-text layer** (there is no canonical online text for PDF-only papers). The frozen extracted span is the verifiable anchor for invariant 6 on this path; see open question 7.
Both produce identical `sentenceIdx -> refIds[]` shape with char spans.

**4. DOI resolution (A4b→A6) — offline network step, results frozen into authoring tables.**
- Primary: **Crossref REST**, using **Search-Based Matching with Validation (SBMV)** — candidate selection via `query.bibliographic`, then the separate validation/scoring step (do **not** take top hit blindly). Literature F1 **96.29%** (Crossref, 2018). Use the **polite pool** (`mailto`) for throughput.
- On the GROBID path, use its built-in **consolidation** (Crossref or self-hosted **biblio-glutton**), DOI/PMID F1 > 0.95 — free with the sidecar.
- Cross-check/supplement: **OpenAlex** `referenced_works` (CC0) — supplement only, not sole authority (coverage below WoS/Scopus, arXiv 2401.16359; reconstruct inverted-index abstracts in TS). Optional: OpenCitations, Semantic Scholar Graph API.
- **All responses cached into the authoring tables. Serve time reads the frozen `refGraph` only — never the live API** (invariant 1).

**5. Reference graph + independent-root corroboration (A6/A10) — pure deterministic graph ops over the frozen table.**
- A6: `refGraph` = directed edges *paper → resolved-DOI*.
- A10 collapse-then-count (union-find), computed **offline**; serve reads only the resulting frozen count:
  1. **Direct-citation collapse:** if `A→B` inside candidate set S, B is not independent of A.
  2. **Bibliographic-coupling collapse:** cluster S by *shared claim-supporting cited roots* (Kessler coupling; Kleminski 2022). Couple on references that are the *evidential basis for the claim*, not incidental background cites.
  3. **independent-root count = number of union-find clusters after collapse.** Corroboration strength consumes this count, **never** raw paper count.

**Provisional thresholds (provisional — pending calibration, invariant 7):**
- Bibliographic-coupling collapse: treat two supporting papers as the **same root if they share ≥ 1 claim-supporting primary cited source**. *Provisional — pending calibration* (no validated "evidential-independence" cut-off exists; BC thresholds are corpus-tuned).
- Raw-text style detection: classify `mixed` when both numeric and author-year markers each exceed **≥ 10% of detected in-text markers**; `unknown` when neither clears **≥ 10%**. *Provisional — pending calibration.*
- Crossref SBMV acceptance: adopt the validator's default confidence cut; **flag any reference resolving below it as `doi: unresolved`** rather than force-matching. *Provisional — pending calibration against a labeled subset.*

**Explicitly rejected:** `refextract` (Python + GPL-2.0 — invariant 4 + copyleft) and `CERMINE` (AGPL-3.0 — copyleft; note it scored second-best in Cioffi & Peroni 2022, so the rejection is on license, not quality). Neither enters the repo.

## How it fits the architecture

- **Stage:** A4b (detect/parse/map), feeding A6 (`refGraph`) and A10 (corroboration-by-independent-root). Everything here is in the **OFFLINE authoring pipeline**.
- **Deterministic vs LLM:** No LLM in this stage at all. Style detection, XML parsing, IDREF joins, and A10 union-find are **pure deterministic functions**. DOI resolution is a deterministic *network* step whose outputs are frozen into tables. **The SERVE path only reads the frozen `refGraph` and independent-root counts** — no live API, no ML — upholding **invariant 1**.
- **1-hop served composition (invariant 3):** the bibliographic-coupling collapse is inherently a shared-reference (2-hop) computation, but it runs **offline** and is baked into a frozen scalar independent-root count. The served relationship reads that count — it does not compose multi-hop paths at serve time.
- **TS-native vs sidecar:** JATS parsing, style detection, `claimCites` mapping, Crossref/OpenAlex `fetch` calls, and all A6/A10 graph ops are **TS-native**. **GROBID** (Java) and optional **AnyStyle** (Ruby) are **out-of-process sidecars** — flagged as non-TS per **invariant 4**, permitted under the doc-12 A4 GROBID precedent. No Python enters the repo.
- **Invariants upheld:**
  - **(1)** serve path reads frozen tables only.
  - **(3)** served corroboration is a frozen scalar; multi-hop graph work is offline.
  - **(4)** only Apache-2.0 GROBID / BSD AnyStyle sidecars; no Python-in-repo, no copyleft.
  - **(5)** corroboration counts *independent roots* (direct-citation + bibliographic-coupling collapse), not papers.
  - **(6)** `claimCites` carries char offsets binding each marker to real, DOI-resolved references — indexed to source XML (JATS) or the frozen extracted-text layer (PDF).
  - **(7)** every threshold marked *provisional — pending calibration*.
  - **(2)** untouched — nothing here injects venue prestige or citation *count* into reliability; the *independent-root count* is a corroboration-of-evidence signal (study corroboration), not a popularity/citation-count signal.

## Open questions / calibration plan

1. **Independence threshold (the load-bearing unknown).** "≥ 1 shared claim-supporting root ⇒ same voice" is a starting point, not validated. **Plan:** hand-label ~100 claim clusters for true evidential independence; sweep the shared-root threshold (≥1, ≥2, weighted overlap / Jaccard on claim-supporting refs) against those labels; also test the **node-split** unification (Yun 2022, arXiv 2110.15513) as a single operator for direct-citation + coupling. Pick the cut that maximizes agreement with hand labels.
2. **"Claim-supporting" vs "incidental" cite classification.** Coupling must only count references that actually support the claim. Determining which cited refs are claim-supporting is itself nontrivial and currently offline-heuristic — needs its own spec (candidate: proximity of the `<xref>` marker to the claim sentence within A4b).
3. **DOI-resolution acceptance cut.** Calibrate the SBMV/GROBID-consolidation confidence threshold on a labeled reference subset; decide the `unresolved` policy (drop from coupling vs. treat unresolved string as its own tentative root).
4. **GROBID vs AnyStyle on the PDF reference sub-task.** Benchmark both on the actual corpus's PDF references before committing to running the full GROBID stack everywhere vs. AnyStyle for string-only parsing.
5. **OpenAlex coverage gap.** Quantify how often OpenAlex `referenced_works` disagrees with / is missing vs. Crossref on this corpus, to size its role as cross-check.
6. **Style-detection thresholds** (the 10% marker cut) validated against a labeled style sample per source (publisher XML vs. arXiv PDF).
7. **PDF char-offset verifiability.** Define the invariant-6 anchor for PDF-only papers precisely: the frozen GROBID extracted-text span (with page/coord provenance where available), and verify these spans reproduce reliably across GROBID versions.

## Sources

- GROBID — https://github.com/kermitt2/grobid , https://grobid.readthedocs.io/en/latest/Introduction/
- GROBID consolidation (Crossref vs biblio-glutton) — https://grobid.readthedocs.io/en/latest/Consolidation/
- Cioffi & Peroni 2022, "Structured references from PDF articles: assessing the tools…" — https://arxiv.org/abs/2205.14677
- Tkaczyk et al. 2018, "Machine Learning vs. Rules… retrained vs OOTB" (ML recall 0.66 vs rules 0.22; GROBID F1 0.89, ParsCit 0.75) — https://arxiv.org/pdf/1802.01168
- Rizvi, Dengel & Ahmed 2019, "A Hybrid Approach and Unified Framework for Bibliographic Reference Extraction" (DeepBiRD; layout-based PDF reference detection — supports the PDF-path ML rationale) — https://arxiv.org/abs/1912.07266
- AnyStyle CLI — https://github.com/inukshuk/anystyle-cli/blob/master/README.md , https://github.com/inukshuk/anystyle
- Crossref "Reference matching: for real this time" (SBMV, F1 96.29%) — https://www.crossref.org/blog/reference-matching-for-real-this-time/
- Crossref REST API — https://www.crossref.org/documentation/retrieve-metadata/rest-api/ , https://github.com/crossref/rest-api-doc/blob/master/api_format.md
- OpenAlex Work object (`referenced_works`, inverted-index abstract) — https://github.com/ourresearch/openalex-docs/blob/main/api-entities/works/work-object/README.md
- Reference coverage of OpenAlex vs WoS/Scopus (arXiv 2401.16359) — https://arxiv.org/pdf/2401.16359
- JATS `xref` — https://jats.nlm.nih.gov/publishing/tag-library/1.2/element/xref.html ; `ref-list` — https://jats.nlm.nih.gov/archiving/tag-library/1.1/element/ref-list.html ; `ref-type` — https://jats.nlm.nih.gov/archiving/tag-library/1.3/attribute/ref-type.html
- dhimmel, "On author versus numeric citation styles" — https://blog.dhimmel.com/citation-styles/
- Kleminski et al. 2022, direct citation vs co-citation vs bibliographic coupling — https://journals.sagepub.com/doi/10.1177/0165551520962775
- Yun 2022, node-split generalization of BC and co-citation (arXiv 2110.15513, Journal of Informetrics 16(2) 101291) — https://arxiv.org/pdf/2110.15513
- Co-authorship & bibliographic-coupling network effects, PLOS ONE — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0099502
