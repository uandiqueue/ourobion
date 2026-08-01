# Ourobion Nao — Brand Assets

Logo and colour assets for **Ourobion Nao**. See **`DESIGN.md`** for the concept, the knowledge-graph rationale, and the colour system.

## Contents

```
DESIGN.md                design notes + colour system
README.md                this file
logo/
  svg/                   static, self-contained SVGs (paths only — wordmark
                         outlined, so NO fonts needed to render)
    nao-mark-dark.svg / -light.svg
    nao-lockup-dark.svg / -light.svg      (ourobion / nao wordmark)
  png/                   transparent PNGs — marks @256/512/1024, lockups @1024
favicon/
  favicon.svg            simplified hub-and-nodes glyph (legible when tiny)
  favicon-16.png · favicon-32.png · apple-touch-icon-180.png
color/
  colors.css             CSS custom properties (dark primary + .nao-light)
  colors.json            design tokens (incl. the full 23-step coil ramp)
```

## Dark vs light
**Dark is primary** (Nao is a technical / infrastructure product). Use **dark** on
`#0B1D24` or darker, and **light** on white / pale backgrounds. The two are not
interchangeable — the over/under detailing is keyed to its background.

## Colours
- CSS: `@import "color/colors.css";` then `var(--nao-node)` etc. Root defaults to
  the dark palette; add class `nao-light` (or `[data-theme="light"]`) for light.
- JSON: `color/colors.json` for build pipelines.

## Typography
Wordmark is **Outfit** (open-source, Google Fonts) — already outlined in the logo
files, so the font is only needed if you set "Nao" in running text.

## Licence
_Add your own licence / usage terms here._
