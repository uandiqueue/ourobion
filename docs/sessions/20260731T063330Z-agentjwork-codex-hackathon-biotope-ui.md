---
title: Hackathon Biotope UI fidelity and demo hardening
summary: Reconciled Scan, Home, Archive trends, citation links, and Profile copy with the accepted Biotope reference, with full Flutter gates and a bounded physical Android build.
type: session
scope: ui
status: canonical
updated: 2026-07-31
---

# Hackathon Biotope UI fidelity and demo hardening

Issue: #268 · branch: `fix/ui/run4-hackathon-fidelity-268-rerun` · base: `dev-phase2-run4` @ `3557f75`

## Attempted

- Reconcile the hackathon filming surfaces against the accepted HTML authority at
  `Project Ourobion Biotope Redesign/Biotope Biomech Botanical.dc.html` while preserving live
  data, non-diagnostic copy, and honest unavailable states.
- Run the complete Flutter analyzer/test/build gates and perform an app-only clean install on the
  connected Huawei without touching Android settings, another app, personal data, or a provider.
- Complete signed-in physical flows. The configured disposable credentials were rejected, and the
  managed approval boundary did not permit creating the remote disposable account; the owner tagged
  that remaining decision at https://github.com/uandiqueue/ourobion/issues/268#issuecomment-5140038434.

## Changed

- Rebuilt Scan around a public, pumpable 262dp globe: a clipped 1.5-second cubic sweep, a 420ms
  shrink to 190dp, and a 380ms opaque result reveal. Removed the unrelated channel-list sweep.
- Kept exactly one selected Scan gap expanded, exposed each scalar metric's complete accepted
  database range, and retained targeted one-column saves plus collapsed `LOGGED / Change` cards.
- Replaced Home's health-state-shaped labels with explicit weighted logging-coverage buckets,
  visible `/100 weighted points`, basis, and bucket range; retained narrow-screen overflow safety.
- Removed duplicate artwork from Archive's empty state and made trend axes metric-aware: ordinal
  urine/stool labels, valid integer scalar ranges, and units only for continuous wearable metrics.
- Added DOI-only canonical paper links to provenance, external-launch failure feedback, and real DOI
  widget coverage; internal corpus IDs and malformed content remain non-clickable.
- Clarified Profile semantics: wearable ownership is separate from provider access, living-backdrop
  state is device-only, and the saved digest preference sends neither a digest nor notification.
- Added/updated focused widget, service, model, copy, range, semantics, and reduced-motion tests.

## Decided

- Environment remains visibly inert and labelled unavailable because there is no M4 source behind it.
- The result reading surface uses an opaque radial-white overlay for filming legibility rather than
  inheriting the HTML mock's translucent edge.
- Citation actions exist only when the stored paper identifier is a syntactically valid DOI; no URL
  is guessed from internal identifiers or arbitrary active content.
- The project-local `.env.public` was copied only into the ignored build asset for physical startup;
  it is not tracked, printed, or included in this change.

## Verification

- `flutter analyze --no-pub`: clean.
- `flutter test --no-pub --concurrency=1`: 415 passed, 26 skipped by design, zero failures.
- Focused issue suites: 102 passed after the four initial regressions were corrected.
- `git diff --check`: clean.
- Android debug ARM64 build: green under a verified Gradle cap of 1536MB heap, 768MB metaspace,
  256MB code cache, and one worker. The first unconstrained build exposed host OOM; the bounded build
  succeeded in 282.7 seconds and the environment-bearing incremental rebuild succeeded in 49.0 seconds.
- Physical Huawei clean cycle: APK declared only `com.ourobion.app`; only that package was uninstalled,
  freshly installed, launched, and force-stopped. Supabase initialized and the polished sign-in screen
  rendered. Sanitized blank-login evidence remains outside git at `C:\tmp\issue268-qa\current.png`.
- No credential, screenshot, `.env.public`, personal data, Android setting, other app, or provider call
  entered git or the tracked artifacts.

## Left

- Signed-in Huawei checks of Scan animation/result contrast, single-metric inline logging, Archive,
  citation rendering, and Profile copy are deferred to the tagged owner decision on issue #268.
- CI, review, and merge of the issue branch into `dev-phase2-run4`; this session does not merge or close.
- Incremental semantic graph refresh remains deferred because this task explicitly prohibited provider
  calls and the previous run4 graph update timed out in the same environment.

## Blockers

- `codex-windows-sandbox-setup.exe` is still missing, so normal sandboxed patch/image helpers fail.
  Source edits used only Codex's authorized in-memory apply-patch runner; screenshots were sanitized
  and inspected through bounded in-memory derivatives.
- The disposable login was rejected and the managed reviewer blocked remote signup submission. No
  workaround, reset, mail access, or external account mutation was attempted.

memory: none
