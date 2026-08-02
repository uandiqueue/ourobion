# AI Asset Generation Progress

This folder is the resumable state for direct Codex image generation.

- `asset-generation-state.json` is the operational state.
- `current-batch.md` records the active bounded batch.
- `next-actions.md` records what the next Codex session should do first.

Each session processes at most five asset IDs and at most two attempts per asset.
