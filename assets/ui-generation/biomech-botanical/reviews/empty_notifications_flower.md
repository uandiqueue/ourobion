# empty_notifications_flower Review

- Status: accepted
- Background mode: transparent
- Final asset:
  `apps/biotope/assets/images/generated/biomech_botanical/empty_states/empty_notifications_flower.png`
- Candidate attempt:
  `assets/ui-generation/biomech-botanical/reviews/candidates/empty_notifications_flower_attempt_1.png`

## UI Seed Fit

The downward warm-white bell flower, bud, pale leaves, fine stem, porcelain
collar, and tiny brass bead feel peaceful and botanical. It suggests silence
without becoming a literal notification icon, badge, or red-dot UI symbol.

## Background Mode

Correct. The final is a 1254 x 1254 `Format32bppArgb` PNG with all corner alpha
values at 0. The audit found 1,388,528 transparent pixels, 5,139 partial edge
pixels, 178,849 opaque pixels, zero blue-fringe pixels, and inset bounds of
`(287, 288)` to `(1129, 1073)`.

## Slightly Off

None material. The brass bead is small enough that the flower remains the clear
first read.

## Flutter Usage

Use when there are no notifications.
