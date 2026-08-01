---
title: Run 4 — flip the router verifier to Agnes, and pin that Agnes stays acceptance-only
summary: Flipped the verifier node to agnes-2.5-flash and implemented owner-directed option (d) — exposing the acceptance context on the plain verify CLI so the Agnes guard stays fully intact; flipped from claude-sonnet-5 as the only family the decorrelation invariant leaves legal now that Anthropic is off-limits, and updated the four posture tests to assert the new posture plus its two real consequences — the verifier escapes USD budget accounting, and it is refused outright on the plain route because Agnes is acceptance-only.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 — Agnes verifier (#307 prerequisite)

Issue: #307; branch: `feat/brain/agnes-verifier-307`; base and exact head:
`aef9bc1c6b534d784f229fef06010f79a1ff6a22` (`dev-phase2-run4` tip, = PR #312 merge);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

## Attempted

- Flip the router verifier before any live run, per the owner's budget update on #307: Anthropic
  US$3 **do not use**, OpenAI US$20 for synthesis, Agnes 50 calls.

## Changed

- `tools/llm-router/router.config.json` — `nodes.verifier.model`:
  `claude-sonnet-5` → `agnes-2.5-flash`. **One line.** (A first attempt via a JSON round-trip
  reformatted the whole file at 86 insertions / 16 deletions; reverted and done surgically.)
- `tools/llm-router/tests/config.test.ts` — the C13 posture test now asserts the Agnes verifier and
  that **no** node routes to Anthropic while it is off-limits.
- `tools/llm-router/tests/decorrelation.test.ts` — the shipped-posture test asserts the Agnes
  verifier family; the routing test now asserts the plain-route **refusal** (see Decided).

## Decided

- **Agnes is the only legal verifier, exactly as the owner reasoned.** Synthesis is `gpt-5`
  (family `openai`); the decorrelation invariant `family(verifier) !== family(synthesis)` is
  unconditional and has no override. Of the configured providers, with Anthropic off-limits and
  `google` having no priced model, `agnes-` is what remains. Leaving `claude-sonnet-5` would either
  spend forbidden Anthropic budget or fail closed at config load.
- **The invariant itself needed no change, which is a point in its favour.** It is a genuine
  pairwise family comparison, not a vendor allow-list, so a new verifier family satisfies it without
  special-casing. Only *which* family satisfies it moved.
- **Two consequences are now asserted rather than left implicit.** Both are real reductions in
  automatic protection and both deserve to be visible in the tests rather than discovered later:
  1. **The verifier escapes USD budget accounting.** `agnes-2.5-flash` is priced free
     (owner-confirmed plan) and reserves exactly **US$0**, so the per-day USD-per-node ledger cannot
     bound this node at all. The 50-call Agnes ceiling is an **operator** cap, not a system limit —
     the owner said so explicitly. The routing test asserts the metered nodes record positive spend
     and, separately, that the Agnes verifier's recorded spend is **exactly zero**. If Agnes ever
     gains a non-zero price that assertion fails loudly, which is correct: a paid Agnes reservation
     must fail closed until the rate is owner-verified.
  2. **The shipped config previously forbade Agnes on *any* node**, precisely because a free-priced
     model escapes the budget. That guard was **narrowed, not deleted**: the verifier is now the one
     sanctioned exception, and an Agnes model creeping onto any other node — where it would escape
     the budget with no owner decision behind it — still fails.
- **`Agnes is acceptance-only`, and the guard stays.** `callApiWorker` throws
  `llm-router api_worker: Agnes is acceptance-only` when `req.acceptance` is undefined, while the
  branch immediately below sanctions exactly `nodeId === 'verifier' && family === 'agnes'`. So
  Agnes-as-verifier is a **designed** combination that must carry an acceptance context — which
  brings the attempt journal, the validated authorization and the per-logical-call POST cap with it.
  That is what bounds the node in place of the USD ledger. **Relaxing the guard to let Agnes onto
  the plain route would have removed the journal AND the USD bound simultaneously**, leaving the
  verifier wholly unconstrained, so it was left alone and the test now pins it: the verifier is
  rejected before any HTTP call and is not billed.
  Consequence for #307 task 2: **verification must run through the live-acceptance path**
  (`liveAcceptance.ts`; `verify()` already takes `acceptance`, `verifier.ts:115`), not the plain
  route. Whole-paper **synthesis** is unaffected — `gpt-5` is metered and runs on the plain route.


## Option (d) — exposing the acceptance context on the plain `verify` CLI

Owner-directed on #307 after I reported the deadlock, and **better than all three options I
proposed**. The capability was already there and merely unreachable: `verify()` declares
`acceptance` (`verifier.ts:115`) and uses it (`:276-279`); `cli.ts` never set it.

- `tools/brain-ingest/src/cli.ts` — `verify --acceptance-authorization <file> --acceptance-run-id
  <id>`, loaded via `loadAcceptanceContext()` and validated by the router's own
  `validateAcceptanceAuthorization`, so a malformed, expired or over-spent descriptor **fails closed
  before any provider call**. The two flags are a **pair** — half an authorization is refused rather
  than silently ignored, because a lone flag would let an operator believe a run was journal-bounded
  when it was not.
- **The `Agnes is acceptance-only` guard is untouched.** That is the whole point: Agnes is free-priced
  and reserves US$0, so the per-day USD ledger cannot bound the verifier node; the attempt journal,
  the validated descriptor and the per-logical-call POST cap are the only remaining bound. Relaxing
  the guard would have removed all three at once.
- `tests/verify.cli.integration.test.ts` — `ACCEPTANCE (i)` now supplies a test authorization and
  keeps **every original assertion** (evidence TEXT + `paperId @ chars:N-M` provenance, the crux O15
  closes). Adapting a test to a new required calling convention, not weakening it. Plus **two new
  guard tests**: the plain route refuses an Agnes verifier with no authorization (before any HTTP
  call, and unbilled), and a lone flag is refused.

### Three defects found while wiring it, each fixed rather than worked around

1. **UTF-8 BOM in the descriptor.** PowerShell's `Out-File`/`Set-Content` emit a BOM by default, and
   `JSON.parse` rejects it with an opaque `Unexpected token` that reads like a malformed
   authorization rather than an encoding artifact. An operator on this platform will hit it
   immediately — I did. Now stripped, matching the tolerance `synth/artifact.ts` already applies.
2. **The attempt journal persists per `authorizationId`, so a fixed test id is flaky-by-design.**
   The journal lives at `data/brain-ingest/live-acceptance/<authorizationId>/attempts.jsonl` and
   survives the run. Because the authorization **hash** covers `issuedAt`/`authorizationBasis`, a
   test with a fixed id but a moving window fails on its *second* execution with
   `journal contains an event from a different authorization` — green once, then flaky. The test now
   mints a **unique id per run** and removes its own journal afterwards: the same fresh-id/fresh-journal
   discipline the owner set for real runs. Verified no stray journal is left behind.
3. **The response stub was the wrong wire shape.** It returned Anthropic Messages JSON because the
   verifier used to be `claude-sonnet-5`. Agnes speaks the **OpenAI chat-completions** wire, so the
   stub no longer parsed and the CLI exited non-zero before reaching any real assertion — the failure
   looked like the guard but was not.

### Verification

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck / tests | clean / **461/461** |
| `tools/llm-router` tests | **121/121** |
| stray acceptance journals after the run | none (only the pre-existing `test-authorization`) |

**No provider calls for this unit.** Spend unchanged at US$0.204.

## Verification

At exact head on toolchain Node `v26.3.0`:

| Gate | Result |
|---|---|
| `tools/llm-router` typecheck | clean |
| `tools/llm-router` tests | **121/121** |
| `router.config.json` diff | **1 line** |
| `node tools/context_sync.mjs --check` | passed |
| `git diff --check` | clean |

- Before the test updates the flip left **4 failures**, each of which was a deliberate posture
  assertion rather than an incidental break: three pinned "Anthropic verifier", and the fourth was
  the plain-route dispatch hitting the acceptance-only guard. All four were updated to assert the
  new posture and its consequences; none was weakened or deleted.
- **No provider calls this session.** Spend unchanged at **US$0.044**.

## Left

- #307 task 2 — the real synthesis + verification run and the `data/corpus/demo-edges/` artifact set
  #246 hard-requires. **Open question for the owner, raised on the issue:** the acceptance path calls
  `validateAcceptanceAuthorization`, so a live Agnes verification needs a valid authorization
  (id, window, caps) and its journal. Whether this session may mint one, or the owner must supply it,
  is not something I should assume — asked on #307.
- #307 task 3 — both MVP goals.
- `gpt-5-mini` (seeder, phrasing, extract_assist, report_narrative) is still `provisional: true`, so
  those nodes cannot satisfy an acceptance-grade price check. Fine for the plain route; it would
  block any acceptance-scoped call on those nodes.
- `gpt-5` and `agnes-2.5-flash` non-provisional pricing both expire **2026-08-08**.

## Blockers

- None for this unit. One open question for task 2, above.

memory: none
