# Issue #344 — final ingest loop, A1 seed repair and live ingest

memory: none

## Attempted

- Took Session A ownership of issue #344 on `feat/brain/final-ingest-loop-344`, cut at exact `origin/dev-phase2-run4` tip `2ad1bae89b6af2b6283b500dda7189f796ff417f`.
- Deleted the stale 2026-07-16 `data/corpus/seed-queries.json` projection and ran the real `seed-queries` route from `tools/brain-ingest`.
- Recorded the pre-run local corpus baseline: 1,232 records, 743 fetched, 728 fetched with `fullText.charCount > 5000`, and 0 symptom-instrument-tagged records.
- Started exactly one real unscoped all-seed `ingest` at 2026-08-01T09:30Z; no per-seed loop and no dry-run proxy. The process was still live when the orchestrator required this immediate safety commit.

## Changed

- Added four explicit symptom-instrument × mental-instrument research seeds: IBS-SSS↔PHQ-9, GSRS↔GAD-7, Bristol stool↔HADS, and bowel symptom diary↔affect.
- Made generated seed artifacts retain each static topic's canonical query ahead of LLM variants, preventing named instruments from silently disappearing during paraphrase.
- Bumped seeder prompt provenance to `seeder-2026-08-01.2` and required named instrument/acronym preservation.
- Added focused regression coverage for canonical anchor retention, cap/dedupe behavior, explicit instrument pairs, and barred `log_completeness` absence.
- Carried the pre-existing `.gitignore` safety line for owner-supplied `test_credential.md`, per the orchestrator's explicit disposition.
- Replaced per-record 60 MB manifest rewrites with atomic checkpoints every 100 changed retrieval records; checkpoints validate staged and persisted record counts and flush synchronously on normal exit, SIGINT, and SIGTERM.
- Added focused checkpoint/signal regression tests and exercised a 100-record checkpoint against a temporary copy of the real 21,813-record manifest: count stayed 21,813 before/after and the checkpoint completed in 2.2 seconds. The live manifest was never used as a test target.

## Decided

- Did not add the forbidden hand-maintained metric synonym map. These are explicit research topics plus a generic source-query-retention invariant.
- Stopped before ingest when the first regenerated artifact lacked PHQ-9, GAD-7, and HADS; fixed the seeder and regenerated rather than accepting generic depression/anxiety wording.
- Corrected artifact evidence: 40 candidates (1 derivedFrom, 2 rule_blueprint, 37 static topics), 194 query seeds, all required instrument terms present, 0 `log_completeness` occurrences.
- The first provider attempt failed before dispatch because the LLM router reads `process.env` while ingestion config parses `tools/brain-ingest/.env`; retried by importing existing provider variables into the process without logging values.
- The orchestrator explicitly took A2 and owns `data/corpus/edges/**`; Session A did not run synthesis or verification and will not collide with those append-only artifacts.
- The first continuation exposed an O(n²) scaling defect: retrieval called `Manifest.upsert()` for each existing record, rewriting the full ~60 MB JSONL each time. At 20k+ records this projected to more than 1 TB of logical writes.
- The orchestrator dispositioned **STOP + PATCH + RESUME**, stopped its own background writer, and required atomic checkpoint boundaries, record-count assertions, SIGINT/SIGTERM flushing, testing against a copy, amending the existing single commit, and exactly one resume after the patch.
- A1's decisive question is answered positively: metadata sync completed 17,858 changed `meta/` objects and a complete 21,813-record index (17× the 1,232-record starting corpus); nine fetched papers already carry at least one of the four new symptom-instrument relation tags.

## Left

- The one authorized post-patch `resume` launched at 2026-08-01T14:23:16Z from `tools/brain-ingest`; it is the sole writer and remains in progress. Report the honest state as: **seeds fixed, corpus expanded 17×, retrieval in progress**; do not wait for a total the run window cannot produce.
- The orchestrator owns A2 and `data/corpus/edges/**`; Session A remains out of that append-only territory.
- Hosted projection credentials are derivable from the root management token/password, but this device's hosted Postgres connection reset/timed out before SQL execution. Cloud/CI projection remains the safe route.
- A3 remains after the hosted projection path is available.

## Blockers

- The retrieval write-amplification blocker is fixed and fully tested locally; the patched resume is the remaining A1 execution step.
- Hosted Postgres network reachability from this device remains blocked; no database write was attempted.
