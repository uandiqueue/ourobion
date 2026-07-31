---
title: Replace the pending model-artifact pointers with verified release evidence
summary: Lands the unmerged private-transfer session record and swaps both external-artifact.pending.json placeholders for verified, content-addressed private R2 release pointers without changing model acceptance status.
type: session
scope: model-training
status: canonical
updated: 2026-07-30
---

# Replace the pending model-artifact pointers with verified release evidence

Issue: #250
Branch: `chore/model-training/verified-artifact-pointers-250`

## Attempted

- Clear the one piece of #250 that the 2026-07-30 transfer session recorded as `Left`: the repository
  pointer replacement, which it could not perform from its mandated base.
- Verify the claimed release identifiers independently rather than copying them from an issue comment.

## Changed

- Cherry-picked the prior session's unlanded record
  (`20260730T143059Z-uandiqueue-codex-private-model-artifact-upload.md`) verbatim onto the Run 4
  integration tip, so the transfer evidence exists on the branch that actually carries the pointer files.
- Replaced `model-training/evidence/zebra-v1/external-artifact.pending.json` and
  `model-training/evidence/viceroy-v0/external-artifact.pending.json` with `external-artifact.json`,
  each carrying the verified private prefix, the release id and its derivation, the round-trip
  verification record, and an explicit `acceptance_status` block.
- Rewrote the deferral paragraph in both evidence READMEs to state completion, and documented the
  one-line `sha256sum` command a reader can run to re-derive each release id.

## Decided

- **The prior session's blocker does not apply here.** It could not replace the pointers because
  commit `5b5a812` (which introduced them) exists on `dev-phase2-run4` but not on `dev-phase2`, and
  that session was mandated to base on `dev-phase2`. Run 4 bases every session on `dev-phase2-run4`,
  where the files are present, so the replacement is a clean in-place edit with no history transplant.
- **Kept `validated=false`, `serving_ready=false`, `public_weights_cleared=false` untouched** and said
  so explicitly in both the JSON and the READMEs. Private retrievability is storage, not acceptance;
  the pointer file is the most likely place for a later reader to misread one as the other.
- **Recorded the release-id derivation rather than only the id.** Each id is the SHA-256 of the
  tracked `local-bundle-sha256sums.txt`, so the prefixes are reproducible from repository content
  alone and do not rest on an assertion in an issue comment.
- Left the `pending` wording in older session logs alone — they are append-only historical records.
- Left `blocked pending model-specific licence clearance` in the publication-results reports alone;
  that concerns *public* release and is unchanged by a private transfer.

## Verification

- Both release ids re-derived locally and matched exactly:
  `sha256sum model-training/evidence/zebra-v1/local-bundle-sha256sums.txt` →
  `e1d09fbdf442303bf9c5c3aefbe201a0e8509674d5401eacad84321443589169`;
  `…/viceroy-v0/…` → `751fbf1fb1a680b39b50c91f7dd4d7a0caba404417effde724564615d9849ec2`.
  CRLF and no-trailing-newline variants were also computed and do **not** match, confirming the exact
  byte form the ids were taken over.
- Repository-wide grep for `external-artifact.pending` leaves hits only in append-only session logs.
- No credential, signed URL, bucket token, or model byte appears in any changed file.
- `node tools/context_sync.mjs --check` passes.

## Left

- Revoke the temporary read/write upload credential in Cloudflare. Owner action; #266 supersedes it
  with a bucket-scoped read-only token.
- #266 consumes these pointers as its exact release source.

## Blockers

- None.

memory: none
