# deco_small_biomech_bloom Review

- Status: accepted
- Background mode: transparent
- Final asset:
  `apps/biotope/assets/images/generated/biomech_botanical/decorative/deco_small_biomech_bloom.png`
- Candidate attempt:
  `assets/ui-generation/biomech-botanical/reviews/candidates/deco_small_biomech_bloom_attempt_1.png`

## UI Seed Fit

The warm-white star bloom, porcelain calyx, brass center, and two pale leaves
form a clear compact biomechanical botanical object. At micro-accent scale it
stays legible and premium without reading as a logo or flat icon.

## Background Mode

Correct. The final is a 1254 x 1254 `Format32bppArgb` PNG with all corner alpha
values at 0. The audit found 1,290,351 transparent pixels, 5,917 partial edge
pixels, 276,248 opaque pixels, zero blue-fringe pixels, and inset bounds of
`(287, 184)` to `(982, 1051)`.

## Slightly Off

The porcelain calyx is mechanically denser than the other decorative motifs,
but intended-size review confirms the flower remains the first read.

## Flutter Usage

Use as a compact bloom accent for cards and tab microstates. Avoid rendering it
so large that the calyx becomes the dominant visual.
