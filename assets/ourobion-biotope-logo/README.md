# Ourobion Biotope — Brand Assets

Logo and colour assets for **Ourobion Biotope**. See **`DESIGN.md`** for the concept, the bloom rationale, and the colour system.

## Contents

```
DESIGN.md                design notes + colour system
README.md                this file
logo/
  svg/                   static, self-contained SVGs (paths only — wordmark
                         outlined, so NO fonts needed to render)
    biotope-mark-light.svg / -dark.svg
    biotope-lockup-light.svg / -dark.svg     (ourobion / biotope wordmark)
  png/                   transparent PNGs — marks @256/512/1024, lockups @1024
favicon/
  favicon.svg            simplified solid-petal bloom (legible when tiny)
  favicon-16.png · favicon-32.png · apple-touch-icon-180.png
color/
  colors.css             CSS custom properties (light + .biotope-dark)
  colors.json            design tokens (incl. the full 23-step petal ramp)
```

## Light vs dark
Use **light** (gold on white — the primary look) on white / pale backgrounds, and
**dark** (brightened gold) on `#17130D` or darker. The two are not interchangeable.

## Colours
- CSS: `@import "color/colors.css";` then `var(--biotope-glyph)` etc.
- JSON: `color/colors.json` for build pipelines.

## Typography
Wordmark is **Outfit** (open-source, Google Fonts) — already outlined in the logo
files, so the font is only needed if you set "Biotope" in running text.

## Licence
_Add your own licence / usage terms here._
