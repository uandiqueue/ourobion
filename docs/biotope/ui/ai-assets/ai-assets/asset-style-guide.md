# Biotope AI Asset Style Guide

## Master Style Block

Premium hyperrealistic biomechanical botanical image for a mobile health app.
Clean porcelain-white or ivory studio background, soft high-key lighting,
generous negative space, ivory ceramic android or biomechanical surfaces,
subtle champagne-gold or brass mechanical details, realistic flowers, fine
stems, pale green leaves, refined botanical-luxury mood, calm and futuristic.
The porcelain-white requirement applies to mechanical and ceramic parts, not to
every flower. Flowers may use harmonious natural color when it improves realism
and UI fit. No text, no watermark, no logo.

## Negative Style Block

Avoid dark cyberpunk, neon sci-fi, horror biomechanics, gore, flesh, dense
jungle backgrounds, cluttered machinery, anime, cartoon, low-poly rendering,
random symbols, watermarks, in-image text, and any Biotope logo recreation.

## Background and Transparency Rules

- Transparent assets are for decorative overlays, isolated card motifs,
  empty-state objects, and reusable UI elements.
- Transparent assets should have clean silhouettes and no rectangular white
  background.
- Transparent assets may keep very soft natural object shadows only if they work
  on white or ivory Flutter cards.
- Porcelain-white assets are for hero artwork, banners, scan visuals, insight
  headers, and archive/report covers.
- Porcelain-white assets should preserve the clean high-key white / warm ivory
  atmosphere of the UI seed.
- Do not use dark, neon, gradient-heavy, or busy backgrounds.
- If an asset is meant to be transparent but was generated with a visible white
  box, do not mark it as accepted.
- If a transparent-background asset cannot be generated with alpha in the
  current environment, mark it as `needs_regeneration` and record the
  limitation.

## Accepted Material Language

- Ivory ceramic shells with soft specular highlights.
- Champagne-gold or aged brass hinges, rings, sensor nodes, and tiny linkages.
- Thin translucent porcelain or frosted glass panels only when subtle.
- Fine mechanical details should support the botanical form, not dominate it.

## Accepted Botanical Direction

- White, ivory, faint blush, pale yellow, soft peach, muted pink, and gentle
  orchid-lilac flowers are acceptable when balanced with the porcelain app
  atmosphere.
- Keep mechanical parts ivory porcelain, ceramic white, champagne brass, or
  muted gold. Do not recolor mechanical parts to bright flower colors.
- Orchids should read as real orchid sprays or clustered growth: multiple
  blooms, buds, branching stems, aerial roots, vine-like supports, or natural
  asymmetry. Avoid a lone artificial single bloom on one straight stem.
- Other accepted flowers include camellias, jasmine clusters, dendrobium or
  phalaenopsis orchid sprays, gardenias, anemones, peonies, preserved herbarium
  fragments, seed pods, and small filler blossoms.
- Pale green leaves and thin stems should have realistic scale, texture,
  branching, and irregularity.
- Botanical elements should feel alive and precise, not jungle-like or plastic.

## Accepted Robot-Hand Direction

- Use mainly for Home and onboarding-like hero moments.
- Ivory ceramic android hand with brass joints.
- Elegant open gesture, touching or protecting flowers.
- Do not make the hand aggressive, skeletal, dark, or dominant in every asset.

## Tab-Specific Motif Mapping

- Home: robot hand, bloom clusters, calm system-health hero imagery.
- Scan: clustered orchid sprays, circular bloom clusters, sensor flowers,
  branching stems, buds, aerial roots, and vine-like supports inside a scan
  composition.
- Insights: neural botanical clusters, heart-like bloom, branching node systems;
  allow soft peach, blush, or pale yellow accents for warmth.
- Archive: herbarium specimens, preserved fragments, report thumbnails; muted
  botanical color is acceptable but should feel archival.
- Profile: signature flower, porcelain camellia, botanical crest; allow soft
  personal accent colors while keeping mechanical parts porcelain/brass.
- Decorative: vine corners, small flower clusters, brass leaf nodes; transparent
  overlays may use white, blush, pale yellow, or soft orchid hues.
- Empty states: quiet seed pods or simple blooms with ample white space; color
  should stay gentle and low-saturation.

## Good Prompt Phrasing

- "porcelain-white studio background with soft high-key lighting"
- "ivory ceramic biomechanical surfaces with restrained champagne brass details"
- "realistic clustered botanical stems, buds, leaves, and harmonious flower color"
- "porcelain-white mechanical parts with natural flowers in soft coordinated tones"
- "premium biotech botanical-luxury mood, calm and refined"
- "no text, no logo, no watermark"

## Phrasing To Avoid

- "cybernetic jungle"
- "neon biomechanical"
- "dark futuristic lab"
- "organic flesh machinery"
- "maximal intricate mechanical details"
- "logo-like emblem"
- "single straight orchid stem"
- "one isolated orchid bloom like a lab specimen"

## Comparing Against The UI Seed

Compare each candidate to `references/biomech-botanical-ui-seed.png` for:

- porcelain-white / high-key lighting consistency
- correct `background_mode`
- biomechanical material consistency
- botanical realism
- visual density and negative space
- absence of cyberpunk, horror, gore, or clutter
- fit for the intended tab
- practical use inside Flutter cards, heroes, empty states, or decorative layers
