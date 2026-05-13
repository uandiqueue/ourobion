# Biotope Flutter App

This directory contains the Biotope Flutter frontend.

## Local Config

The app loads `src/.env.public` through `flutter_dotenv`. This file is
intentionally bundled as public client config, so it must contain only values
that are safe to expose in the app package:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key
```

Create it from the template if needed:

```bash
cp .env.public.example .env.public
```

Backend/private secrets belong in `../supabase/.env` or Supabase secrets,
never in `src/.env.public`.

## Run

```bash
flutter pub get
flutter run
```
