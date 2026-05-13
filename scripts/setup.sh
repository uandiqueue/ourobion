#!/bin/bash
# Usage: chmod +x scripts/setup.sh && ./scripts/setup.sh
# Supports: Linux, macOS, Windows (Git Bash / WSL2)

set -e

echo "========================================="
echo "   Biotope Developer Environment Setup   "
echo "========================================="
echo ""

# ─── Detect OS ───────────────────────────────────────────────
OS="unknown"
case "$(uname -s)" in
  Linux*)
    if grep -qi microsoft /proc/version 2>/dev/null; then
      OS="wsl"
    else
      OS="linux"
    fi
    ;;
  Darwin*) OS="mac" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows_bash" ;;
esac

echo "Detected environment: $OS"
echo ""

# ─── Helper: print install hint per tool per OS ──────────────
hint_node() {
  case $OS in
    mac)           echo "   → brew install node   (or: https://nodejs.org/)" ;;
    linux|wsl)     echo "   → sudo apt install nodejs npm   (or use nvm: https://github.com/nvm-sh/nvm)" ;;
    windows_bash)  echo "   → winget install OpenJS.NodeJS   (run in PowerShell, then restart Git Bash)" ;;
    *)             echo "   → https://nodejs.org/" ;;
  esac
}

hint_docker() {
  case $OS in
    mac)           echo "   → brew install --cask docker   (or: https://www.docker.com/products/docker-desktop/)" ;;
    linux)         echo "   → sudo apt install docker.io && sudo usermod -aG docker \$USER" ;;
    wsl)           echo "   → Install Docker Desktop on Windows with WSL2 backend: https://www.docker.com/products/docker-desktop/" ;;
    windows_bash)  echo "   → Install Docker Desktop: https://www.docker.com/products/docker-desktop/" ;;
    *)             echo "   → https://www.docker.com/products/docker-desktop/" ;;
  esac
}

hint_flutter() {
  case $OS in
    mac)           echo "   → brew install --cask flutter   (or: https://docs.flutter.dev/get-started/install/macos)" ;;
    linux|wsl)     echo "   → sudo snap install flutter --classic   (or: https://docs.flutter.dev/get-started/install/linux)" ;;
    windows_bash)  echo "   → Download and extract from https://docs.flutter.dev/get-started/install/windows then add to PATH" ;;
    *)             echo "   → https://docs.flutter.dev/get-started/install" ;;
  esac
}

# ─── Required versions ───────────────────────────────────────
REQUIRED_NODE_MAJOR=18
REQUIRED_FLUTTER_MAJOR=3
REQUIRED_FLUTTER_MINOR=11

# ─── 1. Node.js ──────────────────────────────────────────────
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  hint_node
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "❌ Node.js v${REQUIRED_NODE_MAJOR}+ required. You have $(node -v)."
  hint_node
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ─── 2. Docker ───────────────────────────────────────────────
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Supabase requires Docker."
  hint_docker
  exit 1
fi
if ! docker info &> /dev/null; then
  echo "❌ Docker is installed but not running. Please start Docker Desktop."
  exit 1
fi
echo "✅ Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# ─── 3. Supabase CLI ─────────────────────────────────────────
echo "Checking Supabase CLI..."
if ! npx supabase --version &> /dev/null 2>&1; then
  echo "❌ Supabase CLI not available."
  echo "   → Run: npm install --save-dev supabase"
  exit 1
fi
echo "✅ Supabase CLI $(npx supabase --version 2>/dev/null | head -n1)"

# ─── 4. Flutter ──────────────────────────────────────────────
echo "Checking Flutter..."
if ! command -v flutter &> /dev/null; then
  echo "❌ Flutter is not installed."
  hint_flutter
  if [ "$OS" = "wsl" ]; then
    echo ""
    echo "   💡 WSL2 tip: Flutter for Android works best installed on Windows, not inside WSL2."
    echo "      Install Flutter on Windows and run 'flutter run' from PowerShell."
    echo "      WSL2 is only needed for Supabase (backend)."
  fi
  exit 1
fi
FLUTTER_VERSION=$(flutter --version 2>/dev/null | head -n1 | awk '{print $2}')
FLUTTER_MAJOR=$(echo "$FLUTTER_VERSION" | cut -d'.' -f1)
FLUTTER_MINOR=$(echo "$FLUTTER_VERSION" | cut -d'.' -f2)
if [ "$FLUTTER_MAJOR" -lt "$REQUIRED_FLUTTER_MAJOR" ] || \
   ([ "$FLUTTER_MAJOR" -eq "$REQUIRED_FLUTTER_MAJOR" ] && [ "$FLUTTER_MINOR" -lt "$REQUIRED_FLUTTER_MINOR" ]); then
  echo "❌ Flutter ${REQUIRED_FLUTTER_MAJOR}.${REQUIRED_FLUTTER_MINOR}+ required. You have $FLUTTER_VERSION."
  hint_flutter
  exit 1
fi
echo "✅ Flutter $FLUTTER_VERSION"

# ─── 5. Android SDK (optional check) ─────────────────────────
echo "Checking Android SDK..."
if ! flutter doctor 2>/dev/null | grep -q "Android toolchain.*OK\|Android SDK"; then
  echo "⚠️  Android SDK not fully configured."
  echo "   → Install Android Studio: https://developer.android.com/studio"
  case $OS in
    mac|linux) echo "   → Then run: flutter doctor --android-licenses" ;;
    wsl)       echo "   → Install Android Studio on Windows (not WSL2), then run in PowerShell:"
               echo "     flutter config --android-sdk \"\$env:LOCALAPPDATA\\Android\\Sdk\""
               echo "     flutter doctor --android-licenses" ;;
    windows_bash) echo "   → Then run in PowerShell: flutter config --android-sdk \"\$env:LOCALAPPDATA\\Android\\Sdk\""
                  echo "     flutter doctor --android-licenses" ;;
  esac
  echo "   (Continuing — Android SDK is only needed for device testing)"
else
  echo "✅ Android SDK"
fi

# ─── 6. Environment files ────────────────────────────────────
echo ""
echo "Checking environment files..."

if [ ! -f "src/.env.public" ]; then
  if [ -f "src/.env.public.example" ]; then
    cp src/.env.public.example src/.env.public
    echo "✅ src/.env.public created from template — fill in your local Supabase values."
    echo "   This file is intentionally bundled as public Flutter client config."
  else
    echo "❌ src/.env.public.example not found. Create src/.env.public manually."
  fi
else
  echo "✅ src/.env.public found"
fi

if [ ! -f "supabase/.env" ]; then
  if [ -f "supabase/.env.example" ]; then
    cp supabase/.env.example supabase/.env
    echo "✅ supabase/.env created from template."
  else
    echo "⚠️  supabase/.env.example not found. Skipping."
  fi
else
  echo "✅ supabase/.env found"
fi

# ─── 7. Install dependencies ─────────────────────────────────
echo ""
echo "Installing dependencies..."

if [ -f "shared/package.json" ]; then
  echo "→ Shared TypeScript packages..."
  (cd shared && npm install)
  echo "  ✅ Done"
fi

if [ -f "src/pubspec.yaml" ]; then
  echo "→ Flutter packages..."
  (cd src && flutter pub get)
  echo "  ✅ Done"
fi

# ─── Done ────────────────────────────────────────────────────
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fill in src/.env.public with your local Supabase values (if not done)."
echo "  2. npx supabase start        — start the local Supabase backend"
echo "  3. npx supabase db push      — run database migrations"
echo "  4. cd src && flutter run     — launch the app"
echo ""
if [ "$OS" = "wsl" ]; then
  echo "WSL2 users: run Flutter from Windows PowerShell for Android device testing."
  echo "See README.md → Testing on Android Phone for full setup guide."
  echo ""
fi
