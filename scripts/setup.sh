# run the below in CLI to run this script
# ./scripts/setup.sh

#!/bin/bash

# Exit on any error
set -e

echo "========================================="
echo "🔬 Biotope Developer Environment Setup 🔬"
echo "========================================="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "👉 Please install Node.js (v18+ recommended): https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js is installed ($(node -v))."
fi

# 2. Check Docker (Required for Supabase local dev)
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "👉 Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo "   Supabase requires Docker to run the local database."
    exit 1
else
    echo "✅ Docker is installed."
fi

# 3. Check/Install Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found."
    echo "👉 Please install Supabase CLI: https://supabase.com/docs/guides/cli"
else
    echo "✅ Supabase CLI is installed."
fi

# 4. Check Flutter
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed."
    echo "👉 Please install Flutter: https://docs.flutter.dev/get-started/install"
    echo "   If you are on Linux (Ubuntu), you can often install it via: sudo snap install flutter --classic"
    exit 1
else
    echo "✅ Flutter is installed ($(flutter --version | head -n 1 | awk '{print $2}'))."
fi

echo ""
echo "📦 Installing Project Dependencies..."

# Install Shared Node Dependencies
if [ -d "shared" ]; then
    echo "-> Installing shared TypeScript packages..."
    cd shared
    npm install
    cd ..
fi

# Install Flutter Dependencies
if [ -f "src/pubspec.yaml" ]; then
    echo "-> Installing Flutter Dart packages..."
    cd src
    flutter pub get
    cd ..
else
    echo "-> ⚠️ Flutter project not yet initialized in src/. Skipping flutter pub get."
fi

echo ""
echo "🎉 Setup Complete! You are ready to start developing."
echo "Next steps:"
echo "1. Run 'npx supabase start' to spin up the local backend."
echo "2. Run 'cd src && flutter run' to start the mobile app."
