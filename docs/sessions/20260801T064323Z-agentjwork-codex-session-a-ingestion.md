# Issue 307 Session A ingestion and grounded-edge handover

memory: none

## Attempted

- Resumed the latest `SESSION A HANDOVER` on issue #307 from exact base `e6f0e1f`, rebased onto the owner-specified integration tip `c5176a9` after PR #332 landed, then advanced at pre-push to current `dev-phase2-run4` tip `c162393` (a merge descendant whose first parent is `c5176a9`).
- Verified the inherited `ingest --limit 1100` process was no longer running. Measured the protected local corpus at 6,184 records, 756 fetched, and 739 with `fullText.charCount > 5000`; no unobserved fetch progress was claimed.
- Selected one post-#300 whole-paper claim (`sleep_duration_min|decreases|resting_hr_bpm`) only after offline quote/retrieval gates passed, then dispatched exactly one owner-authorized Agnes verification. The shell wrapper timed out while its Node child remained live, so no retry was issued; the existing PID and acceptance journal were monitored to completion.
- Implemented and tested incremental R2 metadata synchronization, then ran ingestion sequentially (never parallel) for `cognitive_clarity_attention`, `physical_activity_step_count`, `social_connection_wellbeing`, `standing_water_breeding_sites`, `hydration_urine_colour_status`, `gsrs`, and `activity_mood_relation`.
- Resumed the queued downstream path only after ingestion moved. Validated the exact local post-#300 edge artifacts through the real edge-loader, then probed the canonical R2 artifact keys read-only.

## Changed

- `tools/brain-ingest/src/run.ts`: the complete `manifest/papers.jsonl` remains synchronized every time, while `meta/<uid>.json` synchronization is restricted to exact records changed during discovery, retrieval, or reconciliation. Repeated unchanged topic runs now perform zero per-paper metadata synchronization instead of an O(corpus) HEAD/PUT scan.
- `tools/brain-ingest/tests/run.test.ts`: added coverage that an untouched corpus member is absent from per-paper sync, a newly discovered record alone is synchronized, the combined manifest remains complete, and an identical rerun performs no additional per-paper write.
- Live corpus projection moved from 6,184 total / 756 fetched / 739 over 5k to 6,180 total / 870 fetched / 845 over 5k. The four-record total reduction was identifier reconciliation, not lost papers. Final status remained zero failed.
- Family spread reached cognitive clarity 2/2 fetched/over5k, physical activity 26/22, social connection 20/20, standing-water/vector 30/30, hydration 26/23, GSRS 20/19, and activity-mood 21/20.
- Posted measured progress, final ingestion evidence, and downstream blockers on issue #307 using body files.

## Decided

- Chose the durable incremental metadata fix rather than merely reducing per-topic limits: bounded runs must retain a complete canonical index while their per-paper R2 work scales with changed records.
- The Agnes artifact is recorded verbatim as `unsupported` at confidence 0.82, quoteCheck 1/1, with one supporting and one contradicting source; owner-wide Agnes usage is 19/50, OpenAI remains US$1.118, and Anthropic remains unused. It demonstrates adversarial non-rubber-stamping only. It is not evidence that the verifier caught a false claim: the retrieved base is thin, domain review is absent, and the validated record contains no prose reasoning that resolves retrieval quality versus appropriate conservatism versus over-strictness.
- Did not reverify, resynthesise, shop for a different verdict, invoke the legacy passage architecture, pass `--no-blueprints`, or hand-edit any artifact/projection.
- Did not dispatch `brain-pipeline.yml`: its live path necessarily reruns paid synthesis and verification, and its dry path intentionally skips the database. No local `SUPABASE_DB_URL` exists, so no hosted target or credential was invented.
- Did not manually upload around the post-#300 producer after finding that `paperRun.ts --push-r2` publishes claims but not required blueprints even though `R2_BLUEPRINTS_KEY` exists. The architecture gap was reported instead.

## Left

- PR the incremental ingestion fix into the issue-specific `dev-phase2-run4` integration branch after push; the mandatory context and post-rebase code gates are green.
- Complete the hosted edge projection without further model spend: add the missing post-#300 blueprint R2 publication seam, publish the already-validated claim/blueprint/verification artifacts, then use an approved projection-only secret-backed job; alternatively, provide an explicitly approved `SUPABASE_DB_URL` target to the loader.
- The local edge-loader dry-run is green for 11 canonical claims plus one live verification; the adverse edge deterministically projects as `hold @ 0.000 (unsupported)` with live artifact posture and provider-attested Agnes identity.
- Track the verified 2026-08-08T00:00:00Z pricing expiry for `gpt-5` and `agnes-2.5-flash`; the router fails closed after expiry and no pricing/config change was made in this scope.

## Blockers

- Hosted projection is BLOCKED on two external/configuration facts: canonical R2 currently returns HTTP 404 `NoSuchKey` for `edges/claims.jsonl`, and no approved database URL is available locally. The existing secret-backed workflow has no projection-only mode.
- The post-#300 required blueprint output is local-only because its R2 publisher is unimplemented. Manually bypassing that producer would violate the owner's instruction to report new-path blockers rather than route around them.

## Verification

- `tools/brain-ingest`: typecheck clean; focused runner tests 14/14; complete serial suite 471/471.
- `tools/edge-loader`: typecheck clean; complete suite 69/69.
- Exact local edge-loader dry-run: 11 claims + 1 verification valid; no database writes.
- Canonical R2 edge-loader check: exact HTTP 404 `NoSuchKey` for the required `edges/claims.jsonl`; no database writes.
- `context_sync --fix-index` produced byte-identical generated indexes; `context_sync --check` passed sessions, memory, decisions, index, and couplings.
- Docker and the local Supabase stack were not started or used.
