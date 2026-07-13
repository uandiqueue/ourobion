# Fable research pack — insight-engine design

> **Archived (2026-07-13) — research trail, not ground truth.** The flagship output of this pack,
> `12-system-architecture.md`, has been **promoted** to authoritative ground truth at
> [`../../../shared/INSIGHT-ENGINE-ARCHITECTURE.md`](../../../shared/INSIGHT-ENGINE-ARCHITECTURE.md),
> with granular decisions in [`../../../shared/decisions/`](../../../shared/decisions/). This folder is
> kept under `/temp` as the record of how that design was reached; build from the promoted docs, not from here.

This folder is a **self-contained** design record for the biotope **insight engine** — the flagship feature
that turns a user's health metrics into grounded, paper-cited insights, and the "brain" that supplies them.
You should not need to open the rest of the repo to follow it: every external code/table/doc pointer is
summarised (with its data shape) in [`APPENDIX-repo-map.md`](APPENDIX-repo-map.md).

**Two waves.** *Wave 1* (`01`, `02`, `STALE-03`, `STALE-04`, `05`) analysed the phase-2 plan against two
2026-07-04 research briefs. *Wave 2* (`06`–`12`) reframed the product around Jayden's UX vision — grounded
claims instead of hedged observations, surface only confident insights, and a self-improving brain — and
turned that into a full system architecture. **Wave 2 is the living design; Wave 1 is historical.**

---

## How to read this — most compiled → most detailed

Start at the top and stop when you have what you need. Each step is more detailed than the last.

| # | Read | What you get | For whom |
|---|---|---|---|
| 1 | **[`12-system-architecture.html`](12-system-architecture.html)** | The whole system on one screen: 23 stages top-to-bottom in two tracks (serve · authoring+loop), each stage's compute class and named model, the branch and the loop. | Anyone — 2-minute orientation |
| 2 | **[`11-compilation-issues-and-resolutions.md`](11-compilation-issues-and-resolutions.md)** | Every problem (gap / conflict / risk) and its resolution, each written **twice** — plain-language (self-contained) and technical (with pointers). Ends with the 5-item priority read. | Non-technical stakeholders |
| 3 | **[`12-system-architecture.md`](12-system-architecture.md)** | **The authoritative design.** All 23 stages with typed input/output shapes, deterministic-vs-model, which LLM / which trained model, transports, stores, control flow, build order. Includes §8 model assignment and §9 hyperparameter registry. | Engineers building it |
| 4 | **[`09-ideal-ux-gap-map-and-verdict.md`](09-ideal-ux-gap-map-and-verdict.md)** | The ideal-UX → required-capability gap map: what exists vs is designed vs absent, and the verdict "can it be built." | Anyone scoping the work |
| 5 | **[`06-insight-experience-reframe.md`](06-insight-experience-reframe.md)** | The *why* behind Wave 2: honesty moves from hedged copy to the provenance layer; surface only confident insights; the four MKB branches → one surfaced lane + three internal feedback signals. | Product / design decisions |
| 6 | **[`07-report-and-provenance.md`](07-report-and-provenance.md)** · **[`08-self-recursive-brain.md`](08-self-recursive-brain.md)** | Detailed component rationale: the weekly report + reliability×applicability provenance + completeness score (`07`); the prepopulation + gap-ledger + self-recursive ingestion loop (`08`). | Engineers on those parts |
| 7 | **[`10-fable-independent-gap-audit.md`](10-fable-independent-gap-audit.md)** | The adversarial audit that pressure-tested `08`/`09` and forced the fixes now baked into `12`. | Reviewers |
| 8 | **Wave 1:** [`01`](01-phase2-weaknesses.md) · [`02`](02-resolutions.md) · [`05`](05-audit.md) · [`STALE-03`](STALE-03-plan-changes.md) · [`STALE-04`](STALE-04-experience-and-roles.md) | The original plan-vs-briefs analysis and audit. **Historical** — read only for the rationale behind the epistemic guards (n=1 stats, 1-hop/monotonic, corroboration clustering) that Wave 2 kept. | Archaeology only |

**If you read one thing:** the HTML map (1) for a picture, or `12` (3) to build.

---

## Status of every document

- **Living / authoritative:** `12` (+ `.html`) — the current design. Where any other doc conflicts with `12`,
  `12` wins.
- **Current, supporting:** `06`, `07`, `08`, `09`, `11` — the reframe, component designs, gap map, and
  stakeholder compilation. Still valid; `12` supersedes their specifics where they differ (notably: `08`'s
  claim that personal-correlation data "already exists" was corrected — see `12` S2/S5; and `09`'s "design in
  hand for every beat" was corrected by `10`).
- **Record:** `10` — the audit; its findings are resolved in `12`.
- **Historical (Wave 1):** `01`, `02`, `05` — sound analysis, but its *product stance* (observational
  language, four-branch UX) is superseded by Wave 2.
- **STALE (do not build from):** `STALE-03` (a plan-diff with reversed decisions — Neo4j, four-branch UX),
  `STALE-04` (the four-branch observational UX + a roles split superseded by `12`). Kept for history; each
  carries a banner explaining why.

---

## Document ID → filename map

Docs refer to each other by short ID (`` `06` ``, `` `12` ``, etc.). Resolve them here:

`01` → `01-phase2-weaknesses.md` · `02` → `02-resolutions.md` · **`03` → `STALE-03-plan-changes.md`** ·
**`04` → `STALE-04-experience-and-roles.md`** · `05` → `05-audit.md` · `06` → `06-insight-experience-reframe.md` ·
`07` → `07-report-and-provenance.md` · `08` → `08-self-recursive-brain.md` ·
`09` → `09-ideal-ux-gap-map-and-verdict.md` · `10` → `10-fable-independent-gap-audit.md` ·
`11` → `11-compilation-issues-and-resolutions.md` · `12` → `12-system-architecture.md` (+ `.html`).

Grounding-key shorthand used across the pack: **MKB**, **PSK** (the two source briefs), **LINK**, **IED**,
**HD**, **CONTRACT** — all defined in [`APPENDIX-repo-map.md`](APPENDIX-repo-map.md).

---

## Self-containment

Every reference to something outside this folder — a code path, a `file:line`, a database table, a design
doc, or the two source briefs — is catalogued in [`APPENDIX-repo-map.md`](APPENDIX-repo-map.md) with **what it
stores or does and its data shape**. A reader can understand the whole pack without leaving this folder. (The
appendix is the single place those summaries live, rather than repeating them at every pointer.) The one
thing the pack describes that is largely *unbuilt* in the repo is the design itself: at the time of writing
the brain had **zero verified edges** and the pipeline past text-extraction did not exist — `12` is the plan
to build it.
