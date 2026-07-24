-- O11 / run-2 U6 · daily_gut_rows.data_origin — row provenance for simulated data.
--
-- The O11 simulated-health loader (nao /loader, D3-recorded deviation: nao writes
-- biotope's truth tables for the demo) must leave simulated rows CLEARLY
-- distinguishable from real self-report data. wearable_daily already carries a
-- `source` text column the loader reuses; daily_gut_rows has no provenance column,
-- so this adds ONE additive nullable column (append-only migration — never a rewrite).
--
-- Semantics: NULL = real user-entered data (every existing row and every row the
-- biotope app writes today — the app's writer is untouched). Loaders stamp a
-- namespaced marker, e.g. 'simulated:run2-demo'. No default, no backfill, no RLS or
-- contract change; the DailyGutRow contract guard reads the ORIGINAL 20260513
-- migration's column set, so the shared contract stays additive-safe.

alter table public.daily_gut_rows
  add column if not exists data_origin text;

comment on column public.daily_gut_rows.data_origin is
  'Row provenance. NULL = real user-entered data; loaders stamp a namespaced marker '
  '(e.g. ''simulated:run2-demo'' from nao''s O11 demo loader) so simulated rows are '
  'always distinguishable from real self-report.';
