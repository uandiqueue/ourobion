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

- Review and merge the prepared PR into main.
- Rebuild from merged main before replacing the public biotope-demo-v1 release asset; the verified
  branch APK remains a private sideload artifact and is not Play Store eligible.

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
- Final guarded APK from f0e2eb80f75cc79d247b3a6a97917d244f62e7c4 - 91,011,968 bytes; SHA-256
  5f1911538ae6992ee49d9259339e22391a9b14108c2e02eb0fbadc93c9b29164; hosted backend embedded;
  android.permission.INTERNET packaged; APK Signature Scheme v2 verified with the approved
  same-host debug certificate.
- Final Huawei YAL-L21 acceptance - clean install and demo authentication passed; daily
  self-report returned without an app error; research card present; save moved SAVED 0 to 1 and
  appeared in Archive; left-dismiss removed the next card; reset reported 2 restored, moved SAVED
  to 0, and emptied Archive.
- Full force-stop/relaunch - authentication persisted while session overlays cleared: SAVED was 0,
  the seeded research card was back, Archive was empty, and all 7 daily channels were open again.
