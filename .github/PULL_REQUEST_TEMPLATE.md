## Summary
<!-- What does this PR do and why? -->

Closes #

**Module scope:** M\_
**Type:** feat / fix / docs / refactor / ci / chore

---

## Changes
<!-- One bullet per meaningful change -->

-

---

## Checklist

### Code
- [ ] `flutter analyze` passes with no issues
- [ ] No imports from another module's `/impl` directory
- [ ] No user-facing strings use diagnostic language (`copy_guidelines.ts`)

### Data
- [ ] `shared/types/` unchanged — or 2 reviewers assigned below
- [ ] Any new daily row type includes the `region` field

### Process
- [ ] CI is green
- [ ] PR targets `dev-phase2` (not `main`)
- [ ] A `docs/sessions/` log for this session is added, with a `memory:` line (enforced by `context_sync --check`)
- [ ] If `docs/memory/` or `docs/shared/decisions/` changed: ran `node tools/context_sync.mjs --fix-index`
- [ ] Linked issue number filled in above

### If `shared/types/` changed
- [ ] Field added as optional with a default — no renames or removals without migration plan
- [ ] Second reviewer assigned to this PR
