# Session 20260608T071424Z — uandiqueue — claude — windows-native-toolchain-setup

> Session log format (use for every session): **Attempted / Changed / Decided / Left / Blockers**.
> A session's FIRST step is to read the latest few files in this directory to resume context, then run
> `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-alton
- **Goal:** Set up the biotope dev environment on this Windows laptop **without WSL** (the WSL↔Windows
  tunnelling for device/emulator testing was too inconvenient), and run the app on an **Android
  emulator**. Install the toolchain **bounded to biotope** (no global PATH pollution). Resolves the
  prior session's "toolchain not installed" blocker.

## Attempted
Stand up the full Flutter + Supabase toolchain on Windows-native (PowerShell, Docker Desktop), all
scoped to the project, then boot the Android emulator and run the app end-to-end against local
Supabase reached via `10.0.2.2` (no WSL terminal, no `netsh` port-forward).

## Changed
- **`scripts/biotope-env.ps1`** (new) — session-scoped activation. Dot-source per shell:
  `. .\scripts\biotope-env.ps1`. Loads the conda env `biotope` (Node + JDK 17) and layers Flutter +
  Android SDK onto PATH; sets `JAVA_HOME`, `ANDROID_HOME/SDK_ROOT`, `ANDROID_USER_HOME`,
  `ANDROID_AVD_HOME`, `FLUTTER_ROOT`, `PUB_CACHE` — all inside the toolchain. Zero global PATH changes.
- **`scripts/setup.ps1`** (new) — idempotent Windows installer that reproduces this whole setup into a
  sibling `..\biotope-toolchain\`: bounded Miniconda → conda env (Node + JDK17), Flutter stable,
  Android cmdline-tools + platform-tools + emulator + platform-36 + build-tools + an x86_64 system
  image, license hash files, an AVD, `flutter config`, env files, and `npm install` + `flutter pub get`.
- **`README.md`** — replaced the Windows **WSL split-setup** (WSL Supabase + `netsh` port-forward +
  WSL-IP chasing) with the **native** flow (Docker Desktop on `localhost`, `scripts/setup.ps1`,
  `scripts/biotope-env.ps1`, emulator → `http://10.0.2.2:54321`). Updated the prerequisites note, the
  emulator Option-B Windows note, and the troubleshooting table.
- **`src/.env.public`** (new, gitignored) — `SUPABASE_URL=http://10.0.2.2:54321` +
  `SUPABASE_ANON_KEY` set to the Supabase CLI's new-format **publishable** key (`sb_publishable_…`).
- **`supabase/.env`** (new, gitignored) — from template.
- **`src/android/app/build.gradle.kts`** — `minSdk = maxOf(26, flutter.minSdkVersion)`; the `health`
  plugin (M3) requires API 26+, so the debug build failed until this was raised.
- **Doc sync (2nd pass):** `README.md` — rewrote emulator Option B (Windows uses the pre-made
  `biotope_pixel` AVD; Android Studio path is macOS/Linux) and added a **"Where dependencies live —
  dev toolchain vs. app"** section (the sibling toolchain is build-only/never deployed; runtime deps
  are declared in-repo and compiled into the artifact or deployed to Supabase; CI installs fresh).
  `docs/STRUCTURE-CONTEXT.md` — listed the `scripts/*.ps1` files + a "dev toolchain is OUTSIDE the
  repo" subsection. `AGENTS.md` §4 — Windows bounded-toolchain pointer. `scripts/setup.sh` — points
  Windows users to `setup.ps1`.

## Decided
- **Toolchain bounding via a Miniconda env (user's choice).** Miniconda is installed *inside* the
  toolchain dir; the env `biotope` hosts Node + a conda-forge JDK 17. Flutter + Android SDK aren't real
  conda packages, so they're portable dirs in the same toolchain, brought onto PATH by the activation
  script. Net effect: one `. .\scripts\biotope-env.ps1` activates everything; nothing global changes.
- **conda-forge only** (`--override-channels -c conda-forge`) to avoid the Anaconda defaults-channel
  Terms-of-Service prompt and keep it FOSS.
- **No WSL.** Docker Desktop already runs the Windows-native daemon and maps Supabase to `localhost`,
  so the emulator reaches it at `10.0.2.2:54321` — the entire WSL-tunnel/`netsh` section is removed.
- **Toolchain lives in a sibling folder** `..\biotope-toolchain` (not inside the repo) so SDK trees
  never confuse Flutter/analysis or git. Overridable via `$env:BIOTOPE_TOOLCHAIN`.
- **Android env vars:** set both `ANDROID_USER_HOME` and `ANDROID_AVD_HOME` to the *same*
  `…\android-config\avd` — avdmanager writes via the former, the emulator lists via the latter; if they
  disagree the AVD is created but invisible.
- **Licenses accepted via deterministic hash files** (the `sdkmanager --licenses` stdin pipe doesn't
  reach the JVM through the `.bat` wrapper under PowerShell).

## Verified (end-to-end ✅)
- `flutter doctor`: Flutter 3.44.1 + Android toolchain (SDK 36) green; only Visual Studio flagged
  (Windows-desktop only — irrelevant for Android).
- App **builds, installs, and launches on the `biotope_pixel` emulator**; the Biotope **sign-in screen
  renders** (so `flutter_dotenv` + `Supabase.initialize` succeeded).
- Connectivity: emulator pings host alias `10.0.2.2` (ttl 255); Supabase GoTrue `/auth/v1/health`
  returns HTTP 200. The `emulator → 10.0.2.2:54321 → Docker Supabase` path works with no WSL/port-forward.

## Left
- **Health plugin (M3):** launch logs a *non-fatal* `ClassCastException` —
  `MainActivity cannot be cast to androidx.activity.ComponentActivity`. The health plugin needs
  `MainActivity` to extend **`FlutterFragmentActivity`**. App runs fine otherwise; left unfixed since
  it's M3 (Alton's) workstream and likely the gate on the pending "end-to-end health test" item.
- Decide whether to commit/push these changes (own issue + branch per AGENTS.md §7) — not done yet.
- Mirror this in `scripts/setup.sh` messaging if a Windows contributor ever uses Git Bash (low priority).

## Blockers / notes
- **`VirtualizationFirmwareEnabled` WMI flag reads False**, but WSL2 + Docker are running, which
  *requires* hardware virtualization — so the emulator works via the Windows Hypervisor Platform. That
  flag is the unreliable VBS bit, not raw VT-x; ignore it.
- **npm 11 (Node 26) blocks lifecycle scripts** — Supabase's `postinstall` (downloads the CLI binary)
  warns about `allow-scripts`; the binary still resolved (`npx supabase --version` → 2.81.2).
- Toolchain is machine-local and gitignored-by-location (sibling dir); only the two `scripts/*.ps1` +
  doc updates are committed, so the *procedure* is reproducible across machines.
