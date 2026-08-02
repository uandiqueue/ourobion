# Issue 375 sideloadable reviewer APK

memory: none

## Attempted

- Audited issue #375 against main, the Windows bounded Android toolchain, GitHub Releases, and the
  connected physical Huawei YAL-L21 phone.
- Exercised both fail-closed APK preflight paths, the complete Flutter analyze/test gate, a universal
  release build, Android signature verification, and an in-place physical-device installation.

## Changed

- Added scripts/build-demo-apk.ps1 to require the approved hosted Supabase URL, explicit acceptance
  of debug signing, a clean source tree for full builds, a universal release APK, embedded-config
  verification, apksigner verification, and SHA-256/source-commit reporting.
- Added an offline Node regression contract and wired it into the CI context job.
- Added the stable reviewer download path, unknown-sources instructions, private credential pointer,
  signing limitations, and explicit iOS exclusion to the root README, biotope README, and demo runbook.

## Decided

- Accept this Windows host's debug keystore for the hackathon sideload artifact only. It is not a
  Play Store artifact, and all demo APK upgrades must be built on this same host; otherwise Android
  must uninstall the old app first.
- Publish one universal APK under the stable biotope-demo-v1 GitHub Release asset path.
- Keep credentials out of the public repository and point reviewers to the private submission handoff.
- Reject the graphify tracked-view refresh: it introduced 11 dangling hyperedge members and erased
  curated community names, so the existing reviewed semantic view was preserved.

## Left

- Unlock the physical phone, open the installed biotope app, and capture proof that the preserved
  signed-in session reaches the hosted backend.
- Obtain PR review and merge to main, rebuild from the clean merge commit, publish the stable GitHub
  Release asset, download and hash-verify it, install that exact asset, and close issue #375.

## Blockers

- Physical-device UI verification currently waits for the owner to enter the phone PIN. No PIN or
  other device credential was requested, stored, or entered by the agent.

## Verification

- APK release contract: 3 passed.
- Flutter analyze: no issues.
- Flutter tests: 827 passed, 26 pre-existing skips.
- Universal release APK: 90,995,544 bytes; hosted URL verified inside the archive; Android v2
  signature verified; SHA-256 bb173a130ec3025f23398115c5f96fa8493fea65e4cafcdd75a702e23be4909e.
- Physical-device update install: adb install -r succeeded without uninstalling or deleting app data.
- Graphify update and graph-view generation: executed and inspected; invalid tracked drift rejected.
