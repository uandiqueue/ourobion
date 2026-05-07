# biotope

This is a single-repository project.

## 📚 Orientation & Documentation

This is a monolithic repository architecture. To understand the rules and boundaries of the modules within the application, you must review the **Constant Layer** documentation before contributing.

- `docs/PROJECT-CONTEXT.md`: Key project principles, goals, and phases (Non-diagnostic rules, ~30s logging).
- `docs/ARCHITECTURE-CONTEXT.md`: High-level system architecture and data flows.
- `docs/STRUCTURE-CONTEXT.md`: The repository layout rules.
- `shared/SHARED-CONTEXT.md`: The shared TypeScript/Dart contracts between modules.

## 👥 Getting Started / Workflow

If you are joining a session on the repository:

1. Open `docs/workspace-context.md`
2. Review the changes made by other team members in their last session.
3. Update your section with the goals for your current session (MUST DO: if you don't know your user's name, ask your user what their name is so you know under whose section to change).
4. Update the individual variable layer module context (e.g. `src/lib/modules/m1_core/m1-context.md`) throughout your session.
5. Record your progress in `docs/workspace-context.md` before ending your workday.

---

## 📱 Testing on Android Phone

This project runs Flutter on **Windows** and Supabase locally on **WSL2**. Follow both sections below.

---

### Part 1 — WSL2 Setup (Supabase backend)

> Run these in your WSL2 terminal.

**Bash**
```bash
# 1. Install dependencies
chmod +x scripts/setup.sh && ./scripts/setup.sh

# 2. Start local Supabase (Docker must be running)
npx supabase start

# 3. Run database migrations
npx supabase db push

# 4. Set up port forwarding so your phone can reach Supabase
#    (run this once — find your WSL2 IP with: hostname -I)
#    Then run the port forward command in Windows PowerShell (see Part 2 Step 3)
```

> After `npx supabase start` completes, it will print your local API URL and anon key.
> These should already match what is in `src/.env` — no changes needed if using defaults.

---

### Part 2 — Windows Setup (Flutter + Android)

> Run these in Windows PowerShell unless stated otherwise.

**Step 1 — Install Flutter on Windows**

Download and extract Flutter from [flutter.dev](https://flutter.dev/docs/get-started/install/windows), then add it to your PATH.

```powershell
# Verify Flutter is installed
flutter --version
```

**Step 2 — Install Android Studio**

Download from [developer.android.com/studio](https://developer.android.com/studio). Run the installer and let it install the Android SDK on first launch.

Then point Flutter to the SDK and accept licenses:

```powershell
flutter config --android-sdk "$env:LOCALAPPDATA\Android\Sdk"
flutter doctor --android-licenses
# Press y and Enter for each license
```

Verify everything is green:
```powershell
flutter doctor
```

**Step 3 — Port forward WSL2 → Windows → Phone**

Your phone needs to reach Supabase running inside WSL2. This forwards traffic from your Windows WiFi IP into WSL2.

First find your WSL2 IP — run this in **WSL2 bash**:
```bash
hostname -I | awk '{print $1}'
```

Then run this in **PowerShell as Administrator** (replace `<WSL2_IP>` with the output above):
```powershell
netsh interface portproxy add v4tov4 listenport=54321 listenaddress=0.0.0.0 connectport=54321 connectaddress=<WSL2_IP>
```

> This survives reboots. To remove it later: `netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=0.0.0.0`

**Step 4 — Configure `.env` on Windows**

Find your Windows WiFi IP:
```powershell
ipconfig
# Look for: Wireless LAN adapter Wi-Fi → IPv4 Address
```

Edit `src/.env` and set:
```
SUPABASE_URL=http://<windows-wifi-ip>:54321
SUPABASE_ANON_KEY=<your-anon-key>
```

**Step 5 — Install Flutter dependencies**

```powershell
cd src
flutter pub get
```

---

### Part 3 — Android Phone Setup

**On your phone:**
1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times to unlock Developer Options
3. Go to **Settings → Developer Options**
4. Enable **USB Debugging**
5. Plug phone into PC via USB — tap **Allow** on the phone prompt

**Bridge USB to WSL2** (if running Flutter from WSL2 — skip if on Windows):

```powershell
# PowerShell as Administrator
winget install usbipd
usbipd list                         # find your phone's BUSID
usbipd bind --busid <BUSID>
usbipd attach --wsl --busid <BUSID>
```

> If running Flutter on Windows (recommended), USB bridging is not needed — plug in and go.

---

### Part 4 — Run the App

```powershell
cd src
flutter devices        # confirm your phone appears
flutter run
```

The app will build and deploy to your phone. The first build takes ~2 minutes; subsequent runs are faster due to hot reload.

---

### Troubleshooting

| Problem | Fix |
|---|---|
| Phone not detected | Re-enable USB Debugging, try a different USB cable |
| Supabase connection refused | Check port forward is set up (Part 2 Step 3), confirm phone and PC are on same WiFi |
| `flutter doctor` shows Android SDK missing | Re-run `flutter config --android-sdk` with correct path |
| WSL2 IP changed after reboot | Re-run the `netsh` port forward command with the new IP (`hostname -I`) |
| Build fails — package not found | Run `flutter pub get` in `src/` |
