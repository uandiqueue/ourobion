# empty_scan_bloom Review

- Status: accepted
- Background mode: transparent
- Final asset:
  `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_scan_bloom.png`
- Candidate attempts:
  - `assets/ui-generation/biomech-botanical/reviews/candidates/empty_scan_bloom_attempt_1.png`
  - `assets/ui-generation/biomech-botanical/reviews/candidates/empty_scan_bloom_attempt_2.png`

## UI Seed Fit

Attempt 2 keeps the white orchid, buds, fine stem, and pale leaf as the primary
read. The thin partial porcelain scan crescent and two brass points are quiet
supporting details rather than a HUD, target, or emblem.

## Background Mode

Correct. The final is a 1024 x 1536 `Format32bppArgb` PNG with all corner alpha
values at 0. The audit found 1,382,122 transparent pixels, 4,701 partial edge
pixels, 186,041 opaque pixels, zero blue-fringe pixels, and inset bounds of
`(172, 139)` to `(859, 1359)`.

## Rejected Attempt

Attempt 1 was rejected because its large near-circular porcelain ring dominated
the flower and read like a badge or logo-like scan target.

## Flutter Usage

Use as the quiet empty state when no scan result is available.
