# Run 4 per-unit base advance after #329

memory: none

## Attempted

- Advanced the mutable Run 4 per-unit landing base for issue #330 after PR #329 correctly failed against a stale integration-history budget.
- Measured `origin/dev-phase2-run4` before editing at `e6f0e1f09a1cae7ab02e580af88c3da88c99298d` (accepted PR #305 integration merge), then caught it advancing during the mandatory immediate pre-push check. Rebasing onto `9867bae92038b33b262732ac8255b9144409f638` (accepted PR #331 integration merge) and regenerating the pins/evidence prevented a stale push.
- Regenerated all four frozen Supabase function graphs with Deno 2.8.1 and regenerated the deploy attestation with Supabase CLI 2.81.2.

## Changed

- Pinned `RUN4_UNIT_BASE_SHA` to `9867bae92038b33b262732ac8255b9144409f638` in the release gate, CI workflow, regression test, and generated attestation provenance.
- Retained `abcba95f8386d31c49f62f20f4b623de180e29c0` as superseded provenance and recorded why it was exhausted: seven later merges consumed 8,029 of 8,500 added lines, leaving 471; PR #329 measured 9,756 added lines from that stale base. PR #331 then added another 178 accepted lines, bringing the eight-merge history delta to 8,207 and leaving 293.
- Retained the never-pushed `e6f0e1f09a1cae7ab02e580af88c3da88c99298d` candidate as provenance for the pre-push move.
- Left the 115-path / 8,500-line caps, immutable product base, 28 MT4 exclusions, binary allowances, and `productCapAcceptanceClaimed: false` unchanged.

## Decided

- Carried forward the existing four content-free local serve-probe route records because Docker Desktop was unavailable. This is not claimed as a fresh route probe or hosted-deploy parity.
- Accepted that carry-forward only after fresh graph evidence proved byte-identical to the prior manifest: all four module-graph, entrypoint, and import-map hashes plus config and lock hashes matched. The generated manifest differed only at `provenance.unitBaseSha`.

## Left

- Re-measure the remote integration tip immediately before push. If it moved, update all four pins and regenerate the attestation again.
- After #330 lands, rebase PR #329 onto the new integration head, regenerate its attestation, rerun exact-head CI, and merge it.

## Blockers

- Fresh local function route probing was BLOCKED because Docker Desktop's Linux daemon was unavailable. No other #330 gate is blocked.
