# Issue 396 release APK network hotfix

memory: none

## Attempted

- Reproduced the merged reviewer APK's authentication failure on the attached Huawei and traced the
  release-only network error through ADB logs and the merged Android manifests.
- Compared the main, debug, and profile manifests and confirmed that only debug/profile declared
  android.permission.INTERNET.
- Clean-installed the first corrected APK and authenticated successfully on the attached Huawei,
  then found that a right swipe raised SAVED from 0 to 1 while Archive retained its launch-time
  empty state.

## Changed

- Declared android.permission.INTERNET in the Android main manifest so release APKs can reach the
  hosted Supabase backend.
- Made the guarded reviewer APK preflight fail closed when the main manifest lacks that permission.
- Added a regression assertion covering both the release manifest and the preflight guard.
- Passed Archive's active-tab state from AppShell and re-read saved cards on hidden-to-active
  transitions, with a widget regression that reproduces a save while Archive is hidden.

## Decided

- Keep the hotfix limited to release networking and its build-time guard; the demo session overlay
  and hosted write-discard protections are unchanged.
- Build only through scripts/build-demo-apk.ps1 with the approved hosted public configuration and
  explicitly accepted same-host debug signing.
- Treat physical-device UI round trips as the acceptance boundary: a changed header count alone is
  insufficient when the destination tab can retain stale state.

## Left

- Rebuild and verify the guarded APK from the complete hotfix.
- Replace it on the attached Huawei, verify the save/archive, dismiss, reset, and process-restart
  flows, then publish the reviewed branch as a PR into main.

## Blockers

- None.

## Verification

- node --test scripts/tests/build-demo-apk-regression.test.mjs - 4 passed.
- flutter analyze --no-pub - no issues.
- flutter test --no-pub - 828 passed, 26 skipped after adding the activation regression.
- Guarded APK preflight - hosted backend, release network permission, and accepted sideload signing
  all passed.
- First corrected APK on Huawei YAL-L21 - clean install and demo email/password authentication
  succeeded with no app-level network/auth exception; save raised SAVED from 0 to 1 and exposed the
  stale Archive activation defect fixed in this branch.
