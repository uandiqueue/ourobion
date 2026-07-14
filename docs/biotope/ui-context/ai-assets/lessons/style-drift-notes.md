# Style Drift Notes

- Keep backgrounds white or ivory, not grey, black, or colored sci-fi sets.
- Brass details should be small and precise, not steampunk-heavy.
- Flowers should be realistic and delicate, not illustrated or plastic.
- Mechanical forms should feel ceramic and premium, not skeletal or threatening.
- Batch 1 accepted assets occasionally increased mechanical density at the base
  or ring. Keep future prompts using "restrained", "delicate", and "not
  cluttered" to preserve the UI seed's airy density.
- Background audit 2026-07-07: `home_flower_cluster_card` was visually
  seed-faithful but wrong for its updated `transparent` background mode. It was
  a 24-bit RGB PNG with a porcelain-white rectangular background, so it was moved
  from `accepted` to `needs_regeneration` and removed from final Flutter assets.
- Botanical realism audit 2026-07-07: `scan_biomech_orchid` and
  `scan_circular_bloom` were downgraded from `accepted` to
  `needs_regeneration`. They were clean and on-material, but too
  single-stem/specimen-like. Future Scan prompts should ask for clustered orchid
  sprays, branching stems, buds, vines or aerial roots, and natural asymmetry.
- The white/porcelain constraint should apply to mechanical parts and
  backgrounds, not all flowers. Flowers can use harmonious natural colors when
  they improve realism and tab identity.
- Continue batch 2026-07-07: regenerated `scan_biomech_orchid` and
  `scan_circular_bloom` with clustered flowers and accepted both. The broader
  flower palette improves realism while keeping porcelain-white mechanical parts
  consistent.
- `home_flower_cluster_card` attempt 2 passed alpha validation, but a slight
  pink chroma-key edge remains at full resolution. Future transparent prompts
  should ask for a little more subject padding and harder separation from the
  key color.
- Continue batch 2026-07-07: Insights and Archive assets accepted with broader
  harmonious flower color. The archive set stayed premium when kept on a
  porcelain-white surface and explicitly steered away from sepia, decay, and fake
  report text.
- Continue batch 2026-07-07 third set: accepted four transparent profile and
  decorative assets; `profile_signature_flower` remains
  `needs_regeneration`. Chroma-key extraction works for Flutter alpha assets,
  but pale petals can retain faint blue or magenta edging at full resolution.
  Continue using white-preview inspection plus corner-alpha validation before
  acceptance.
- `profile_signature_flower` attempt 2 showed why a white preview alone is not
  enough: the image still had an opaque white background/corner and was removed
  from final Flutter assets.
- `profile_porcelain_camellia` attempt 1 was rejected as a near-duplicate of
  `profile_signature_flower`; visual variety matters across profile assets, not
  just technical alpha correctness.
- `deco_vine_corner_left` and `deco_vine_corner_right` are strong corner
  anchors. Use at card-corner scale so their porcelain joints do not dominate
  the UI.
- Continue batch 2026-07-11: the five profile/decorative assets remained
  seed-faithful on ivory-card review and all passed technical alpha validation.
  `deco_small_biomech_bloom` has a denser porcelain calyx than the other motifs;
  keep it at micro-accent scale so the warm-white flower remains the first read.
- Final empty-state batch 2026-07-11: all four accepted assets stayed quiet,
  sparse, and botanical-first. `empty_scan_bloom` attempt 1 demonstrated that a
  large open ring can still read as a badge; attempt 2 corrected the drift by
  shrinking the scan cue and moving it behind the flower stem.
