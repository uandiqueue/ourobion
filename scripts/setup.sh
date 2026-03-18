#!/bin/bash

# run the below in CLI to run this script
# chmod +x scripts/setup.sh && ./scripts/setup.sh

set -e

echo "========================================="
echo "🔬 Biotope Developer Environment Setup 🔬"
echo "========================================="
echo ""

# ─── Required versions ────────────────────────────────────────────
REQUIRED_NODE_MAJOR=18
REQUIRED_FLUTTER_MAJOR=3
REQUIRED_FLUTTER_MINOR=11

# ─── 1. Check Node.js + version ───────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "   👉 Install Node.js v${REQUIRED_NODE_MAJOR}+: https://nodejs.org/"
    echo "   💡 Tip: use nvm (https://github.com/nvm-sh/nvm) and run 'nvm use' in this project."
    exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
    echo "❌ Node.js v${REQUIRED_NODE_MAJOR}+ is required. You have $(node -v)."
    echo "   👉 Update at: https://nodejs.org/ or run 'nvm install ${REQUIRED_NODE_MAJOR}'"
    exit 1
fi
echo "✅ Node.js $(node -v) — OK"

# ─── 2. Check Docker ──────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "   👉 Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo "   Supabase requires Docker to run the local database."
    exit 1
fi
echo "✅ Docker $(docker --version | awk '{print $3}' | tr -d ',') — OK"

# ─── 3. Check Supabase CLI ────────────────────────────────────────
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "   👉 Install it: https://supabase.com/docs/guides/cli"
    echo "   macOS:    brew install supabase/tap/supabase"
    echo "   npm:      npm install -g supabase"
    exit 1
fi
echo "✅ Supabase CLI $(supabase --version) — OK"

# ─── 4. Check Flutter + version ───────────────────────────────────
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed."
    echo "   👉 Install Flutter: https://docs.flutter.dev/get-started/install"
    exit 1
fi

FLUTTER_VERSION=$(flutter --version 2>/dev/null | head -n 1 | awk '{print $2}')
FLUTTER_MAJOR=$(echo "$FLUTTER_VERSION" | cut -d'.' -f1)
FLUTTER_MINOR=$(echo "$FLUTTER_VERSION" | cut -d'.' -f2)

if [ "$FLUTTER_MAJOR" -lt "$REQUIRED_FLUTTER_MAJOR" ] || \
   ([ "$FLUTTER_MAJOR" -eq "$REQUIRED_FLUTTER_MAJOR" ] && [ "$FLUTTER_MINOR" -lt "$REQUIRED_FLUTTER_MINOR" ]); then
    echo "❌ Flutter ${REQUIRED_FLUTTER_MAJOR}.${REQUIRED_FLUTTER_MINOR}+ is required. You have $FLUTTER_VERSION."
    echo "   👉 Update Flutter: https://docs.flutter.dev/release/upgrade"
    exit 1
fi
echo "✅ Flutter $FLUTTER_VERSION — OK"

# ─── 5. Check .env files (Frontend & Backend) ─────────────────────
echo ""
echo "🔧 Checking environment variables..."

# Frontend (.env)
if [ ! -f "src/.env" ]; then
    echo "⚠️  src/.env not found. Creating from src/.env.example..."
    if [ -f "src/.env.example" ]; then
        cp src/.env.example src/.env
        echo "   ✅ src/.env created. Open it and fill in your Supabase credentials."
    else
        echo "   ❌ src/.env.example not found. Please create src/.env manually."
    fi
else
    echo "✅ src/.env found — OK"
fi

# Backend (.env)
if [ ! -f "supabase/.env" ]; then
    echo "⚠️  supabase/.env not found. Creating from supabase/.env.example..."
    if [ -f "supabase/.env.example" ]; then
        cp supabase/.env.example supabase/.env
        echo "   ✅ supabase/.env created."
    else
        echo "   ❌ supabase/.env.example not found. Please create supabase/.env manually."
    fi
else
    echo "✅ supabase/.env found — OK"
fi

# ─── 6. Install dependencies ──────────────────────────────────────
echo ""
echo "📦 Installing project dependencies..."

# Shared TypeScript packages
if [ -f "shared/package.json" ]; then
    echo "-> Installing shared TypeScript packages..."
    cd shared && npm install && cd ..
    echo "   ✅ Shared packages installed."
else
    echo "-> ⚠️  No shared/package.json found. Skipping."
fi

# Flutter packages
if [ -f "src/pubspec.yaml" ]; then
    echo "-> Installing Flutter/Dart packages..."
    cd src && flutter pub get && cd ..
    echo "   ✅ Flutter packages installed."
else
    echo "-> ⚠️  src/pubspec.yaml not found. Skipping flutter pub get."
fi

# ─── Done ─────────────────────────────────────────────────────────
echo ""
echo "🎉 Setup complete! You're ready to develop."
echo ""
echo "Next steps:"
echo "  1. Fill in src/.env with your Supabase credentials (if not done)."
echo "  2. Run 'supabase start'        — to start the local Supabase backend."
echo "  3. Run 'cd src && flutter run' — to launch the mobile app."
