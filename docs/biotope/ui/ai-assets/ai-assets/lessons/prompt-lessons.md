# Prompt Lessons

## Preserves The Seed Vibe

- Ask for a "porcelain-white studio background" and "soft high-key lighting".
- Pair biomechanical details with "restrained champagne brass" to avoid heavy
  industrial machinery.
- Use "generous negative space" for Flutter-friendly composition.
- Repeat "no text, no logo, no watermark" in every prompt.

## Known Drift Risks

- "Cybernetic" can drift too dark or sci-fi if not balanced with porcelain,
  botanical, and high-key language.
- "Intricate machinery" can clutter small mobile UI assets.
- "Botanical realism" without biomechanical wording can produce ordinary flower
  photography.
- "Robot hand" can dominate the composition unless framed as one motif.

## Batch 1 Lessons

- "Ivory ceramic android hand with small champagne-brass joints" produced a
  seed-faithful robot-hand material without horror drift.
- Asking for the hand to be "secondary and partly occluded by flowers" kept the
  alternate Home asset from becoming too hand-dominant.
- "No neon HUD" and "faint circular depth only" helped Scan assets stay premium
  rather than cyberpunk.
- "Square-friendly composition" produced usable card negative space.

## Background Mode Lessons

- Every prompt must explicitly state `Background mode: transparent` or
  `Background mode: porcelain_white`.
- Transparent assets need "isolated object", "transparent background", "clean
  alpha silhouette", and "no rectangular white box" wording.
- Porcelain-white assets should say "clean porcelain-white / warm ivory high-key
  studio background" and "no transparent cutout required".
- A visually strong porcelain-white card image is still not acceptable for a
  transparent overlay role.

## Botanical Realism Lessons

- Avoid wording that implies "one bloom on one stem" for Scan assets.
- For orchids, prefer "clustered orchid spray", "branching stems", "buds",
  "aerial roots", "vine-like supports", and "natural asymmetry".
- Keep "porcelain-white" attached to mechanical parts or background, not to all
  petals.
- Allow soft coordinated flower color where it improves realism: blush, pale
  yellow, soft peach, muted pink, and gentle orchid-lilac.
- Attempt 2 Scan prompts worked better after asking for "clustered orchid
  spray", "aerial roots", "buds", and "natural asymmetry".
- For transparent chroma-key assets, full-size edge preview on white is required
  before accepting; alpha metadata alone is not enough.

## Insights And Archive Lessons

- "Heart-like organic cluster" produced a useful emotional Insights motif
  without becoming anatomical.
- "Living relationship system" and "not a circuit board" kept branching Insights
  imagery botanical instead of neon network-like.
- Archive prompts work better with "curated", "preserved", and "herbarium-like"
  than with older paper or decay language.
- Explicitly banning fake document text avoided unusable report thumbnails.

## Transparent Profile And Decorative Lessons

- Blue chroma key is easier to clean than magenta for pale white and blush
  flowers. Magenta left visible petal/bud edging on `profile_signature_flower`
  attempt 1.
- For transparent assets, ask for "perfectly flat solid pure blue chroma key"
  and then still inspect a white preview. Some generations produce slight tonal
  variation even when asked for a flat key.
- If a new profile motif duplicates a prior composition, tighten the prompt with
  species, asymmetry, flower count, and "no baby-breath clusters" rather than
  accepting a near-duplicate.
- Corner decorations work well when prompted as "L-shaped corner flourish",
  "airy negative space", and "not a central bouquet".
- Continue batch 2026-07-11: a flat pure-blue `#0000FF` key worked reliably
  when every prompt required the key to reach all canvas edges and corners,
  banned floor planes and lighting variation, and prohibited blue in the
  subject.
- Validate extracted assets with all four corner alpha values, transparent /
  partial / opaque pixel counts, visible-subject bounds, and a white or ivory
  contact sheet at intended UI scale. A visual preview by itself is not enough.
- The bundled chroma helper may be unavailable when Pillow is absent. A local
  blue-dominance matte with despill can still produce clean alpha from a flat
  key, but only accept it after verifying a 32-bit PNG, transparent corners,
  and zero residual blue-fringe pixels.

## Empty-State Lessons

- Empty-state assets work best with one quiet subject, an airy silhouette, and
  substantially less mechanical density than hero or decorative artwork.
- A scan cue can become a badge or logo-like target even when technically open.
  Keep any porcelain arc short, thin, secondary, and visually behind the living
  botanical form.
- Review empty-state cutouts at their intended reduced scale on ivory. Fine
  mechanical details should remain discoverable without becoming the first
  read.
