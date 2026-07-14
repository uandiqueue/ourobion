# Biotope AI Image Assets

This folder tracks direct Codex-generated image assets for the Biotope Flutter
app. It is intentionally documentation-first so batches can resume across
sessions without relying on chat memory.

## References

- Put visual references in `references/`.
- The canonical UI seed is
  `references/biomech-botanical-ui-seed.png`.
- The Biotope logo reference package lives at
  `assets/ourobion-biotope-logo/`.

The seed image defines the target atmosphere: porcelain-white backgrounds,
soft high-key lighting, ivory biomechanical surfaces, restrained brass details,
realistic botanical stems, premium biotech calm, and generous negative space.
The logo package is a brand reference only. Do not regenerate, modify, embed, or
redesign the logo inside AI-generated assets.

## Continuation Workflow

When resuming, read these files first:

- `progress/asset-generation-state.json`
- `progress/next-actions.md`
- `asset-manifest.json`
- `lessons/prompt-lessons.md`
- `lessons/rejected-assets.md`
- `lessons/style-drift-notes.md`

Continue in this order: `needs_regeneration`, `generated`,
`prompt_written`, then `not_started`. Do not regenerate `accepted` assets
unless explicitly requested.

## Review Workflow

Each asset has:

- prompt: `prompts/{asset_id}.md`
- review: `reviews/{asset_id}.md`
- optional candidates: `reviews/candidates/{asset_id}_attempt_{n}.png`
- accepted Flutter output:
  `apps/biotope/assets/images/generated/biomech_botanical/{category}/{filename}.png`

Only assets marked `accepted` in both JSON files are final. Weak outputs remain
as `needs_regeneration` or `rejected` with a written reason.

Each asset also has a `background_mode`:

- `transparent`: reusable overlays, decorative elements, empty-state objects,
  isolated motifs, and card decorations. These must have alpha and no
  rectangular white box.
- `porcelain_white`: hero, banner, scan, insight header, archive cover, and
  editorial images. These preserve the UI seed's clean warm white background and
  do not need alpha.

## Flutter Usage

Flutter bundles `assets/images/generated/biomech_botanical/` from
`apps/biotope/pubspec.yaml`.

Use constants from `apps/biotope/lib/core/generated_assets.dart`:

```dart
Image.asset(BiotopeGeneratedAssets.homeHeroRobotHandMain)
```

Do not scatter raw generated asset path strings through widgets.
