# Ourobion biotope — Flutter app

The Ourobion **biotope** mobile app (iOS + Android) — the daily One Health logging + insights surface.
This README is the **how-to-run home** for biotope; product/architecture/UI rationale lives under
[`docs/`](../../docs/) (see the root [`README.md`](../../README.md) pointer).

> Run the commands below **from the repo root** unless noted — the setup scripts, the bounded
> toolchain, and the local Supabase stack are repo-wide.

---

## Reviewer APK (Android)

Download the universal
[`ourobion-biotope-demo.apk`](https://github.com/uandiqueue/ourobion/releases/download/biotope-demo-v1/ourobion-biotope-demo.apk).
It is self-contained and connects to the hosted demo Supabase project; reviewers do not need Flutter,
Android Studio, Docker, or a local backend.

1. Download the APK on an Android phone.
2. If prompted, allow the browser or file manager to **Install unknown apps**.
3. Open the APK and complete the Android install prompt.
4. Sign in with the shared reviewer account published in the
   [root README](../../README.md#shared-test-account). It is view-only in both products, so nothing
   one reviewer does changes what the next one sees. No backend key is published with it — the
   Supabase publishable key is not committed to this repository.

This hackathon artifact is debug-signed for sideloading, not Play Store publishing. Every demo APK
must be built on the same Windows host because its debug keystore is machine-specific. If a build from
another host must be installed, first uninstall the older demo (which deletes its local app data).
iOS distribution is out of scope: building and installing it requires a Mac and a paid Apple
Developer account.

### Maintainer release build

The release script refuses accidental debug signing and refuses any backend other than the approved
hosted demo project. First copy the approved public-only `apps/biotope/.env.public` into the build
worktree, then run:

```powershell
# If this worktree is not beside the bounded toolchain, point to the existing one:
$env:BIOTOPE_TOOLCHAIN = 'C:\path\to\biotope-toolchain'
.\scripts\build-demo-apk.ps1 -PreflightOnly -AcceptDebugSigning
.\scripts\build-demo-apk.ps1 -AcceptDebugSigning
```

Run the full build only from a clean, committed, reviewed checkout; it refuses a dirty Git tree. The
second command builds one universal `app-release.apk`, re-opens it to verify the embedded hosted
config, verifies its Android signature, and prints its byte size, SHA-256, and source commit. Do not
use `--split-per-abi` for the reviewer artifact.

---

## Local config (env)

The app loads `apps/biotope/.env.public` via `flutter_dotenv`. It is **bundled as public client
config**, so it must contain only values safe to expose in the app package:

```env
SUPABASE_URL=http://127.0.0.1:54321   # 10.0.2.2 for the Android emulator; LAN IP for a physical phone
SUPABASE_ANON_KEY=your-anon-key       # printed by `npx supabase start`
```

Create it from the template:

```bash
cp apps/biotope/.env.public.example apps/biotope/.env.public
```

Backend/private secrets belong in `supabase/.env` or Supabase secrets — **never** in
`apps/biotope/.env.public` (it ships inside the app).

---

## Prerequisites

| Tool | Version | Where |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Flutter | 3.11+ | [flutter.dev](https://docs.flutter.dev/get-started/install) |
| Android Studio | Latest | [developer.android.com/studio](https://developer.android.com/studio) |

> **Windows users:** install only **Docker Desktop + Git**, then run `.\scripts\setup.ps1` — it
> installs Node, the JDK, Flutter, and the Android SDK *bounded to this project* (no global installs,
> no WSL). See the [Windows](#windows) section. The table above applies to Linux/macOS.

---

### Linux

```bash
git clone https://github.com/uandiqueue/ourobion.git && cd ourobion

# Node.js (if not installed)
sudo apt install nodejs npm            # or nvm: https://github.com/nvm-sh/nvm
# Flutter (if not installed)
sudo snap install flutter --classic
# Docker (if not installed)
sudo apt install docker.io && sudo usermod -aG docker $USER

# Bounded setup (installs graphify etc.)
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Android SDK licenses after installing Android Studio
flutter doctor --android-licenses

# Local Supabase + migrations
npx supabase start
npx supabase db push    # use `db reset` if on docker

# Run
cd apps/biotope && flutter run
```

### macOS

```bash
git clone https://github.com/uandiqueue/ourobion.git && cd ourobion

# Prerequisites via Homebrew (if not installed)
brew install node
brew install --cask flutter
brew install --cask docker
brew install --cask android-studio

chmod +x scripts/setup.sh && ./scripts/setup.sh

# Android SDK after opening Android Studio once
flutter config --android-sdk ~/Library/Android/sdk
flutter doctor --android-licenses

npx supabase start
npx supabase db push    # use `db reset` if on docker

cd apps/biotope && flutter run
```

### Windows

Windows runs **natively — no WSL, no port-forwarding.** Docker Desktop runs the Supabase stack and
maps it to Windows `localhost`, and the **entire toolchain is installed bounded to this project** (in a
sibling `..\biotope-toolchain\` folder, via Miniconda) so nothing touches your global PATH.

**Prerequisites you install yourself:** **Docker Desktop** (started) + **Git**. That's it — Node, the
JDK, Flutter, and the Android SDK are installed *bounded to ourobion* by the setup script.

```powershell
git clone https://github.com/uandiqueue/ourobion.git
cd ourobion

# Installs (into ..\biotope-toolchain): Miniconda -> conda env "biotope" (Node + JDK 17),
# Flutter SDK, Android SDK + emulator + an AVD; configures Flutter; creates env files; installs deps.
# Idempotent. First run takes a while (large downloads).
.\scripts\setup.ps1
```

**Activate the toolchain in every new shell** (session-scoped — puts `node`, `flutter`, `adb`, the
emulator, and the conda JDK on PATH for that session only):

```powershell
. .\scripts\biotope-env.ps1
```

> Override the toolchain location with `$env:BIOTOPE_TOOLCHAIN` before sourcing if it lives elsewhere.

**Start Supabase (Docker Desktop):**

```powershell
npx supabase start          # first run pulls the Docker images
npx supabase db reset       # apply migrations to the local DB
```

`supabase start` prints an **anon key** — paste it into `apps\biotope\.env.public` as
`SUPABASE_ANON_KEY`. The URL is already set for the emulator:

```
SUPABASE_URL=http://10.0.2.2:54321
SUPABASE_ANON_KEY=<anon key from supabase start>
```

> `10.0.2.2` is the Android emulator's alias for the host's `localhost`. **On a physical phone**, set
> it to your PC's LAN IP (`ipconfig` → Wi-Fi → IPv4) and make sure phone + PC share a network.

### Windows build-memory envelope (16 GB host)

Android builds are deliberately serialized for the documented 16 GB Windows setup. The committed
`android/gradle.properties` limits the single Gradle process to a 1.5 GB heap, 768 MB metaspace, and
256 MB code cache; Kotlin compiles in that process and Gradle uses one worker. These are build-tool
limits only — they do not change the compiled app or skip any build stage.

Before a full Android build, stop restartable heavyweight workloads such as a local Nao server or
local Supabase/Docker stack when they are not needed. Run Flutter tests with one task at a time, then
run one Android build; do not overlap a build with another Flutter/Gradle command, an emulator boot,
or a second agent's package install. CI remains independent and runs its normal checks.

For a reproducible debug evidence run on Windows:

```powershell
cd apps\biotope
flutter test --no-pub --concurrency=1
flutter build apk --debug --target-platform android-arm64 --no-pub
```

Record the build result and available-memory observation with the issue/PR; do not replace the
committed limits with ad-hoc larger JVM flags.

---

## Running on Android

Use a **physical phone** or an **emulator** (AVD) — both work with `flutter run`.

### Physical phone (all platforms)

1. Settings → About Phone → tap **Build Number** 7×
2. Settings → Developer Options → enable **USB Debugging**
3. Plug in via USB → tap **Allow** on the phone
4. `flutter devices` should list it, then `cd apps/biotope && flutter run`

### Emulator

**Windows (bounded toolchain):** `scripts/setup.ps1` already created an AVD named `biotope_pixel`.
After `. .\scripts\biotope-env.ps1`:

```powershell
flutter emulators --launch biotope_pixel
flutter devices
cd apps\biotope; flutter run
```

**macOS / Linux (Android Studio):** Android Studio → **Virtual Device Manager** → **Create Device**
(e.g. Pixel 8, API 35) → boot it → `flutter devices` → `cd apps/biotope && flutter run`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `flutter` / `node` / `adb` not recognized (Windows) | Dot-source the toolchain first: `. .\scripts\biotope-env.ps1` |
| Phone not detected | Re-enable USB Debugging, try another USB cable |
| `flutter doctor` shows Android SDK missing | Re-run `flutter config --android-sdk` with the correct path |
| Emulator can't reach Supabase | Confirm `SUPABASE_URL=http://10.0.2.2:54321` in `apps/biotope/.env.public` and `npx supabase start` is running |
| Connection refused on a physical phone | Set `SUPABASE_URL` to your PC's LAN IP (not `10.0.2.2`); phone + PC on same Wi-Fi |
| `flutter pub get` fails | Ensure the toolchain is active (Windows: `. .\scripts\biotope-env.ps1`) and `apps/biotope/pubspec.yaml` exists |
| Docker not running | Start Docker Desktop before `npx supabase start` |
| Android build exhausts memory | Stop restartable local workloads, keep only one Flutter/Gradle command active, then use the committed 16 GB envelope above; do not raise JVM limits without measured review |

---

## Where dependencies live — dev toolchain vs. app

The sibling **`..\biotope-toolchain\`** (Miniconda env, Flutter SDK, Android SDK, JDK) is **only a
local build/dev environment** — build tooling, not a runtime dependency. It is never deployed, never
committed, and is fully disposable (delete it and re-run `scripts/setup.ps1`).

What actually travels is declared **inside the repo** and resolved fresh where needed:

| Layer | Declared in | Ends up |
|---|---|---|
| Flutter app (Dart) | `apps/biotope/pubspec.yaml` + `.lock` | **Compiled into the build artifact** (`flutter build apk`/`appbundle`/`ipa`/`web`) — self-contained; the device needs no Flutter SDK. |
| Shared TS contracts | `shared/package.json` + lockfile | Type-checked in CI; bundled into edge functions that use them. |
| Backend logic | `supabase/functions/*` (Deno/TS) | `supabase functions deploy` → Supabase's managed Deno runtime. |
| Database schema | `supabase/migrations/*.sql` | `supabase db push` → hosted Postgres. |

So biotope has **no "web server"**: the mobile app is a compiled binary (deps baked in) and the
backend is hosted by Supabase. `flutter build web` (if ever served) emits static files any web server
serves directly. CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) installs Node +
Flutter from scratch and `npm ci` / `flutter pub get` from lockfiles — it never references the local
toolchain folder.

---

**Doc map (start here):** [`docs/INDEX.md`](../../docs/INDEX.md).
**Product / architecture / UI rationale:** [`docs/implemented/project-context.md`](../../docs/implemented/project-context.md),
[`docs/implemented/biotope/architecture-context.md`](../../docs/implemented/biotope/architecture-context.md),
[`docs/implemented/biotope/ui-design-context.md`](../../docs/implemented/biotope/ui-design-context.md).
The other app — the **nao** web dashboard — has its own [README](../nao/README.md).
