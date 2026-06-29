# Ourobion — Brand Assets

Logo and colour assets for the Ourobion identity.
See **`DESIGN.md`** for the full design rationale, colour symbolism, and usage rules.

## Contents

```
DESIGN.md                 design principles, colour system + symbolism, usage
README.md                 this file
ourobion-logo.html        interactive reference (both palettes + size crops)
logo/
  svg/                    static, self-contained SVGs (paths only — wordmark is
                          outlined, so NO fonts are needed to render them)
    ourobion-mark-light.svg / -dark.svg
    ourobion-lockup-light.svg / -dark.svg     (mark + wordmark)
  png/                    transparent PNGs — marks @256/512/1024, lockups @1024
favicon/
  favicon.svg             simplified open-ring + nucleus glyph (legible when tiny)
  favicon-16.png · favicon-32.png · apple-touch-icon-180.png
color/
  colors.css              CSS custom properties (light + .ouro-dark)
  colors.json             design tokens (incl. the full 23-step coil ramp)
```

## Light vs dark
Two variants of every logo. Use **light** on white / pale backgrounds and **dark**
on `#0B1D24` or darker. They are not interchangeable — the over/under detailing is
keyed to its background colour.

## Colours
- CSS: `@import "color/colors.css";` then `color: var(--ouro-wordmark);` etc.
- JSON: `color/colors.json` for build pipelines / design tools.

## Typography
The wordmark is **Outfit**, weight 200, lowercase (open-source, via Google Fonts).
It is already outlined in the supplied logo files, so the font is **not** required to
use the logo — install Outfit only if you set "Ourobion" in running text.

## Regenerating
The mark is parametric: a flat 23-segment ring + an 11.5-turn / 23-crossing helix +
a central nucleus. Treat this folder as the source of truth; don't hand-edit the SVG
path data.

## Licence
_Add your own licence / usage terms here._
