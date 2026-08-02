---
title: Build the Ourobion project showcase site as a static single page
summary: Added apps/site — a dependency-free static single-page showcase for www.ourobion.com built from existing brand assets and verified documentation, with a scroll-driven canvas hero, per-product palette blending, and card-assembly animation.
type: session
scope: repo
status: canonical
updated: 2026-08-03
memory: none — this adds a presentation surface; it introduces no durable fact, contract, or constraint that later sessions must respect.
---

# Ourobion project website

Branch: `feat/site/project-website`, cut from `main`. Collaborative local session with the owner.
The site is a third surface: it is neither biotope nor nao, and is intended for `www.ourobion.com`.

## Attempted

- Assess whether a showcase site could be assembled from what already exists, and estimate it before
  building anything.
- Build a single static page from the brand kit and the owner-verified documentation, without
  inventing product claims.
- Add scroll-driven motion that argues the project's thesis rather than decorating it.

## Changed

- Added `apps/site/` — `index.html`, `styles.css`, `app.js`, and copied brand assets. No framework,
  no build step, no runtime dependency; the only external request is the Outfit webfont.
- Sections: hero · problem · the brain · evidence · products · future work · team · footer.
- Copy is taken from owner-verified sources (`docs/project-overview.md`, the Launchpad
  `writeup.txt`) rather than newly written, so the site cannot drift from the documentation.
- Palette is consumed directly from `assets/ourobion-brand/color/colors.css`; light and dark themes
  both supported, persisted to `localStorage`, defaulting to the OS preference. All four logo
  lockups swap variant with the theme.

### Motion

- **Hero ring** — hand-written Canvas 2D, not three.js. The figure is a flat parametric ring, so a
  WebGL scene graph would have added ~600 KB and a build step to draw something 2D already draws.
  It renders the brand's own geometry: 23 segments for the 23 chromosomes, with the loop left open.
- **Scroll opens the loop.** Scrolling widens the withheld arc from 2 segments to ~9 rather than
  merely spinning the ring — the mark's meaning is that the loop of understanding never closes, so
  the motion states the idea instead of ornamenting it.
- **Card assembly** — each product card enters as its mark alone, enlarged and centred; scrolling
  shrinks the mark back to its corner while surface, border and body materialise around it. Travel
  distance and scale are measured per card from real geometry, and re-measured on resize and after
  `document.fonts.ready`. The settled height is frozen so nothing reflows mid-animation.
- **Product palette blend** — colours were sampled from the marks themselves (biotope `#E2C488` /
  `#8C6C34`; nao `#2BC4BE` / `#7C86F2`) and crossfade with the site palette via `color-mix` driven by
  a registered `@property` number, so each card adopts its own identity as it centres.
- Staggered chain reveal, counting statistics, and a reading-progress rail.

## Decided

- **Statistics are labelled a dated snapshot.** The page is static and reads no database, so the
  corpus and serving counts carry "Measured 2 August 2026" and an explicit statement that current
  figures require re-running the pipeline. This follows the same discipline as the test-count caveat
  in `docs/engineering-practice.md`.
- **No screenshots.** The owner confirmed none will be supplied, so the product cards carry
  capability lines instead of placeholder frames.
- The closing section is framed as **future work and goal**, not as a limitations confession.
- Numbers deliberately exclude the submission's older verdict spread (1 supported / 10 partial /
  2 uncertain / 1 unsupported), which a later pipeline run superseded.

## Not done

- **Not deployed.** No Cloudflare route, DNS change, or `wrangler` config was added — the domain
  belongs to the owner's account and the deployment step is theirs to run.
- The demo APK link is duplicated in three places (this site, root `README.md`,
  `apps/biotope/README.md`) and all three need updating when the new build lands. The site's copy is
  marked with a `data-apk` attribute and an HTML comment so it is greppable.
- The Outfit webfont loads from Google Fonts rather than being self-hosted.

## Verification

- Served locally on `127.0.0.1:4321`; `index.html`, both stylesheets, `app.js` and every referenced
  logo and favicon return HTTP 200.
- `node --check app.js` passes.
- `prefers-reduced-motion` honoured throughout: no counters, parallax, progress rail, or animation
  loop; the ring still reflects scroll position as a static redraw, and reveal elements render at
  full opacity so nothing is hidden when JavaScript is unavailable.
