# The four run tracking docs

All live in **`docs/temp/`** — dev-aid tier, **index-exempt** (outside `docs/INDEX.md`
enforcement). Naming convention: `docs/temp/<run-slug>-orchestration-log.md` /
`-blocked-register.md` / `-signoff-decisions.md` / `-config-decisions.md`, where
`<run-slug>` = this run's slug (e.g. `phase2-run`).
They are the run's resumable state: a fresh orchestrator session must be able to continue
from them alone.

**Update-after-every-unit rule:** the orchestration log's worklist row + ledger row are
updated as part of finishing a unit (same or next commit) — never batched "later". A run
doc that lags the repo is worse than none: it makes the next session resume from fiction.

## 1. `<run-slug>-orchestration-log.md` — the resume point

- Front section: any ⚠ read-this-first events (e.g. the reverse-cascade recovery section).
- **Baseline**: what was already shipped at run start — "do not rebuild".
- **Worklist**: one row per unit — `# | Unit | Status | Notes`; statuses
  `done / in-flight / next / queued / blocked / stretch`; notes carry branch/PR/commit,
  suite counts, live-proof one-liners, retro-review flags. The dependency spine
  (U1 → {U6→U7, U8} …) sits under the table.
- **Session ledger**: one row per session — `When (UTC) | Unit | Branch / PR | Outcome`.
- Run-protocol bullets + notes for the resuming orchestrator (toolchain activation,
  `--fix-index` before push, `memory:` line requirement).

## 2. `<run-slug>-blocked-register.md` — human-gated items (B-entries)

Entry format: **where it stopped · what is needed from Jayden · what it gates.**
Numbered `B1, B2, …`; closed items stay in place marked DONE/CLOSED with a resolution
note (the record of *why* something waited is part of the run's honesty). The run skips
these and keeps building; when one unblocks, the orchestrator picks it up from here.

## 3. `<run-slug>-signoff-decisions.md` — judgment calls (D-entries)

Entry format: **Choice · Alternatives rejected (with why) ·** optional **AMENDED** lines
(dated, appended — the original stays visible; e.g. D1's same-day switch from self-merge
to the stacked chain). Anything a human might reasonably have decided differently gets a
D-entry; later units cite D-refs instead of re-arguing.

## 4. `<run-slug>-config-decisions.md` — numbers (C-entries)

Entry format: **value shipped · alternatives considered · rationale**; all values
provisional-until-calibrated unless marked otherwise; every value must live in a config
object, never an inline literal (ADR-0002 mandate). Companion to the architecture doc's
§11 hyperparameter registry.

## Related but separate

- `docs/temp/run1/audit/` — record-only audit runs (own orchestration log + findings
  register, `A#` findings) feeding fix-unit worklists — protocol in the
  **record-only-audit** skill.
- `docs/sessions/` — per-session logs (canonical tier, indexed, enforced) — the evidence
  record the run docs cite.

## Phase-2 history

The Phase-2 run (`<run-slug>` = `phase2-run`) moved these docs to `docs/temp/` from
`docs/shared/`, superseding its own D6.
