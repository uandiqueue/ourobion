---
title: R4-U1 correction — reconciled onto tip, history scan scoped to the landing ref, three live bypasses closed
summary: Rebuilt the U1 security-gate unit on the current dev-phase2-run4 tip with zero deletions of merged U2 content, fixed four real architecture-boundary violations, established that the five secret-scan findings were synthetic fixtures on an unmerged sibling branch and scoped the history scan to the landing ref with strictly stronger proof obligations, folded #183 in as a recorded (not gating) product-cap measurement, and closed three bypasses that an independent re-review found still open.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# R4-U1 correction — boundaries, secret scanning, and the product cap

Branch: `ci/run4-u1-reconciled` · supersedes PRs #170 and #180 · refs #178, #166, #183

## Attempted

Picked up the rework brief on #178 and verified its claims against the live repo rather than
trusting them. Two of them had gone stale:

- The brief said #170 was green (21/21). It is not — `gh pr update-branch 170` had since merged the
  tip, and both `Architecture boundaries` and `Secret scan` now fail on it. Those two failures are
  the actual work, and they were invisible while the branch sat on an old base.
- The brief said to fold #183 in. Measuring first showed it cannot be enforced (below).

Rebuilt the unit by cherry-picking U1's three commits onto a fresh branch off the current tip
(`da6b11b`) rather than merging, per the brief. Confirmed explicitly that the result **deletes none**
of the merged U2 files — `authz.ts`, `authzServer.ts`, `internal_auth.ts`, the `nao_*` migrations and
`supabase/tests/authz/**` are all present, and `git diff --diff-filter=D` over the range is empty.

## Changed

- **Architecture boundaries (4 real violations → 0).** `archive_status_widget_test.dart` and
  `archive_trends_widget_test.dart` in `m5b_insight_engine` imported `m5a_baselines/impl/*` directly.
  The m5a façade already exports `MetricSeriesService` and `MetricDailyPoint` unfiltered, and
  production code already crosses that module line through the façade (`archive_tab.dart:8`), so this
  was an import-path fix. The guard was not touched.

- **Secret scan.** All five findings are one commit — `4e02525`, on the *unmerged* sibling branch
  `feat/db/run4-u3-atomic-demo-loader` — and the matched value is the synthetic fixture literal
  `'u3-acceptance-key-0001'` assigned to a `requestKey` field in two nao test files. Scoped scans
  confirm the attribution: `--log-opts=origin/dev-phase2-run4` → 0 leaks, unscoped → 5. `gitleaks git`
  walks every ref by default and `fetch-depth: 0` fetches every ref, so the job was failing this
  branch for a sibling branch's content — and would have done so for *every* branch once U1 landed.
  The history step is now pinned to the landing ref (`--log-opts=HEAD`).

  Narrowing a scan is only safe if the remaining coverage is proven, so the scoping ships with more
  enforcement than it removes. No allowlist entry, rule, or path suppression was added:
  - `verify-report --scope history` previously accepted **any** empty report — a genuine fail-open.
    It now requires an explicit `--min-commits` floor, rejects shallow or rootless ancestry, and
    verifies pinned sentinel commits really are ancestors of HEAD.
  - New `history-canary` subcommand plants a secret that exists **only** in an ancestor commit,
    proves an exported clean tree scans 0, and proves `--log-opts=HEAD` still detects it. If scoped
    history scanning ever stops reaching ancestry, that step fails closed.

- **#183 immutable product cap — implemented, recorded, not gating.** Immutable product base, MT4
  exclusion bound to its merge provenance by path/status/blob hash, and rejection of base drift,
  exclusion widening, rename/copy ambiguity and binary rows are all in. It is **not** wired to CI: the
  product union on the tip already measures **186 paths / 25,773 added lines** against the 115 / 8,500
  cap (196 / 31,017 with U1), essentially none of it this unit's. Gating it would turn Run 4 red for
  every branch in the run. No cap was raised. `productLandingDelta` reports breach as data;
  `checkProductLandingDelta` throws and is exercised by negative tests, so wiring it later is a
  one-line change. The attestation records `productCapAcceptanceClaimed: false`.

- **Three bypasses an independent re-review found still open**, two of them on the brief's own list
  of things the previous pass claimed to have closed:
  1. `const { SUPABASE_SERVICE_ROLE_KEY } = process.env` and `process.env[nameVar]` both defeated the
     client-surface taint guard entirely. Destructured server-only keys now taint their local or
     alias, and a computed env key that cannot be resolved statically fails closed.
  2. One hop of indirection defeated R2a/R2b — `const target = 'model-training'` reached through a
     template, or the name split across `.concat()` and reassembled by `[...].join()`. The checks now
     fold statically-resolvable strings and re-test. Blanket-rejecting non-literal dynamic imports
     was rejected as a fix: 19 legitimate call sites in `tools/` rely on them.
  3. `H3_NO_BULK_ENV` fired on four edge functions handing the whole environment to
     `resolveServerKey`, which consults at most four names. Pre-existing and latent — CI had never
     reached the client-surface step because the history scan failed first. Fixed at the source with
     a bounded `readServerKeyEnv(kind)`; H3 itself unchanged.

- **`RUN4_UNIT_BASE_SHA` advanced `2749381` → `da6b11b`** (authorised by Alton this session). U1's own
  content is ~5,900 added lines, but measured from `2749381` it read 8,611 against the 8,500 cap
  because #214 merged after that base was set and charged this unit for its ~2,878 lines. Caps
  unchanged at 115 / 8,500 and still failing closed; only the per-unit starting point moved.

- The `secret-scan` frozen job hash was deliberately re-frozen for the workflow change, with the
  superseded value recorded inline. `arch-boundaries` reproduces its existing hash unchanged, which
  is what confirms the re-freeze method matches the gate's own parser.

## Decided

- **Superseded both #170 and #180 with one branch.** The cockpit's instruction was to retain a single
  PR. #180 could not be rebased in place (`update-branch` fails on conflicts, and its merge-base
  predates U2 so a careless resolution would delete the merged authorization boundary), and #170
  alone still carries the bypasses #180 exists to close. Cherry-picking both onto the current tip
  produces the same content with none of that risk.
- **Scoped the history scan rather than allowlisting the findings.** The brief said not to narrow the
  scanner, written on the assumption the five findings were real secrets. They are synthetic fixtures
  on a branch that is not an ancestor of this one. The underlying defect was the scan's attribution
  model, not the fixtures. Raised the conflict and confirmed the call before implementing.
- **Recorded the product cap instead of gating on it.** #183 says "No cap increase"; enforcing it
  as-written makes the run permanently red on content no unit can shrink. Measurement plus a tested,
  unwired enforcement path keeps the finding honest without holding every branch hostage.
- **Fixed the edge functions rather than narrowing H3.** #214 has merged, so its files are in the base
  and nothing was raced. Fixing the detector to accommodate the code would have been exactly the
  weakening the brief forbids.

## Verification

Real output, all from this branch:

- `node tools/check_arch_boundaries.mjs` — `Scanned 376 source file(s). OK: no architecture-boundary violations found.`
- `node --test tools/check_arch_boundaries.test.mjs` — 50/50 pass
- `node --test tools/secret_scan_guard.test.mjs` — 111/111 pass
- `node --test tools/run4_release_gate.test.mjs` — 12/12 pass
- `node tools/run4_release_gate.mjs config` — `run4 config/workflow gate: PASS`
- `client-surface` — `14 surface(s) checked, 0 hard violations`
- Scoped history scan, pinned gitleaks 8.30.1 — `306 commits scanned … no leaks found`
- `verify-report --scope history --min-commits 250 --sentinel-commit 77c982…` —
  `0 findings over 417 commit(s) of HEAD ancestry (min 250, 1 root commit(s), 1 sentinel commit(s) confirmed as ancestors)`
- `history-canary` — `exported clean tree scanned 0 findings, --log-opts=HEAD still detected 2 history-only finding(s)`
- Worktree scan — `no leaks found`
- Landing gate — `{"base":"da6b11b…","changedPaths":21,"addedLines":5908}` against 115 / 8,500
- Product cap (recorded) — `196/115 paths, 31017/8500 added lines, 28 MT4 paths excluded — OVER cap; acceptance is a human envelope decision`

## Left

- **The product cap needs a human envelope decision.** 186 / 25,773 on the tip before this unit. Either
  the run is re-scoped or the cap is formally revised; U1 cannot resolve it by writing less code.
- **Coverage gap accepted with the history scoping.** A secret living only in a branch that is not an
  ancestor of `dev-phase2-run4` is no longer incidentally caught by this branch's run. Those branches
  never ran this job themselves — its `if:` is scoped to `dev-phase2-run4` — so the coverage was
  accidental. The real fix is widening the job's branch scope; that touches Run 4 scoping rules and
  belongs to a separate unit.
- **PR #184's fixture literal.** `'u3-acceptance-key-0001'` will trip the scanner on its own branch's
  CI run. Renaming it in a new commit will not help — gitleaks scans history — so it needs either a
  reviewed per-fingerprint allowlist entry or a history rewrite before that branch lands.
- **Latent TS/JS alias blind spot.** An unresolved bare specifier classifies as `external` with no
  fail-closed check, asymmetric with the Dart `package:` handling. Not live today (no `jsconfig.json`,
  no `package.json` `imports` field anywhere in the tree) but it would silently stop protecting the
  moment one is introduced.
- **`supabase/functions/compute-baselines/index.ts` contains a raw NUL byte** at line 172, used as a
  Map composite-key separator inside a template literal. Git still treats the file as text so the
  landing gate is unaffected, but `grep`/`file` see it as binary. Writing it as `\0` would be
  byte-identical at runtime and is worth a follow-up.

## Blockers

- None for this unit. The cap decision and the branch-scope widening above are follow-ups, not
  blockers on landing this PR.

memory: none
