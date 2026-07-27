-- supabase/tests/authz/50_post_u2_seed.sql
--
-- Membership provisioning, applied as the superuser AFTER the R4-U2 migrations (public.nao_members
-- does not exist before them). This file is the harness's stand-in for what a human operator does
-- in the Supabase SQL editor as service_role — there is deliberately no in-app path to it.
--
-- Six effective/ineffective states are provisioned so that each of the three independent kill
-- switches is proven to deny INDEPENDENTLY of the others:
--
--   viewer / curator / admin   active, revoked_at null  → effective; the capability ladder
--   dev2                       active curator           → the second dev (a P-c target, and the
--                                                         subject of the live-revocation assertion)
--   suspended                  status = 'suspended'     → must be denied although revoked_at is null
--   revoked                    revoked_at set, and tier ADMIN with status STILL 'active'
--                                                       → proves revoked_at alone denies, and that
--                                                         it beats the highest tier
--   deleted                    row inserted then DELETED → proves no residual capability survives

insert into public.nao_members (user_id, role, status, revoked_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'viewer',  'active',    null),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'curator', 'active',    null),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'admin',   'active',    null),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'viewer',  'suspended', null),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'admin',   'active',    now()),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'curator', 'active',    null),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'curator', 'active',    null);

-- The third kill switch: the row simply stops existing.
delete from public.nao_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000006';
