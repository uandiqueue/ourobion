# Current Batch

Batch 1 asset IDs:

- `home_hero_robot_hand_main` - accepted, 1 attempt
- `home_hero_robot_hand_alt_01` - accepted, 1 attempt
- `home_flower_cluster_card` - accepted, 2 total attempts; attempt 2 has verified
  alpha and no rectangular white box
- `scan_biomech_orchid` - accepted, 2 total attempts; attempt 2 uses clustered
  orchid spray, buds, leaves, and aerial roots
- `scan_circular_bloom` - accepted, 2 total attempts; attempt 2 uses a clustered
  circular floral composition

Continue session 2026-07-07 additional asset IDs:

- `scan_sensor_flower_closeup` - accepted, 1 attempt
- `insights_neural_botanical_cluster` - accepted, 1 attempt

Limit: at most two attempts per asset ID in this session.

Checkpoint: Continue batch processed five asset IDs and stopped. Wait for the
user to explicitly say `continue`; next unstarted asset is
`insights_biomech_heart_bloom`.

Continue session 2026-07-07 second set:

- `insights_biomech_heart_bloom` - accepted, 1 attempt
- `insights_branching_node_system` - accepted, 1 attempt
- `archive_herbarium_specimen` - accepted, 1 attempt
- `archive_preserved_flower_fragment` - accepted, 1 attempt
- `archive_report_thumbnail_base` - accepted, 1 attempt

Checkpoint: processed five asset IDs and stopped. Wait for the user to
explicitly say `continue`; next unstarted asset is `profile_signature_flower`.

Continue session 2026-07-07 third set:

- `profile_signature_flower` - needs_regeneration, 2 attempts; attempt 1 left a
  magenta edge and attempt 2 retained an opaque white corner/background after
  alpha audit
- `profile_porcelain_camellia` - accepted, 2 attempts; attempt 2 created a
  distinct camellia spray after attempt 1 duplicated the signature flower
- `profile_botanical_crest` - accepted, 1 attempt
- `deco_vine_corner_left` - accepted, 1 attempt
- `deco_vine_corner_right` - accepted, 1 attempt

Checkpoint: processed five asset IDs and stopped. Wait for the user to
explicitly say `continue`; retry `profile_signature_flower` first, then continue
to the next unstarted asset `deco_flower_cluster_white`.

Continue session 2026-07-11 fourth set:

- `profile_signature_flower` - accepted on attempt 3 overall; first attempt in
  this session, with verified alpha and transparent corners
- `deco_flower_cluster_white` - accepted, 1 attempt
- `deco_flower_cluster_blush` - accepted, 1 attempt
- `deco_small_biomech_bloom` - accepted, 1 attempt
- `deco_leaf_brass_node` - accepted, 1 attempt

All five final assets are 32-bit alpha PNGs. Corner alpha is 0 for every asset,
and an ivory-card contact-sheet review found no rectangular background or blue
key fringe.

Checkpoint: processed five asset IDs and stopped. Wait for the user to say
`continue`; next unstarted asset is `empty_scan_bloom`.

Continue session 2026-07-11 final set:

- `empty_scan_bloom` - accepted, 2 attempts; attempt 1 was rejected because the
  large porcelain scan ring read as a badge, while attempt 2 uses a secondary
  partial crescent and keeps the orchid dominant
- `empty_archive_specimen` - accepted, 1 attempt
- `empty_insights_seedpod` - accepted, 1 attempt
- `empty_notifications_flower` - accepted, 1 attempt

All four final empty-state assets are 32-bit alpha PNGs with corner alpha 0,
inset silhouettes, and zero detected blue-fringe pixels. Ivory-card review
confirmed that no rectangular keyed background remains.

Final checkpoint: all 25 manifest asset IDs are accepted. There are no
unstarted or `needs_regeneration` assets left.
