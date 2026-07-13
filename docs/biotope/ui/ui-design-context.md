---
title: biotope UI — Design Context
summary: The source-of-truth visual system for biotope's Flutter app (M3 color tokens, Manrope typography, radii, component specs, living backdrop, motion, layout); agents read this before implementing any UI screen. nao's dark expert sibling system is described in nao-app-design §7.
type: context
scope: biotope
status: canonical
updated: 2026-07-13
---
# ui-design-context.md — Ourobion
> **REFERENCE LAYER** — Read before implementing any UI screen.
> Last updated: Phase 1 Stage 1 (MVP) — sourced from Claude Design bundle (Onboarding Flow)

---

## Design Identity

Ourobion blends **health (body)**, **science (precision)**, and **fun (play/social)**.
The visual language reflects a living ecosystem: organic, warm, precise, never clinical.
Key metaphors: petri dish, biome, growing organism.

---

## Color Tokens (M3 — Full Set)

These are the source-of-truth values. Use these in `ThemeData` and all custom widgets.

```dart
// Primary — Forest green (ecosystem, health, growth)
primary:                #3c6752
onPrimary:              #ffffff
primaryContainer:       #7daa92
onPrimaryContainer:     #123f2c
primaryFixed:           #beedd3
primaryFixedDim:        #a2d1b7
onPrimaryFixed:         #002114

// Secondary — Deep cyan (science, data, precision)
secondary:              #2f647d
onSecondary:            #ffffff
secondaryContainer:     #ade1fd
secondaryFixedDim:      #9acee9
onSecondaryFixed:       #001e2b
onSecondaryFixedVariant:#0f4c64
onSecondaryContainer:   #30657d

// Tertiary — Teal (game, energy, playfulness)
tertiary:               #00696b
tertiaryContainer:      #5aadaf
tertiaryFixedDim:       #81d4d6
onTertiaryFixed:        #002021

// Surface
background:             #f9f9f8
surface:                #f9f9f8
surfaceContainerLowest: #ffffff
surfaceContainerLow:    #f3f4f3
surfaceContainer:       #edeeed
surfaceContainerHigh:   #e7e8e7
surfaceDim:             #d9dad9

// On-surface
onSurface:              #191c1c
onSurfaceVariant:       #414943

// Outline
outline:                #717973
outlineVariant:         #c1c8c2
```

**Flutter ThemeData setup:**
```dart
ThemeData(
  colorScheme: const ColorScheme(
    brightness: Brightness.light,
    primary: Color(0xFF3c6752),
    onPrimary: Color(0xFFffffff),
    primaryContainer: Color(0xFF7daa92),
    onPrimaryContainer: Color(0xFF123f2c),
    secondary: Color(0xFF2f647d),
    onSecondary: Color(0xFFffffff),
    secondaryContainer: Color(0xFFade1fd),
    onSecondaryContainer: Color(0xFF30657d),
    tertiary: Color(0xFF00696b),
    onTertiary: Color(0xFFffffff),
    tertiaryContainer: Color(0xFF5aadaf),
    onTertiaryContainer: Color(0xFF002021),
    surface: Color(0xFFf9f9f8),
    onSurface: Color(0xFF191c1c),
    onSurfaceVariant: Color(0xFF414943),
    outline: Color(0xFF717973),
    outlineVariant: Color(0xFFc1c8c2),
  ),
  useMaterial3: true,
)
```

---

## Typography

**Font family:** `Manrope` (Google Fonts) — used everywhere, no exceptions.

| Role | Size | Weight | Letter Spacing | Usage |
|---|---|---|---|---|
| Headline | 28px | 600 | -0.4 | Screen titles, question text |
| Title | 20px | 600 | -0.2 | Card headers, section titles |
| Eyebrow | 10px | 700 | +1.6 | Labels above headings (UPPERCASE) |
| Body | 14–16px | 400–500 | 0 | Descriptions, helper text |
| Label | 10–12px | 600–700 | +1.4 | Metadata, dates, counters (UPPERCASE) |
| Button | 14px | 600 | +0.3 | CTA and secondary buttons |
| Chip | 11–13px | 600 | 0 | Tags, filter chips, answer chips |

**Eyebrow pattern:** always uppercase, primary color `#3c6752`, 10px/700, letterSpacing 1.6.
Used as a label above every main question or section heading.

---

## Shape / Border Radius

| Component | Radius |
|---|---|
| Large cards, modals | 20–24px |
| Buttons (primary CTA) | 16px |
| Input fields | 16px |
| Small cards | 14px |
| Chips / pills | 999px (fully rounded) |
| Toggle knob | 11px (22px diameter) |
| Toggle track | 14px (26px height) |
| Tab bar item indicator | 6px |

---

## Component Specs

### Primary CTA Button
- Height: 56px, full width, radius 16px
- Background: `primary` (#3c6752), text: `onPrimary` (#fff)
- Font: 14px / 600 / letterSpacing 0.3
- Shadow: `0 4px 12px rgba(60,103,82,0.25)`
- Disabled: background `surfaceContainer`, text `outline`
- Press state: scale(0.98) transform

### Input Field (TextField)
- Padding: 18px 20px, radius 16px
- Border: 1.5px `outlineVariant` at rest → `primary` when filled
- Focus glow ring: `0 0 0 4px #beedd355` (primaryFixed at 33% opacity)
- Font: 18px / 500, color `onSurface`
- Background: `surfaceLowest` (#fff)
- Auto-focus on screen enter

### Chips (filter / answer)
- Padding: 12px 18px, radius 999px
- Active: border `primary`, bg `primaryFixed`, text `onPrimaryContainer`
- Inactive: border `outlineVariant`, bg `surfaceLowest`, text `onSurface`
- Multi-select: shows ✓ prefix when active

### Toggle Row (consent / settings)
- Full row tappable, bg `surfaceLowest`, border `outlineVariant`, radius 14px
- Custom toggle: 44×26px track, 22×22px knob, white knob slides 18px
- Active track: `primary`, inactive: `outlineVariant`
- Label: 14px / 600, sub-label: 12px / 400 `onSurfaceVariant`

### Segmented Control
- Container: `surfaceLow` bg, `outlineVariant` border, radius 14px, 4px padding
- Active segment: `surfaceLowest` bg, `onSurface` text, `0 1px 3px rgba(0,0,0,0.08)` shadow
- Inactive: transparent bg, `onSurfaceVariant` text
- Segment radius: 10px

### Cards
- Background: `surfaceLowest` (#fff)
- Border: `1px solid outlineVariant`
- Shadow: `0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(60,103,82,0.18)`
- Radius: 20–24px

---

## Living Backdrop

Used on auth, onboarding, and any full-screen hero moment.
Four blurred orbs drift slowly — calming, never distracting.

| Orb | Size | Position | Color | Duration |
|---|---|---|---|---|
| 1 | 480px | top-left | `primaryFixedDim` (#a2d1b7) | 28s |
| 2 | 360px | mid-right | `secondaryFixedDim` (#9acee9) | 34s |
| 3 | 300px | bottom-left | `tertiaryFixedDim` (#81d4d6) | 30s |
| 4 | 220px | upper-right | `primaryFixed` (#beedd3) | 26s |

Properties: `opacity: 0.55`, `blur: 60px`, `borderRadius: 50%`
Flutter: use `AnimationController` + `AnimatedBuilder` with `Transform.translate` + `BackdropFilter` or `ImageFiltered`.

---

## Motion & Animation

| Event | Animation |
|---|---|
| Screen/step enter | `translateY(16px) → 0` + `opacity 0→1`, 480ms, `cubic-bezier(0.2,0,0,1)` |
| Persona reveal | `scale(0.96)→1` + `opacity 0→1`, 800ms |
| Home enter | `translateY(20px)→0` + `opacity 0→1`, 600ms |
| Persona breathe | `scale(1)↔scale(1.04)`, 5s ease-in-out loop |
| Auto-advance delay | 240ms after selection on segmented/yesno inputs |
| Button press | `scale(0.98)` on press down |

---

## Navigation & Layout

**Tab bar (5 tabs):** Home · Log · Insights · Squad · World
- Position: fixed bottom, `surfaceEE` bg + `blur(20px)`, `outlineVariant` top border
- Active tab: primary colored icon + bold label
- Safe area padding: 28px bottom (iOS home indicator)

**Screen padding:** 24px horizontal, 12–16px vertical between sections

**Onboarding flow pattern:**
- One question per screen (not a long scroll form)
- Segmented/YesNo auto-advances after selection
- Past answers collapse to editable chips above CTA
- Skippable steps have "Skip for now" link above CTA
- Step counter: `01/07` format (right-aligned, `onSurfaceVariant`)
- Back button: invisible (opacity 0) at step 0

---

## Where Files Live

| Screen | Flutter module path |
|---|---|
| Auth / Sign-in / Onboarding | `apps/biotope/lib/modules/m1_core/ui/` |
| Daily Log / Gut / Behaviour | `apps/biotope/lib/modules/m2_self_report/ui/` |
| Passive Health / Wearables | `apps/biotope/lib/modules/m3_passive_health/ui/` |
| Environment / Outbreak | `apps/biotope/lib/modules/m4_environmental/ui/` |
| Insights / Discovery Cards | `apps/biotope/lib/modules/m5b_insight_engine/ui/` |
| Streaks / Rewards | `apps/biotope/lib/modules/m6_engagement/ui/` |

---

## Rules

1. **Never import from `ui/` in Flutter code.** Reference only.
2. **Manrope everywhere.** No system fonts in user-facing UI.
3. **Living Backdrop on all full-screen moments** (auth, onboarding, persona reveal).
4. **Eyebrow labels above every heading** — uppercase, primary color, 10px/700.
5. **No long scrolling forms** — break multi-field flows into one-question-per-screen.
6. **Tokens are source of truth** — never hardcode a color not in the token set above.

---

## Files in This Folder

| File | Screen | Module |
|---|---|---|
| `auth-screen.html` | Sign In / Sign Up | M1 Core |
