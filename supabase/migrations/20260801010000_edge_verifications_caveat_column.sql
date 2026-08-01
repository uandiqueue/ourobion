-- #336 task 2 / #334 finding C1 · edge_verifications.caveat — the approve-with-caveat field
-- shipped on the shared contract at #306 but never got a first-class column.
--
-- #300 §E added `caveat` to the EdgeVerification contract (shared/brain/relationships.schema.ts
-- :189, `z.string().min(1).nullable().optional()`; shared/brain/relationships.ts:282). The TS side
-- is complete and correct — this migration is only the missing DB projection, so the field can be
-- read as a column instead of only from inside the `verification` jsonb.
--
-- ADDITIVE ONLY. Nullable, no default, no backfill: every pre-existing row is a producer that
-- predates caveats and must stay unmarked. Adding a default or backfilling would assert a caveat
-- state those rows never carried.
--
-- NULL SEMANTICS — read this before writing a consumer. The contract deliberately distinguishes
-- three states, and a SQL column can only represent two of them:
--
--   contract `caveat: "…"`   → column = that string      · approved WITH a caveat
--   contract `caveat: null`  → column = NULL             · approved, NO caveat
--   contract key ABSENT      → column = NULL             · producer predates caveats
--
-- The last two BOTH flatten to a NULL column. The distinction is not lost — it survives in the
-- `verification` jsonb, where key presence is testable directly:
--
--   verification ? 'caveat'   -- true  => the producer emitted the field (null or a string)
--                             -- false => the producer predates caveats
--
-- So: use the column to read/serve/index the caveat text; use the jsonb key-presence test when a
-- consumer genuinely needs "no caveat" vs "producer did not know about caveats". Do not infer the
-- latter from the column alone.
--
-- NO CHECK CONSTRAINT, DELIBERATELY. `caveat` renders on a card, so it passes the same
-- non-diagnostic copy gate as every other user-facing string (validateCopyString, superRefine at
-- relationships.schema.ts:201). That gate is enforced in TypeScript at load and is not expressible
-- in SQL; a partial CHECK here would read as equivalent enforcement while catching strictly less.
-- The contract's `.min(1)` non-empty rule is likewise left to zod rather than half-duplicated.

alter table public.edge_verifications
  add column caveat text;

comment on column public.edge_verifications.caveat is
  '#300 §E approve-with-caveat, projected from the truth-tier R2 artifact (shared/brain '
  'EdgeVerification.caveat). User-facing card copy: copy-gated by validateCopyString in '
  'shared/brain/relationships.schema.ts, NOT by a DB constraint. Additive + nullable with no '
  'backfill — NULL means EITHER ''approved, no caveat'' OR ''producer predates caveats''; those '
  'two are distinguished only by the jsonb key-presence test (verification ? ''caveat''), never '
  'by this column alone.';
