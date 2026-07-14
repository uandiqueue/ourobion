# Rejected Assets

Record every clearly unsuitable generation here. Include asset ID, attempt,
what went wrong, how it drifted from the UI seed, and how the next prompt
should change.

Rejected attempts are retained below even when a later attempt for the same
asset is accepted.

## empty_scan_bloom - attempt 1

- What went wrong: the large near-circular ivory porcelain scan ring dominated
  the orchid and read as a badge, emblem, or logo-like target.
- Drift from the UI seed: the composition became icon-like and mechanically
  framed instead of quiet, airy, and botanical-first.
- Attempt 2 improvement: reduce the scan cue to a thin partial crescent behind
  the lower stem, keep it below 15 percent of the subject area, and explicitly
  prohibit full rings, near-complete circles, targets, badges, and emblems.

## Needs Regeneration, Not Rejected

### home_flower_cluster_card - attempt 1

- What went wrong: generated as a 24-bit RGB PNG with a porcelain-white
  rectangular background and no alpha.
- Drift from updated rules: the visual style matches the seed, but the asset is
  now classified as `transparent` and must be an isolated overlay.
- Next prompt improvement: explicitly require transparent background, clean alpha
  silhouette, no rectangular white box, and suitability as a Flutter overlay on
  white or ivory cards.
