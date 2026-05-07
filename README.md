# Biotope

Single-repository project — Flutter mobile app + Supabase backend.

## 📚 Documentation

Read these before contributing:

- `docs/PROJECT-CONTEXT.md` — project principles, goals, phases
- `docs/ARCHITECTURE-CONTEXT.md` — system architecture and data flows
- `docs/STRUCTURE-CONTEXT.md` — repository layout rules
- `shared/SHARED-CONTEXT.md` — shared TypeScript/Dart type contracts
- `docs/ui-context/UI-DESIGN-CONTEXT.md` — design tokens, component specs

## 👥 Session Workflow

1. Open `docs/workspace-context.md` and review what others did last session
2. Update your section with today's goals
3. Update your module's context file (e.g. `m1-context.md`) as you work
4. Record progress in `docs/workspace-context.md` before ending your session

---

## 🛠 Development Setup

### Prerequisites

Install these before running the setup script:

| Tool | Version | All platforms |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Flutter | 3.11+ | [flutter.dev](https://docs.flutter.dev/get-started/install) |
| Android Studio | Latest | [developer.android.com/studio](https://developer.android.com/studio) |

---

### Linux

```bash
# Clone
git clone https://github.com/uandiqueue/biotope.git && cd biotope

# Install Node.js (if not installed)
sudo apt install nodejs npm
# or use nvm: https://github.com/nvm-sh/nvm

# Install Flutter (if not installed)
sudo snap install flutter --classic

# Install Docker (if not installed)
sudo apt install docker.io && sudo usermod -aG docker $USER

# Run setup script
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Configure Android SDK after installing Android Studio
flutter doctor --android-licenses

# Start Supabase and run migrations
npx supabase start
npx supabase db push

# Run the app
cd src && flutter run
```

---

### macOS

```bash
# Clone
git clone https://github.com/uandiqueue/biotope.git && cd biotope

# Install prerequisites via Homebrew (if not installed)
brew install node
brew install --cask flutter
brew install --cask docker
brew install --cask android-studio

# Run setup script
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Configure Android SDK after opening Android Studio once
flutter config --android-sdk ~/Library/Android/sdk
flutter doctor --android-licenses

# Start Supabase and run migrations
npx supabase start
npx supabase db push

# Run the app
cd src && flutter run
```

---

### Windows

Windows uses a **split setup**: Flutter runs natively on Windows, Supabase runs inside WSL2 (via Docker). This avoids USB and port-forwarding complexity.

#### Step 1 — WSL2: clone and start Supabase

> Run in WSL2 terminal

```bash
# Clone
git clone https://github.com/uandiqueue/biotope.git && cd biotope

# Run setup script (checks Node, Docker, Supabase CLI)
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Start Supabase and run migrations
npx supabase start
npx supabase db push

# Note your WSL2 IP — you'll need it in Step 4
hostname -I | awk '{print $1}'
```

#### Step 2 — Windows: install Flutter and Android Studio

Download and install:
- Flutter: [flutter.dev](https://docs.flutter.dev/get-started/install/windows) — extract and add to Windows PATH
- Android Studio: [developer.android.com/studio](https://developer.android.com/studio) — let it install the Android SDK on first launch

Then in **PowerShell**:

```powershell
# Point Flutter to Android SDK
flutter config --android-sdk "$env:LOCALAPPDATA\Android\Sdk"

# Accept Android licenses
flutter doctor --android-licenses
# Press y and Enter for each

# Verify setup
flutter doctor
```

#### Step 3 — Windows: port forward WSL2 → phone

Your phone needs to reach Supabase running inside WSL2. Run this once in **PowerShell as Administrator** (replace `<WSL2_IP>` with the IP from Step 1):

```powershell
netsh interface portproxy add v4tov4 listenport=54321 listenaddress=0.0.0.0 connectport=54321 connectaddress=<WSL2_IP>
```

> To remove later: `netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=0.0.0.0`
> Note: WSL2 IP can change on reboot — re-run this command if Supabase becomes unreachable.

#### Step 4 — Windows: clone repo and configure `.env`

```powershell
# Clone the repo on the Windows side
git clone https://github.com/uandiqueue/biotope.git
cd biotope\src

# Install Flutter dependencies
flutter pub get
```

Find your Windows WiFi IP:
```powershell
ipconfig
# Look for: Wireless LAN adapter Wi-Fi → IPv4 Address
```

Edit `src/.env`:
```
SUPABASE_URL=http://<windows-wifi-ip>:54321
SUPABASE_ANON_KEY=<your-anon-key>
```

#### Step 5 — Run

```powershell
cd src
flutter devices    # confirm phone is listed
flutter run
```

---

## 📱 Android Phone Setup

Same steps regardless of OS.

**On your phone:**
1. Settings → About Phone → tap **Build Number** 7 times
2. Settings → Developer Options → enable **USB Debugging**
3. Plug phone into PC via USB — tap **Allow** on the phone prompt

**Verify connection:**

```bash
# Linux / macOS / WSL2
flutter devices

# Windows PowerShell
flutter devices
```

Your phone should appear in the list before running `flutter run`.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| Phone not detected | Re-enable USB Debugging, try a different USB cable |
| `flutter doctor` shows Android SDK missing | Re-run `flutter config --android-sdk` with correct path |
| Supabase connection refused on phone | Check port forward (Windows Step 3), confirm phone and PC are on same WiFi |
| WSL2 IP changed after reboot | Re-run the `netsh` port forward with the new IP from `hostname -I` |
| `flutter pub get` fails | Check Flutter is installed and `src/pubspec.yaml` exists |
| Docker not running | Start Docker Desktop before running `npx supabase start` |
