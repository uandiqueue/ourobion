---
title: Doc 4 — demo runbook, shot list and risk register (#328)
summary: Wrote the evidence-labelled demo runbook for the hackathon submission set against a macOS recording machine, and found three state defects while verifying it — the D1 ETL workflow is not dispatchable, the connection map's migration/workflow counts are still stale after its refresh, and the Run 4 demo script's mechanics do not execute on this host.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Doc 4 — demo runbook, shot list and risk register (#328)

Branch: `docs/hackathon/demo-runbook-328`, cut from `origin/dev-phase2-run4` @ `e6f0e1f`.
Issue #328, Doc 4 of four. `docs/**` only — no code touched.

memory: none

## Attempted

- Started from a local checkout that was **323 commits behind** `origin/dev-phase2-run4` (local tip
  `f2c8766`, 2026-07-28). Fetched and cut a fresh isolated worktree at the remote tip rather than
  writing against the stale tree — the exact failure mode issue #328 §6 warns about.
- Established that the **graphify graph is stale and unusable for this work**: it indexes `src/lib/…`
  paths from the pre-monorepo layout, while the repo has been on `apps/biotope/lib/…` for some time.
  Verified every fact against files, `gh`, and executed commands instead.
- Verified the recording machine's real capability rather than inheriting the Run 4 assumptions:
  `flutter devices`, `flutter emulators`, `adb`, `docker info`, `node -v`, env-file presence, tracked
  platform folders, and the existing macOS build artifacts.
- Ran `flutter pub get` + `flutter analyze --no-pub` at the remote tip to establish the pre-record gate.
- Verified the five tab labels at head in `core/widgets/biotope_bottom_navigation.dart` instead of
  trusting the Run 4 script's walkthrough, which is 323 commits old.

## Changed

- Added `docs/shared/hackathon/submission/demo-runbook.md` — Doc 4, as a **3-minute video production
  plan** rather than a reference document. Reuses the seven-level evidence label vocabulary from
  `system-connection-map.md` §0 verbatim, stamped with the anchor SHA + UTC timestamp it was verified
  against. Sections: a 180-second running order interleaving 6 PowerPoint slides with 4 app captures,
  the recording machine, a macOS/bash setup sequence, per-capture click paths, per-slide content
  specs, the full ~460-word narration, a never-say table, an eight-item risk register, a pre-record
  checklist, and three open decisions.
- The first draft was structured as a reference wall (device comparison tables, a nine-shot matrix)
  and was rejected as unusable by the recording owner. Restructured around the running order, with
  the reference material demoted to short sections beneath it.
- Recentred a second time on **nao**, after the recording owner stated that nao and paper ingestion
  are the hackathon's main solution and biotope is the surface. The running order now spends ~100s on
  the brain, ~25s on biotope and ~55s on framing; biotope's logging flow is demoted to optional
  B-roll.
- Regenerated `docs/INDEX.md` via `context_sync.mjs --fix-index`.

## Decided

- **The video is planned to the 3-minute cap as a hard structural constraint**, not a trim target.
  `hackathon-rules.md` line 39: *"Demo video. Maximum 3 minutes. Mandatory for all tracks."* The
  first draft's shot list implied ~4 minutes. The 180 seconds are budgeted 85s slides / 85s captures
  / 10s buffer, with an explicit cut order and one segment (the honesty slide) marked never-cut.
- **Slides carry the reasoning; app footage only proves the loop.** Same rules doc, line 201: judges
  are instructed not to be seduced by demo polish, and a well-reasoned design decision beats a flashy
  demo. Since the evidence half has no result to film (`verified_edges` = 0), narrating the pipeline
  and the decorrelation invariant over slides is both the honest and the higher-scoring option.
- **The decorrelation invariant is narrated as platform separation, and Agnes is named.** The
  recording owner's correction: the property that matters is different *platform* — different
  company, corpus and weights, therefore independent blind spots — not "model family," which reads
  as an architecture claim. The code agrees: `router.config.json` families are vendors
  (`anthropic`/`openai`/`google`/`agnes`), `familyOf()` returns a `VendorFamily`, and node
  assignments are `synthesis → gpt-5` (openai), **`verifier → agnes-2.5-flash` (agnes)**. Enforced
  unconditionally at config load (`cli.ts:522-523`), with `offlineAcceptance.ts:207` throwing
  `configured families are not separated`. Naming Agnes is well-motivated rather than
  sponsor-flattery — adversarial verification is exactly the role that requires non-shared weights —
  and Agnes is a sponsor whose team judges (`hackathon-rules.md:78,81`), with 18/50 calls consumed.
- **Corrected Slide 5's "the verifier is blocked on a provider key."** That was inherited from
  `system-connection-map.md`, which the 2026-08-01 freshness audit flags as stale on exactly this
  label. Agnes has really run (18/50 calls; #322 fixed live Agnes fence handling), so "blocked" is
  now false — but no edge has been published either. Adopted the audit's defensible phrasing:
  synthesis measured at batch scale, verification incomplete, no projection/card result. Flagged in
  the doc for orchestrator confirmation before recording, since this is the claim most likely to move.
- **The pipeline diagram is corrected: there is no passage-selection stage.** The first draft drew
  `→ select passages →`, inherited from the Run 4 script's "roughly 12 passages for synthesis" line.
  The recording owner caught it. Verified at head: `paperPrompt.ts:227-230` — *"The full canonical
  text is embedded verbatim and UNMODIFIED — no windowing"* — and the CLI's `synthesize-papers` makes
  one provider call per whole paper. The legacy `selectPassages` window survives in-tree behind the
  older pair-based `synthesize` command (`synth/index.ts:140`, `singlePaper.ts:319`), which is why
  the stale framing is easy to reintroduce. Authority is issue **#300 §A**, which deletes the
  prefilter rather than fixing it.
- **The deleted prefilter is now a narrated beat, not a footnote.** Issue #328 §2.3 asks for reversed
  decisions with their reasons, and this one is measured: the keyword window searched `comfort` in a
  gut-and-mood paper (0 hits) while 45 mentions of "depress" were never shown to the model, and two
  live `gpt-5` runs returned 0 claims. Slide 3 grew 25s→28s to carry it, taken from Slide 2 (17s→14s);
  the cut still totals 3:00.
- **No regional framing in the video.** On the recording owner's instruction: nothing shipped is
  region-specific — no localisation, no regional data source, no market-specific feature — so
  "built for ASEAN" is a market intention, not a built thing, and a video claim invites "show me
  which part" with no answer. Removed from Slide 1 and the narration, and added to the never-say
  table. Notably `writeup.md` already carries **zero** ASEAN mentions, and
  `hackathon-direction.md:479` already lists "ASEAN / One Health read as gimmick" as a known risk, so
  this aligns the video with where the submission prose already sits. Left `AGENTS.md:20` and
  `project-context.md:19` untouched — constant-layer product identity is a product decision, not a
  submission-doc one; reported to #328 instead. Note this **contradicts issue #328's own spec for
  Doc 1**, which names the ASEAN framing explicitly.
- **macOS desktop is the recommended primary recording target**, with the `Pixel_10_Pro_XL` AVD as a
  costed fallback. The Run 4 demo was recorded on a Huawei YAL-L21 over `adb reverse` on Windows;
  that device is absent and `adb` is not on `PATH` here, so those mechanics are dead. macOS desktop
  reaches `127.0.0.1:54321` with no forwarding; the emulator would need `.env.public` repointed to
  `10.0.2.2`.
- **The demo is narrated as a local-evidence demo, not an evidence-chain demo.** With
  `verified_edges` at 0, the runbook makes the empty provenance panel the argument — the
  decorrelation invariant is why it is empty — rather than planning a shot that cannot exist.
- **`hack-mvp-demo-script.md` is treated as talk-track and known-gap source only, never as a command
  sequence.** It is PowerShell and does not execute on this host; its SQL-seeder path was translated
  to `docker exec … psql < scripts/seed-test-data.sql`, since `seed-test-data.ps1` is Windows-only.

## Found (reported to #328)

-1. **🛑 The decorrelation invariant is switched OFF at runtime, so Slide 4 as first drafted was a
   false claim.** Executed `llm-router check-config` at head: **`Decorrelation: VIOLATED (allowed by
   TEST-MODE) — synthesis=openai, verifier=openai`**. `router.config.json` *declares*
   `verifier → agnes-2.5-flash`, but a TEST-MODE override block forces all six nodes onto OpenAI and
   disables the invariant, mandating the label *"scaffolded + unit-tested (TEST-MODE:
   single-provider, decorrelation OFF)"* on any result. The block's own exit condition — *"Restore a
   second provider and delete this block"* — is now satisfiable, because an `AGNES_API_KEY` was added
   to `tools/brain-ingest/.env` on 2026-08-01. Recorded as **risk R0** with a blocking "do not record
   this slide yet" banner; `tools/**` is Session A's territory so this is reported, not fixed.
   Unexplained and flagged: how the ledger's 18/50 Agnes calls were made while TEST-MODE routes every
   node to OpenAI.
0. **Router keys must be exported; `tools/brain-ingest/.env` alone is not enough.**
   `LlmRouter.create()` is called with no `env` (`synth/index.ts:225`, `seeder/index.ts:121`,
   `cli.ts:412`) so the router falls back to `process.env`, while brain-ingest's parser loads its
   `.env` into a private Config and never exports. Proven both ways with `check-config`: keys read
   `absent` unexported and `present` after `set -a; . tools/brain-ingest/.env; set +a`. Brain-ingest's
   own source config is fine either way — `--check-config` reports `config OK`, with openalex/pubmed/
   core keyed and s2/lens disabled. Added to the pre-record checklist.
1. **The local D1 corpus index is exact, not stale — this reverses the working assumption.** Direct
   `sqlite3` query of `apps/nao/.wrangler/state/v3/d1/…` on the recording machine: **1,298 papers
   indexed, 756 `fetched`, 739 with `full_text_char_count > 5000`, 542 `discovered`**, extraction
   methods `jats` 488 / `pdf` 259 / `directOa` 5 / `core` 4, with real DOIs and titles. The 756 and
   739 **match the live figures in issue §4 exactly.** Issue §2.1's "nao's papers view is stale"
   holds for the record count but not for the two metrics the issue itself designates as the real
   progress metrics. nao Papers and Overview are therefore both filmable and quotable. R2
   credentials are also present in `apps/nao/.env`, so the index can be rebuilt locally if needed.
   Local R2 is empty, so `/paper/[uid]` still 404s under `next dev` — the list is filmable, the
   detail page is not.
1. **`.github/workflows/nao-d1-etl.yml` is not dispatchable.** #326 added it, but it is
   `workflow_dispatch`-only, its header says it becomes runnable only once the file reaches the
   default branch, and its checkout pins `refs/heads/main`. `origin/main` carries only `ci.yml` and
   `brain-ingest.yml`, and `gh workflow list --all` registers only three workflows — the ETL is not
   among them. Correct label: **Configured target; deployment unproven**, not "Defined in cloud CI."
   The only pre-record refresh path is local `npm run etl`, which needs R2 credentials.
2. **`system-connection-map.md` still carries stale counts at `e6f0e1f`**, after the #305 refresh:
   it says "39 migrations (39 files)" against an actual 41, and describes `.github/workflows/` as
   containing "only `ci.yml` and `brain-ingest.yml`" against an actual 6 in-tree. The 2026-08-01
   freshness audit flagged exactly this (39→41, 2→5); the refresh did not resolve it.
3. **Issue #328 §2.1 as filed is superseded** — it calls #326 "a draft fix awaiting review"; it
   merged at 05:01:06Z, one minute after the issue's own state anchor.
4. **`apps/biotope/.env.public` is gitignored and therefore absent in any fresh worktree**; the app
   throws at startup without it and `flutter analyze` emits `asset_does_not_exist`. That warning is
   the useful tripwire and is recorded as risk R3.
5. **biotope and nao currently point at different backends** — biotope `.env.public` at
   `http://127.0.0.1:54321`, nao `.env.local` at the hosted project, `APP_ENV=development`.
   Architecturally honest (separate trust zones, no runtime calls between them) but it should be a
   deliberate decision before recording, not an accident.

## Verification output

```text
flutter analyze --no-pub          (at e6f0e1f, fresh worktree)
warning • The asset file '.env.public' doesn't exist • pubspec.yaml:85:7
1 issue found. (ran in 3.7s)

flutter devices                   macOS (desktop) · Chrome (web)   — no physical device
flutter emulators                 Pixel_10_Pro_XL (android) · apple_ios_simulator (ios)
adb                               command not found
docker info                       daemon not running
node -v / npm -v                  v26.4.0 / 11.17.0   (nao requires >=26)
supabase/migrations               41 files
.github/workflows                 6 in-tree · 2 on origin/main · 3 registered via gh
```

## Left / Blockers

- **Landing budget.** Per the orchestrator's comment on #328, headroom at `e6f0e1f` was 25 paths /
  471 added lines. This session adds 3 paths. Exact added-line count reported to the issue before
  any push; **not pushed** pending the orchestrator's re-measure and base advance.
- **The macOS build is unproven at this head** — artifacts exist only from 2026-07-28 17:47 local,
  i.e. `HEAD~323`. Recorded as risk R2 and as the first item of the pre-record checklist. Not
  attempted in this session because Docker was down, so the app could not have reached a backend
  anyway.
- Docs 1–3 of #328 remain unwritten. Suggested order in the issue is Doc 2 (starting 2.3) next.
