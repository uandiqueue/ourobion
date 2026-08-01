# Issue 307 Session A no-spend edge artifact projection

memory: none

## Attempted

- Resumed the most recent owner `SESSION A HANDOVER` on issue #307 after the ingestion fix merged, using issue #339, branch `feat/brain/no-spend-edge-promotion-339`, and isolated worktree `C:\\tmp\\ourobion-session-a-339` based on `dev-phase2-run4`.
- Inspected the post-#300 whole-paper path and the real edge-loader contract before changing the downstream seam. No legacy passage synthesis path was invoked or extended.
- Validated the protected local bundle by exact SHA-256 and shared contracts, preflighted all three canonical R2 keys, promoted only missing exact bytes, read the objects back, and ran the real edge-loader from R2 in check mode.
- Kept issue #307 under comment monitoring and posted a measured progress checkpoint after the R2 blocker was removed.
- Diagnosed PR #341's only primary CI failure with the GitHub Actions logs and a GitHub-digest-verified Windows build of the same pinned gitleaks 8.30.1 scanner.

## Changed

- `tools/brain-ingest/src/synth/blueprintArtifact.ts` now has an idempotent R2 blueprint publisher symmetric with the existing claim and verification publishers.
- `tools/brain-ingest/src/synth/paperRun.ts` publishes deduplicated blueprints before accepted claims when `--push-r2` is selected. The R2 store is injectable so runner-level publication order is proven offline.
- `tools/brain-ingest/src/artifactPromotion.ts` and CLI commands `promote-edge-artifacts` / `check-r2-edge-artifacts` implement no-provider, no-database, exact-byte promotion and validation. All three 64-hex hashes and shared contracts are required; a non-identical existing R2 object aborts before any PUT.
- `.github/workflows/brain-pipeline.yml` now defaults to `project-only`. That mode cannot reach hydrate, router configuration, synthesis, or verification; it validates the exact three-object R2 bundle and runs edge-loader with `--no-prune`. A live hosted write additionally requires `confirm_projection=PROJECT`. The full mode uses only `synthesize-papers` and retains required blueprint emission.
- Added artifact-promotion, workflow-structure, and whole-paper runner publication-order regressions.
- Renamed the promotion module's internal generic `key` field to `objectName`; gitleaks had treated two constant identifiers as generic API keys even though no secret value was present.
- Rewrote only this unmerged Session A branch's commits after CI proved the clean final tree was insufficient: the full-history scan correctly retained the two false positives from the pre-rename commit.
- Promoted and read back the exact existing bundle: claims `01c67131f8503e6a3deccadeb02d8cca8567d9caf098c7154ce92d3a7e4612aa`, blueprints `1b6a97097ad007540bb5654f10ef1f2dc4e4ded20f4eb11cdd305a2f649f0da9`, verifications `e5d6652aa1e83e9a57a8d9b79d999037739aa44b9bdd777531bf05cc81c20cd4`.
- Refreshed the rebuildable graphify projection and regenerated the tracked semantic graph view as required by the repository close-out protocol.

## Decided

- Reused the already-produced, owner-accepted artifacts without resynthesis or re-verification. Promotion is content-addressed and collision-safe rather than an unpinned manual upload.
- Published blueprints first, claims second, and verifications last so a failed earlier write cannot expose a dependent artifact without its prerequisite.
- Used `--no-prune` for the project-only hosted write: this bundle may add one verified edge, but it is not authority to delete unrelated hosted projection rows.
- Kept provider secrets out of the project-only environment. Full-operation provider credentials are scoped only to full-only steps.
- The existing Agnes verdict remains verbatim `unsupported` at confidence 0.82 and deterministically projects as `hold @ 0.000`. It demonstrates non-rubber-stamping only, not a proven false-claim catch, and it cannot produce a card.

## Left

- Land issue #339 into `dev-phase2-run4`, then dispatch the merged `project-only` workflow with the three exact hashes and `confirm_projection=PROJECT`.
- Verify the hosted `verified_edges` result from workflow logs and report the result on issues #339 and #307.
- A servable card still requires an eligible supported verification and an extracted-blueprint-to-rules loading path. This session does not shop the existing unsupported verdict or invent that downstream evidence.
- PR #340's newly landed NAO control still presents the legacy pair-shaped dispatch contract. The direct project-only workflow is used for this no-spend projection; the paid NAO control must not silently reinterpret that pair as whole-paper scope.

## Blockers

- No blocker remains for the exact no-spend hosted projection path as long as the repository `SUPABASE_DB_URL` secret continues to target the intended hosted project.
- The current artifact cannot create a card because its only verification is unsupported/hold. No additional provider spend is authorized in this session.

## Verification

- Exact protected local bundle: 12 physical claim lines, 3 blueprint lines, and 1 verification line; all expected hashes matched before network access.
- Exact R2 read-back matched the same three hashes and record counts.
- Real edge-loader R2 dry-run: 11 canonical claims plus 1 verification valid; `sleep_duration_min|decreases|resting_hr_bpm` projected as `hold @ 0.000 (unsupported)` with live artifact posture and provider-attested Agnes identity; no database write.
- `tools/brain-ingest`: typecheck clean; focused regressions 41/41; complete serial suite 481/481.
- `tools/edge-loader`: typecheck clean; complete suite 69/69.
- Workflow YAML parsed cleanly with the repository-locked parser and contains exactly 10 dispatch inputs.
- Exact pinned gitleaks 8.30.1 scans pass with zero findings both in the working tree and across all 515 reachable commits; the pre-fix report was limited to two `generic-api-key` false positives in `artifactPromotion.ts`.
- Context integrity passed. After the CI false-positive fix, the Run 4 landing gate passed at 60/115 paths and 6,142/8,500 added lines.
- No Docker or local Supabase process was started. No provider call was made; OpenAI/Anthropic/Agnes usage did not move.
