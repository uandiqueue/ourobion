---
title: Privately upload and round-trip verify Zebra v1 and Viceroy v0
summary: Uploads both frozen research-model bundles to owner-authorized private R2 content-addressed prefixes and independently downloads and verifies every file without authorizing serving.
type: session
scope: model-training
status: canonical
updated: 2026-07-30
---

# Privately upload and round-trip verify Zebra v1 and Viceroy v0

Issue: #250
Branch: `chore/model-training/private-artifact-upload-250`

## Attempted

- Verify both ignored local model bundles against their frozen six-file SHA-256 manifests before any
  Codex-managed upload.
- Complete the owner-authorized private R2 transfer, independently download each exact release, and
  verify every downloaded byte against the same manifests.
- Preserve all non-serving and non-publication boundaries from issue #250.

## Changed

- Stored Viceroy v0 at private prefix
  `models/viceroy-v0/releases/sha256-751fbf1fb1a680b39b50c91f7dd4d7a0caba404417effde724564615d9849ec2/model/`.
- Stored Zebra v1 at private prefix
  `models/zebra-v1/releases/sha256-e1d09fbdf442303bf9c5c3aefbe201a0e8509674d5401eacad84321443589169/model/`.
- Removed the mistaken interim Viceroy `models/viceroy-v0/releases/sha256-/` duplicate only after the
  correct content-addressed release passed its full round-trip verification.
- Removed all temporary verification downloads while retaining the original ignored local bundles.
- Posted the non-secret transfer and verification evidence to issue #250.

## Decided

- The release id is the full SHA-256 of each frozen checksum-manifest file, yielding deterministic,
  collision-resistant, content-addressed release namespaces.
- Private storage and byte-for-byte retrievability do not change model acceptance or serving status.
  `validated=false`, `serving_ready=false`, and `public_weights_cleared=false` remain unchanged.
- No unrelated model-training history is transplanted onto `dev-phase2`: the pending pointer files are
  present on `dev-phase2-run4` but absent from the mandated session base.

## Verification

- Both local source bundles passed all six frozen SHA-256 checks before upload.
- Each exact private R2 release was independently downloaded into a new ignored directory; all six
  downloaded files passed the same model-specific manifest.
- Final remote listings contain exactly six expected files per release, including Viceroy
  `pytorch_model.bin` at 438007278 bytes and Zebra `pytorch_model.bin` at 438004206 bytes.
- The final Viceroy namespace contains only its correct content-addressed release; the mistaken
  duplicate prefix is absent.

## Left

- Replace `external-artifact.pending.json` with verified release evidence after its source publication
  commit reaches the mandated `dev-phase2` base, or after an explicit branch/base decision authorizes
  that follow-up.
- Revoke the temporary upload credential in Cloudflare after the owner confirms no further write is
  needed; later inference must use a separate bucket-scoped read-only credential.

## Blockers

- Repository pointer replacement cannot be made cleanly from the mandated `dev-phase2` base because
  commit `5b5a812` (which introduced the pending pointer files) exists on `dev-phase2-run4`, not
  `dev-phase2`.

memory: none
