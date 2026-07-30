-- Align every ingestion-seed boundary on one slug contract. The original table CHECK enforced the
-- character shape but had no length cap, while Nao/GitHub selectors are capped at 64 characters.
-- Keep this forward-only and NOT VALID: new/updated rows are enforced immediately, while any
-- legacy overlength row remains visible to curators so it can be remediated honestly.

alter table public.ingestion_seeds
  add constraint ingestion_seeds_slug_contract_check
  check (slug ~ '^[a-z0-9_]+$' and char_length(slug) <= 64)
  not valid;

comment on constraint ingestion_seeds_slug_contract_check on public.ingestion_seeds is
  'New/updated slugs must match ^[a-z0-9_]+$ and contain at most 64 characters; NOT VALID preserves legacy-invalid rows for explicit remediation.';
